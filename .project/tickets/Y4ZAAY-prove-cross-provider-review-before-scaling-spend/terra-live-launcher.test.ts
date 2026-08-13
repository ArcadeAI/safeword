import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

import {
  initializeCanary,
  type CanaryInitializationBinding,
  type CanaryUpstream,
} from "./terra-development-canary";
import type { CanaryAuthorization } from "./terra-github-authorization";

import {
  createTerraPaidChildCommand,
  parseTerraPaidChildResult,
  preflightPinnedCheckout,
  runAuthorizedTerraPaidCanary,
  runTerraPaidCanary,
  spawnPaidChild,
  verifyAuthorizedPaidChildInput,
  type PaidChildRequest,
  type PinnedCheckout,
} from "./terra-live-launcher";

const execFileAsync = promisify(execFile);
const CORPUS_DIGEST = "4bf3fd10c20222088ccf11bd2b187561021608cb07a646bc4b9294babfc33c75";

function memoryUpstream(): CanaryUpstream {
  let receipt: Awaited<ReturnType<CanaryUpstream["consumeInitialization"]>> | undefined;
  let head = { observedCostPicodollars: "0", startedAttempts: 0 };
  const starts: Awaited<ReturnType<CanaryUpstream["postAttemptStart"]>>[] = [];
  const completions: Awaited<ReturnType<CanaryUpstream["postAttemptCompletion"]>>[] = [];
  return {
    consumeInitialization: async ({ authorizationId, bindingDigest }) => {
      receipt = {
        authorizationId,
        bindingDigest,
        observedCostPicodollars: "0",
        receiptId: "initialization-receipt",
        startedAttempts: 0,
      };
      return receipt;
    },
    inspect: async () =>
      receipt === undefined
        ? { authorizationId: "authorization-1", kind: "ready" }
        : { completions, head, kind: "consumed", receipt, starts },
    postAttemptCompletion: async (input) => {
      const completion = {
        attemptCostPicodollars: input.attemptCostPicodollars,
        attemptId: input.attemptId,
        nativeUsageDigest: input.nativeUsageDigest,
        observedCostPicodollars: input.observedCostPicodollars,
        receiptId: `completion-${input.sequence}`,
        responseDigest: input.responseDigest,
        sequence: input.sequence,
        startReceiptId: input.startReceiptId,
      };
      completions.push(completion);
      head = { ...head, observedCostPicodollars: input.observedCostPicodollars };
      return completion;
    },
    postAttemptStart: async (input) => {
      const start = {
        attemptId: input.attemptId,
        intentId: input.intentId,
        receiptId: `start-${input.sequence}`,
        sequence: input.sequence,
        startedAttempts: input.sequence,
      };
      starts.push(start);
      head = { ...head, startedAttempts: input.sequence };
      return start;
    },
  };
}

function validChildOutput(): PaidChildResult {
  const rawUsage = {
    input_tokens: 10,
    input_tokens_details: { cached_tokens: 2 },
    output_tokens: 3,
  };
  const rawBody = JSON.stringify({
    id: "resp-terra-1",
    model: "gpt-5.6-terra",
    output: [],
    service_tier: "default",
    status: "completed",
    usage: rawUsage,
  });
  const rawResponseBytes = JSON.stringify({
    intent: { attemptId: "attempt-1", intentId: "intent-1", sequence: 1 },
    requests: [{
      endpoint: "https://api.openai.com/v1/responses",
      intentId: "intent-1",
      model: "gpt-5.6-terra",
      sequence: 2,
      serviceTier: "default",
      stage: "repository-reading",
      turnIntentId: "turn-intent-1",
    }],
    responses: [{
      errorMessage: null,
      errorName: null,
      httpStatus: 200,
      intentId: "intent-1",
      nativeUsage: rawUsage,
      outcome: "response",
      rawBody,
      requestId: "req-terra-1",
      responseId: "resp-terra-1",
      returnedModel: "gpt-5.6-terra",
      returnedServiceTier: "default",
      sequence: 3,
      stage: "repository-reading",
      turnIntentId: "turn-intent-1",
    }],
  });
  const nativeUsageBytes = JSON.stringify({
    turns: [{
      rawUsage,
      requestId: "req-terra-1",
      responseId: "resp-terra-1",
      stage: "repository-reading",
    }],
  });
  return {
    exitCode: 0,
    stderr: "",
    stdout: `${JSON.stringify({
      attemptCostPicodollars: "65500000",
      nativeUsageBytes,
      rawResponseBytes,
    })}\n`,
  };
}

