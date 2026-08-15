import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createCanaryProviderRecorder,
  type CanaryDispatchContext,
} from "./terra-development-canary";

export type TerraPaidChildInput = {
  context: CanaryDispatchContext;
  expertsDirectory: string;
  policy: {
    maxVerifications: number;
    toolCallsPerExpert: number;
    wallClockMsPerExpert: number;
  };
  review: Record<string, unknown>;
  target: { baseRef: string; root: string };
};

export type TerraPaidChildOutput = {
  attemptCostPicodollars: string;
  nativeUsageBytes: string;
  rawResponseBytes: string;
};

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function validateInput(input: TerraPaidChildInput): void {
  if (
    !isAbsolute(input.context.outputDirectory) ||
    !isAbsolute(input.expertsDirectory) ||
    !isAbsolute(input.target.root)
  ) {
    throw new Error("child paths must be absolute");
  }
  for (const [label, value] of Object.entries(input.policy)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`${label} must be a positive safe integer`);
    }
  }
}

export async function executeTerraPaidChild(input: {
  adapterRoot: string;
  fetch?: typeof globalThis.fetch;
  openAIKey: string;
  request: TerraPaidChildInput;
}): Promise<TerraPaidChildOutput> {
  if (!isAbsolute(input.adapterRoot)) {
    throw new Error("adapter root must be absolute");
  }
  validateInput(input.request);
  const benchmark = (await import(
    pathToFileURL(
      join(
        input.adapterRoot,
        "tools/pr-review/src/eval/development-benchmark.ts"
      )
    ).href
  )) as {
    createRunnerExecutor(
      options: Record<string, unknown>
    ): (review: unknown) => Promise<unknown>;
  };
  const agent = (await import(
    pathToFileURL(
      join(input.adapterRoot, "tools/pr-review/src/agent/openai-loop.ts")
    ).href
  )) as {
    createOpenAIResponsesAgent(options: Record<string, unknown>): unknown;
  };
  const provider = (await import(
    pathToFileURL(
      join(
        input.adapterRoot,
        "tools/pr-review/src/providers/openai-responses.ts"
      )
    ).href
  )) as {
    openaiResponsesProvider(options: Record<string, unknown>): unknown;
  };
  const recorder = await createCanaryProviderRecorder(input.request.context);
  const recordedOptions = (
    stage: "finding-verification" | "repository-reading"
  ) => ({
    apiKey: input.openAIKey,
    fetch: input.fetch,
    maxRetries: 0,
    recorder,
    serviceTier: "default" as const,
    stage,
  });
  const execute = benchmark.createRunnerExecutor({
    agentFor: () =>
      agent.createOpenAIResponsesAgent(recordedOptions("repository-reading")),
    env: { OPENAI_API_KEY: input.openAIKey },
    expertsDir: input.request.expertsDirectory,
    policy: input.request.policy,
    provider: () =>
      provider.openaiResponsesProvider(recordedOptions("finding-verification")),
    targetFor: () => input.request.target,
  });
  const result = (await execute(input.request.review)) as {
    terminalState?: unknown;
  };
  if (result.terminalState !== "completed") {
    throw new Error("Terra review did not complete");
  }
  const completed = await recorder.complete();
  return {
    attemptCostPicodollars: completed.attemptCostPicodollars.toString(),
    nativeUsageBytes: completed.nativeUsageBytes,
    rawResponseBytes: completed.rawResponseBytes,
  };
}

async function main(): Promise<void> {
  const [inputPath] = process.argv.slice(2);
  if (inputPath === undefined || !isAbsolute(inputPath)) {
    throw new Error("one absolute child-input path is required");
  }
  if (requireEnvironment("SAFEWORD_PAID_CANARY_RETRIES") !== "0") {
    throw new Error("paid canary retries must be disabled");
  }
  const inputBytes = await readFile(inputPath, "utf8");
  const expectedDigest = requireEnvironment("SAFEWORD_PAID_CANARY_INPUT_SHA256");
  if (createHash("sha256").update(inputBytes).digest("hex") !== expectedDigest) {
    throw new Error("paid child input changed after authorization");
  }
  const request = JSON.parse(inputBytes) as TerraPaidChildInput;
  const output = await executeTerraPaidChild({
    adapterRoot: process.cwd(),
    openAIKey: requireEnvironment("OPENAI_API_KEY"),
    request,
  });
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

if (import.meta.main) {
  await main();
}
