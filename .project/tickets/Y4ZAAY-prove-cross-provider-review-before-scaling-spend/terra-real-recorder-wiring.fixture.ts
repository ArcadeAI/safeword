import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  ATTEMPT_JOURNAL,
  type CanaryInitializationBinding,
  type CanaryUpstream,
  createCanaryProviderRecorder,
  EVIDENCE_DIRECTORY,
  initializeCanary,
  runCanaryAttempt,
} from "./terra-development-canary";

const ADAPTER_COMMIT = "e1d54b2d12e4a97fba84e8302de31bfe8b60ba17";

function git(directory: string, ...arguments_: string[]): string {
  return execFileSync("git", arguments_, {
    cwd: directory,
    encoding: "utf8",
  }).trim();
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function createUpstream(): CanaryUpstream {
  let consumed = false;
  let receipt: Awaited<ReturnType<CanaryUpstream["consumeInitialization"]>>;
  let starts: Awaited<ReturnType<CanaryUpstream["postAttemptStart"]>>[] = [];
  let completions: Awaited<
    ReturnType<CanaryUpstream["postAttemptCompletion"]>
  >[] = [];
  let head = { observedCostPicodollars: "0", startedAttempts: 0 };
  return {
    consumeInitialization: async (input) => {
      consumed = true;
      receipt = {
        authorizationId: input.authorizationId,
        bindingDigest: input.bindingDigest,
        observedCostPicodollars: "0",
        receiptId: "initialization-receipt-1",
        startedAttempts: 0,
      };
      return receipt;
    },
    inspect: async () =>
      consumed
        ? { completions, head, kind: "consumed", receipt, starts }
        : { authorizationId: "authorization-1", kind: "ready" },
    postAttemptCompletion: async (input) => {
      const completion = {
        attemptCostPicodollars: input.attemptCostPicodollars,
        attemptId: input.attemptId,
        nativeUsageDigest: input.nativeUsageDigest,
        observedCostPicodollars: input.observedCostPicodollars,
        receiptId: `completion-receipt-${input.sequence}`,
        responseDigest: input.responseDigest,
        sequence: input.sequence,
        startReceiptId: input.startReceiptId,
      };
      completions = [...completions, completion];
      head = { ...head, observedCostPicodollars: input.observedCostPicodollars };
      return completion;
    },
    postAttemptStart: async (input) => {
      const start = {
        attemptId: input.attemptId,
        intentId: input.intentId,
        receiptId: `start-receipt-${input.sequence}`,
        sequence: input.sequence,
        startedAttempts: input.sequence,
      };
      starts = [...starts, start];
      head = { ...head, startedAttempts: input.sequence };
      return start;
    },
  };
}

const adapterRoot = requiredEnvironment("Y4ZAAY_ADAPTER_ROOT");
assert.equal(git(adapterRoot, "rev-parse", "HEAD"), ADAPTER_COMMIT);
assert.equal(git(adapterRoot, "status", "--porcelain"), "");

const benchmark = (await import(
  pathToFileURL(
    join(adapterRoot, "tools/pr-review/src/eval/development-benchmark.ts")
  ).href
)) as {
  createRunnerExecutor(options: Record<string, unknown>): (input: unknown) => Promise<unknown>;
};
const openaiLoop = (await import(
  pathToFileURL(join(adapterRoot, "tools/pr-review/src/agent/openai-loop.ts")).href
)) as {
  createOpenAIResponsesAgent(options: Record<string, unknown>): unknown;
};
const openaiProvider = (await import(
  pathToFileURL(
    join(adapterRoot, "tools/pr-review/src/providers/openai-responses.ts")
  ).href
)) as {
  openaiResponsesProvider(options: Record<string, unknown>): unknown;
};

const root = mkdtempSync(join(tmpdir(), "terra-real-recorder-wiring-"));
try {
  const target = join(root, "target");
  const experts = join(root, "experts");
  const outputDirectory = join(root, "canary-output");
  mkdirSync(join(target, "apps", "engine"), { recursive: true });
  mkdirSync(experts);
  git(target, "init");
  git(target, "config", "user.email", "canary@example.com");
  git(target, "config", "user.name", "Canary Fixture");
  writeFileSync(join(target, "apps", "engine", "example.go"), "package engine\n");
  git(target, "add", ".");
  git(target, "commit", "-m", "base");
  const reviewBaseSha = git(target, "rev-parse", "HEAD");
  git(target, "update-ref", "refs/remotes/origin/eval-base", reviewBaseSha);
  writeFileSync(
    join(target, "apps", "engine", "example.go"),
    "package engine\n\nfunc Buggy() {}\n"
  );
  git(target, "commit", "-am", "buggy change");
  const sourceSha = git(target, "rev-parse", "HEAD");

  const prompt = (lane: string) =>
    `---\nlane: ${lane}\nprovider: openai\nmodel: gpt-5.6-terra\neffort: medium\nmaxOutputTokens: 1000\n---\n\nReview the change.`;
  writeFileSync(join(experts, "correctness.md"), prompt("correctness"));
  writeFileSync(join(experts, "verifier.md"), prompt("verifier"));

  const finding = {
    category: "empty-implementation",
    confidence: "high",
    evidence: "Buggy has an empty body.",
    file: "apps/engine/example.go",
    line: 3,
    severity: "high",
    suggestedFix: "Implement the required behavior.",
    title: "Buggy path performs no work",
    whyItMatters: "Calling Buggy silently produces no required effect.",
  };
  const envelopes = [
    {
      id: "resp_read",
      model: "gpt-5.6-terra",
      output: [
        { id: "rs_read", summary: [], type: "reasoning" },
        {
          arguments: '{"path":"apps/engine/example.go"}',
          call_id: "call_read",
          id: "fc_read",
          name: "read_file",
          status: "completed",
          type: "function_call",
        },
      ],
      service_tier: "default",
      status: "completed",
      usage: {
        input_tokens: 100,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens: 20,
      },
    },
    {
      id: "resp_report",
      model: "gpt-5.6-terra",
      output: [
        {
          arguments: JSON.stringify({
            couldNotVerify: [],
            findings: [finding],
            summary: "Read the changed file and found an empty implementation.",
          }),
          call_id: "call_report",
          id: "fc_report",
          name: "report_findings",
          status: "completed",
          type: "function_call",
        },
      ],
      service_tier: "default",
      status: "completed",
      usage: {
        input_tokens: 150,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens: 40,
      },
    },
    {
      id: "resp_verify",
      model: "gpt-5.6-terra",
      output: [
        {
          content: [
            {
              text: JSON.stringify({
                consequenceMatters: true,
                evidenceExists: true,
                insufficientContext: false,
                introducedHere: true,
                reason: "The changed function body is empty.",
                scenarioReachable: true,
                severity: "high",
              }),
              type: "output_text",
            },
          ],
          id: "msg_verify",
          role: "assistant",
          status: "completed",
          type: "message",
        },
      ],
      service_tier: "default",
      status: "completed",
      usage: {
        input_tokens: 90,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens: 20,
      },
    },
  ];

  const binding: CanaryInitializationBinding = {
    adapterCommit: ADAPTER_COMMIT,
    adapterTag: "terra-adapter-v1",
    attemptLimit: 10,
    canonicalRepository: "ArcadeAI/safeword",
    corpusDigest: "a".repeat(64),
    costLimitPicodollars: "15000000000000",
    harnessCommit: "harness-commit",
    harnessTag: "terra-harness-v1",
    model: "gpt-5.6-terra",
    outputIdentity: "terra-real-recorder-fixture",
    receiptBudget: 21,
    serviceTier: "default",
    ticketId: "Y4ZAAY",
  };
  const upstream = createUpstream();
  await initializeCanary({ binding, outputDirectory, upstream });
  let requestCount = 0;

  const result = await runCanaryAttempt({
    attemptId: "attempt-1",
    binding,
    dispatch: async (context) => {
      const recorder = await createCanaryProviderRecorder(context);
      const transport: typeof fetch = Object.assign(
        (_input: string | URL | Request, init?: RequestInit) => {
          const journal = readFileSync(recorder.journalPath, "utf8");
          assert.match(
            readFileSync(join(outputDirectory, ATTEMPT_JOURNAL), "utf8"),
            /"kind":"attempt-start"/
          );
          assert.equal(
            journal.match(/"kind":"provider-turn-intent"/g)?.length,
            requestCount + 1
          );
          assert.equal(
            (JSON.parse(String(init?.body)) as { model: string }).model,
            "gpt-5.6-terra"
          );
          const envelope = envelopes[requestCount++];
          assert.ok(envelope);
          return Promise.resolve(
            new Response(JSON.stringify(envelope), {
              headers: { "x-request-id": `req_${requestCount}` },
              status: 200,
            })
          );
        },
        { preconnect: () => undefined }
      );
      const execute = benchmark.createRunnerExecutor({
        agentFor: () =>
          openaiLoop.createOpenAIResponsesAgent({
            apiKey: "fake-key",
            fetch: transport,
            recorder,
            serviceTier: "default",
            stage: "repository-reading",
          }),
        env: { OPENAI_API_KEY: "fake-key" },
        expertsDir: experts,
        policy: {
          maxVerifications: 2,
          toolCallsPerExpert: 3,
          wallClockMsPerExpert: 4_000,
        },
        provider: () =>
          openaiProvider.openaiResponsesProvider({
            apiKey: "fake-key",
            fetch: transport,
            recorder,
            serviceTier: "default",
            stage: "finding-verification",
          }),
        targetFor: () => ({ baseRef: "eval-base", root: target }),
      });
      const output = (await execute({
        caseId: "DEV-TERRA",
        causalPaths: ["apps/engine/example.go"],
        failureDescription: {
          consequenceAliases: ["no required effect"],
          mechanismAliases: ["empty body"],
        },
        modelCutoff: "2026-01-01T00:00:00.000Z",
        reviewBaseSha,
        runnerRef: `terra-adapter@${ADAPTER_COMMIT}`,
        sourceSha,
        variant: "buggy",
      })) as { terminalState: string };
      assert.equal(output.terminalState, "completed");
      return recorder.complete();
    },
    intentId: "intent-1",
    outputDirectory,
    upstream,
  });

  assert.equal(requestCount, 3);
  assert.equal(result.observedCostPicodollars, 1_640_000_000n);
  const inventory = JSON.parse(
    readFileSync(
      join(outputDirectory, EVIDENCE_DIRECTORY, "attempt-1.json"),
      "utf8"
    )
  ) as { requests: Array<Record<string, unknown>>; responses: unknown[] };
  assert.equal(inventory.requests.length, 3);
  assert.equal(inventory.responses.length, 3);
  assert.equal(inventory.requests.some((request) => "requestId" in request), false);
} finally {
  rmSync(root, { force: true, recursive: true });
}