async function pinnedCheckout(name: string): Promise<PinnedCheckout> {
  const directory = await mkdtemp(join(tmpdir(), `${name}-`));
  const remote = await mkdtemp(join(tmpdir(), `${name}-remote-`));
  const canonicalRepository = "ArcadeAI/safeword";
  const canonicalUrl = `https://github.com/${canonicalRepository}.git`;
  await execFileAsync("git", ["init", "--quiet", "--bare", remote]);
  await execFileAsync("git", ["init", "--quiet", directory]);
  await execFileAsync("git", ["config", "user.email", "canary@example.com"], {
    cwd: directory,
  });
  await execFileAsync("git", ["config", "user.name", "Canary Test"], {
    cwd: directory,
  });
  await writeFile(join(directory, "fixture.txt"), `${name}\n`, "utf8");
  const registrationDirectory = join(
    directory,
    ".project/tickets/CWGYH0-pr-review-eval"
  );
  await mkdir(registrationDirectory, { recursive: true });
  const corpusDirectory = join(import.meta.dirname, "../CWGYH0-pr-review-eval");
  await Promise.all([
    "corpus-registration-development-2026-08-11.json",
    "scored-cases-frozen-2026-08-01.json",
    "reserve-cases-frozen-2026-08-01.json",
  ].map(async (filename) =>
    writeFile(
      join(registrationDirectory, filename),
      await readFile(join(corpusDirectory, filename)),
    )
  ));
  await writeFile(
    join(registrationDirectory, "corpus-registration-development-2026-08-11.sha256"),
    `${CORPUS_DIGEST}\n`,
    "utf8"
  );
  await execFileAsync("git", ["add", "."], { cwd: directory });
  await execFileAsync("git", ["commit", "--quiet", "-m", "fixture"], {
    cwd: directory,
  });
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
    cwd: directory,
  });
  const commit = stdout.trim();
  const tag = `${name}-canary-v1`;
  await execFileAsync("git", ["tag", "-a", tag, "-m", `${name} canary`], {
    cwd: directory,
  });
  await execFileAsync("git", ["config", `url.${remote}.insteadOf`, canonicalUrl], {
    cwd: directory,
  });
  await execFileAsync("git", ["remote", "add", "origin", canonicalUrl], {
    cwd: directory,
  });
  await execFileAsync("git", ["push", "--quiet", "origin", "HEAD:main", tag], {
    cwd: directory,
  });
  return { canonicalRepository, commit, directory, tag };
}

describe("credential-separated live launcher", () => {

  test.each([
    ["adapter commit", { adapterCommit: "0".repeat(40) }],
    ["adapter tag", { adapterTag: "other-adapter-tag" }],
    ["harness commit", { harnessCommit: "0".repeat(40) }],
    ["harness tag", { harnessTag: "other-harness-tag" }],
    ["canonical repository", { canonicalRepository: "ArcadeAI/other" }],
    ["corpus digest", { corpusDigest: "0".repeat(64) }],
  ])("rejects a checkout that differs from the authorized %s before loading credentials", async (_label, patch) => {
    const adapter = await pinnedCheckout("bound-adapter");
    const harness = await pinnedCheckout("bound-harness");
    const binding: CanaryInitializationBinding = {
      adapterCommit: adapter.commit,
      adapterTag: adapter.tag,
      attemptLimit: 10,
      canonicalRepository: adapter.canonicalRepository,
      corpusDigest: CORPUS_DIGEST,
      costLimitPicodollars: "15000000000000",
      harnessCommit: harness.commit,
      harnessTag: harness.tag,
      model: "gpt-5.6-terra",
      outputIdentity: "terra-canary-test",
      receiptBudget: 21,
      serviceTier: "default",
      ticketId: "Y4ZAAY",
      ...patch,
    };
    let secretLoads = 0;

    await expect(runTerraPaidCanary({
      adapterCheckout: adapter,
      attemptId: "attempt-1",
      binding,
      createUpstream: () => {
        throw new Error("upstream must not be constructed");
      },
      harnessCheckout: harness,
      inputPath: join(tmpdir(), "unused-input.json"),
      intentId: "intent-1",
      loadGitHubToken: async () => {
        secretLoads += 1;
        return "github-token";
      },
      loadOpenAIKey: async () => {
        secretLoads += 1;
        return "openai-key";
      },
      outputDirectory: join(tmpdir(), "unused-output"),
      registration: {
        corpusDigest: CORPUS_DIGEST,
        registrationCommit: harness.commit,
      },
    })).rejects.toThrow("do not match the canary authorization");
    expect(secretLoads).toBe(0);
  });

  test("runs the authorized composition while keeping GitHub credentials out of the paid child", async () => {
    const adapter = await pinnedCheckout("composed-adapter");
    const harness = await pinnedCheckout("composed-harness");
    const binding: CanaryInitializationBinding = {
      adapterCommit: adapter.commit,
      adapterTag: adapter.tag,
      attemptLimit: 10,
      canonicalRepository: "ArcadeAI/safeword",
      corpusDigest: CORPUS_DIGEST,
      costLimitPicodollars: "15000000000000",
      harnessCommit: harness.commit,
      harnessTag: harness.tag,
      model: "gpt-5.6-terra",
      outputIdentity: "terra-canary-composed",
      receiptBudget: 21,
      serviceTier: "default",
      ticketId: "Y4ZAAY",
    };
    const outputDirectory = join(await mkdtemp(join(tmpdir(), "terra-composed-")), "output");
    const upstream = memoryUpstream();
    await initializeCanary({ binding, outputDirectory, upstream });

    const corpusDirectory = join(import.meta.dirname, "../CWGYH0-pr-review-eval");
    const manifest = JSON.parse(
      await readFile(join(corpusDirectory, "scored-cases-frozen-2026-08-01.json"), "utf8")
    ) as { cases: Array<Record<string, unknown>>; modelCutoff: string; runnerRef: string };
    const corpusCase = manifest.cases[0]!;
    const inputPath = join(await mkdtemp(join(tmpdir(), "terra-composed-input-")), "input.json");
    await writeFile(inputPath, JSON.stringify({
      context: { attemptId: "attempt-1", intentId: "intent-1", outputDirectory, sequence: 1 },
      expertsDirectory: join(tmpdir(), "terra-experts"),
      policy: { maxVerifications: 2, toolCallsPerExpert: 3, wallClockMsPerExpert: 4_000 },
      review: {
        caseId: corpusCase.id,
        causalPaths: corpusCase.causalPaths,
        failureDescription: corpusCase.failureDescription,
        modelCutoff: manifest.modelCutoff,
        reviewBaseSha: corpusCase.reviewBaseSha,
        runnerRef: manifest.runnerRef,
        sourceSha: corpusCase.baseSha,
        variant: "buggy",
      },
      target: { baseRef: "eval-base", root: join(tmpdir(), "terra-target") },
    }), "utf8");
    let childEnvironment: Record<string, string> | undefined;

    await expect(runTerraPaidCanary({
      adapterCheckout: adapter,
      attemptId: "attempt-1",
      binding,
      createUpstream: (githubToken) => {
        expect(githubToken).toBe("github-secret");
        return upstream;
      },
      environment: { GITHUB_TOKEN: "ambient-github", PATH: process.env.PATH },
      harnessCheckout: harness,
      inputPath,
      intentId: "intent-1",
      loadGitHubToken: async () => "github-secret",
      loadOpenAIKey: async () => "openai-secret",
      outputDirectory,
      registration: { corpusDigest: CORPUS_DIGEST, registrationCommit: harness.commit },
      spawnChild: async (request) => {
        childEnvironment = request.env;
        return validChildOutput();
      },
    })).resolves.toMatchObject({
      attemptId: "attempt-1",
      observedCostPicodollars: 65_500_000n,
      sequence: 1,
    });
    expect(childEnvironment).toMatchObject({
      OPENAI_API_KEY: "openai-secret",
      SAFEWORD_PAID_CANARY_RETRIES: "0",
    });
    expect(childEnvironment).not.toHaveProperty("GITHUB_TOKEN");
    expect(JSON.stringify(childEnvironment)).not.toContain("github-secret");
  });

  test("maps every authorization binding field at the exported entry point", async () => {
    const adapter = await pinnedCheckout("authorized-adapter");
    const harness = await pinnedCheckout("authorized-harness");
    const authorization: CanaryAuthorization = {
      adapterCommit: adapter.commit,
      adapterTag: adapter.tag,
      attemptLimit: 10,
      authorizationId: "authorization-1",
      canonicalRepository: "ArcadeAI/safeword",
      corpusDigest: CORPUS_DIGEST,
      costLimitPicodollars: "15000000000000",
      diagnosticOnly: true,
      evidenceRole: "development",
      harnessCommit: harness.commit,
      harnessTag: harness.tag,
      model: "gpt-5.6-terra",
      outputIdentity: "terra-authorized-entry",
      receiptBudget: 21,
      registrationCommentId: 1,
      registrationCommit: harness.commit,
      serviceTier: "default",
      ticketId: "Y4ZAAY",
    };
    const expectedBinding: CanaryInitializationBinding = {
      adapterCommit: authorization.adapterCommit,
      adapterTag: authorization.adapterTag,
      attemptLimit: authorization.attemptLimit,
      canonicalRepository: authorization.canonicalRepository,
      corpusDigest: authorization.corpusDigest,
      costLimitPicodollars: authorization.costLimitPicodollars,
      harnessCommit: authorization.harnessCommit,
      harnessTag: authorization.harnessTag,
      model: authorization.model,
      outputIdentity: authorization.outputIdentity,
      receiptBudget: authorization.receiptBudget,
      serviceTier: authorization.serviceTier,
      ticketId: authorization.ticketId,
    };
    const outputDirectory = join(await mkdtemp(join(tmpdir(), "terra-authorized-")), "output");
    const upstream = memoryUpstream();
    await initializeCanary({ binding: expectedBinding, outputDirectory, upstream });
    const corpusDirectory = join(import.meta.dirname, "../CWGYH0-pr-review-eval");
    const manifest = JSON.parse(
      await readFile(join(corpusDirectory, "scored-cases-frozen-2026-08-01.json"), "utf8")
    ) as { cases: Array<Record<string, unknown>>; modelCutoff: string; runnerRef: string };
    const corpusCase = manifest.cases[0]!;
    const inputPath = join(await mkdtemp(join(tmpdir(), "terra-authorized-input-")), "input.json");
    await writeFile(inputPath, JSON.stringify({
      context: { attemptId: "attempt-1", intentId: "intent-1", outputDirectory, sequence: 1 },
      expertsDirectory: join(tmpdir(), "terra-experts"),
      policy: { maxVerifications: 2, toolCallsPerExpert: 3, wallClockMsPerExpert: 4_000 },
      review: {
        caseId: corpusCase.id,
        causalPaths: corpusCase.causalPaths,
        failureDescription: corpusCase.failureDescription,
        modelCutoff: manifest.modelCutoff,
        reviewBaseSha: corpusCase.reviewBaseSha,
        runnerRef: manifest.runnerRef,
        sourceSha: corpusCase.baseSha,
        variant: "buggy",
      },
      target: { baseRef: "eval-base", root: join(tmpdir(), "terra-target") },
    }), "utf8");

    await expect(runAuthorizedTerraPaidCanary({
      adapterCheckout: adapter,
      allowlistedMaintainers: ["maintainer"],
      attemptId: "attempt-1",
      authorization,
      createUpstream: (binding, token) => {
        expect(binding).toEqual(expectedBinding);
        expect(token).toBe("github-secret");
        return upstream;
      },
      harnessCheckout: harness,
      inputPath,
      intentId: "intent-1",
      issueNumber: 1909,
      loadGitHubToken: async () => "github-secret",
      loadOpenAIKey: async () => "openai-secret",
      outputDirectory,
      spawnChild: async () => validChildOutput(),
    })).resolves.toMatchObject({ attemptId: "attempt-1", sequence: 1 });
  });

  test("binds the paid child review to an exact frozen corpus case", async () => {
    const harness = await pinnedCheckout("harness-corpus-input");
    const corpusDirectory = join(import.meta.dirname, "../CWGYH0-pr-review-eval");
    const registration = JSON.parse(
      await readFile(join(corpusDirectory, "corpus-registration-development-2026-08-11.json"), "utf8")
    );
    const manifest = JSON.parse(
      await readFile(join(corpusDirectory, "scored-cases-frozen-2026-08-01.json"), "utf8")
    ) as { cases: Array<Record<string, unknown>>; modelCutoff: string; runnerRef: string };
    const corpusCase = manifest.cases[0]!;
    const inputPath = join(await mkdtemp(join(tmpdir(), "terra-input-")), "input.json");
    const review = {
      caseId: corpusCase.id,
      causalPaths: corpusCase.causalPaths,
      failureDescription: corpusCase.failureDescription,
      modelCutoff: manifest.modelCutoff,
      reviewBaseSha: corpusCase.reviewBaseSha,
      runnerRef: manifest.runnerRef,
      sourceSha: corpusCase.baseSha,
      variant: "buggy",
    };
    const request = {
      context: {
        attemptId: "attempt-1",
        intentId: "intent-1",
        outputDirectory: join(tmpdir(), "terra-output"),
        sequence: 1,
      },
      expertsDirectory: join(tmpdir(), "terra-experts"),
      policy: {
        maxVerifications: 2,
        toolCallsPerExpert: 3,
        wallClockMsPerExpert: 4_000,
      },
      review,
      target: { baseRef: "eval-base", root: join(tmpdir(), "terra-target") },
    };
    await writeFile(inputPath, JSON.stringify(request), "utf8");

    await expect(verifyAuthorizedPaidChildInput({
      checkout: harness,
      inputPath,
      registration,
      registrationCommit: harness.commit,
    })).resolves.toBeUndefined();

    await writeFile(inputPath, JSON.stringify({
      ...request,
      review: { ...review, sourceSha: "0".repeat(40) },
    }), "utf8");
    await expect(verifyAuthorizedPaidChildInput({
      checkout: harness,
      inputPath,
      registration,
      registrationCommit: harness.commit,
    })).rejects.toThrow("does not match its frozen corpus case");

    await writeFile(inputPath, JSON.stringify({ ...request, extra: true }), "utf8");
    await expect(verifyAuthorizedPaidChildInput({
      checkout: harness,
      inputPath,
      registration,
      registrationCommit: harness.commit,
    })).rejects.toThrow("unexpected or missing fields");
  });
  test("builds the pinned harness child command with absolute paths", () => {
    expect(
      createTerraPaidChildCommand({
        harnessDirectory: "/tmp/pinned-harness",
        inputPath: "/tmp/attempt-input.json",
      })
    ).toEqual({
      args: [
        "/tmp/pinned-harness/.project/tickets/Y4ZAAY-prove-cross-provider-review-before-scaling-spend/terra-paid-child.ts",
        "/tmp/attempt-input.json",
      ],
      command: join(process.env.BUN_INSTALL!, "bin/bun"),
    });
  });

  test("runs the paid child without a shell and captures its result", async () => {
    const result = await spawnPaidChild({
      args: [
        "-e",
        "process.stdout.write(process.env.CANARY_MARKER ?? ''); process.stderr.write('diagnostic')",
      ],
      command: process.execPath,
      cwd: process.cwd(),
      env: { CANARY_MARKER: "complete" },
    });

    expect(result).toEqual({
      exitCode: 0,
      stderr: "diagnostic",
      stdout: "complete",
    });
  });

  test("returns a paid child's non-zero exit and diagnostics", async () => {
    await expect(
      spawnPaidChild({
        args: [
          "-e",
          "process.stdout.write('partial'); process.stderr.write('failed'); process.exit(7)",
        ],
        command: process.execPath,
        cwd: process.cwd(),
        env: {},
      })
    ).resolves.toEqual({
      exitCode: 7,
      stderr: "failed",
      stdout: "partial",
    });
  });

  test("the built paid-child command reaches the physical child process", async () => {
    const child = createTerraPaidChildCommand({
      harnessDirectory: join(import.meta.dirname, "../../.."),
      inputPath: join(tmpdir(), "unused-terra-child-input.json"),
    });
    const result = await spawnPaidChild({
      ...child,
      cwd: process.cwd(),
      env: {
        OPENAI_API_KEY: "fake-key",
        PATH: process.env.PATH ?? "",
        SAFEWORD_PAID_CANARY_RETRIES: "1",
      },
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("paid canary retries must be disabled");
  });

  test("strictly converts one successful child result for the controller", () => {
    expect(
      parseTerraPaidChildResult({
        exitCode: 0,
        stderr: "",
        stdout:
          '{"attemptCostPicodollars":"123","nativeUsageBytes":"usage","rawResponseBytes":"response"}\n',
      })
    ).toEqual({
      attemptCostPicodollars: 123n,
      nativeUsageBytes: "usage",
      rawResponseBytes: "response",
    });
    expect(() =>
      parseTerraPaidChildResult({ exitCode: 7, stderr: "failed", stdout: "" })
    ).toThrow("paid child exited 7: failed");
    expect(() =>
      parseTerraPaidChildResult({
        exitCode: 0,
        stderr: "",
        stdout: "{}\nextra\n",
      })
    ).toThrow("one JSON line");
  });




  test("rejects a lightweight tag even when it points to the expected commit", async () => {
    const checkout = await pinnedCheckout("lightweight");
    await execFileAsync("git", ["tag", "-d", checkout.tag], {
      cwd: checkout.directory,
    });
    await execFileAsync("git", ["tag", checkout.tag], {
      cwd: checkout.directory,
    });

    await expect(preflightPinnedCheckout(checkout)).rejects.toThrow(
      "must be annotated"
    );
  });

  test("rejects a checkout whose HEAD moved beyond the authorized commit", async () => {
    const checkout = await pinnedCheckout("moved-head");
    await writeFile(join(checkout.directory, "fixture.txt"), "changed\n", "utf8");
    await execFileAsync("git", ["add", "fixture.txt"], {
      cwd: checkout.directory,
    });
    await execFileAsync("git", ["commit", "--quiet", "-m", "later"], {
      cwd: checkout.directory,
    });

    await expect(preflightPinnedCheckout(checkout)).rejects.toThrow(
      "HEAD does not match"
    );
  });

});
