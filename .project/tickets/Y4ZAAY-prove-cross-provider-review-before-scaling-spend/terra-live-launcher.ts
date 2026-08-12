import { execFile } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";

import {
  type CanaryInitializationBinding,
  type CanaryUpstream,
  runCanaryAttempt,
} from "./terra-development-canary";

const execFileAsync = promisify(execFile);
const PAID_CHILD_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const CHILD_ENVIRONMENT_ALLOWLIST = [
  "NODE_EXTRA_CA_CERTS",
  "PATH",
  "SSL_CERT_FILE",
  "TMPDIR",
] as const;
const REGISTRATION_PATH =
  ".project/tickets/CWGYH0-pr-review-eval/corpus-registration-development-2026-08-11.json";
const REGISTRATION_DIGEST_PATH = `${REGISTRATION_PATH.slice(0, -5)}.sha256`;

export type PinnedCheckout = {
  canonicalRepository: string;
  commit: string;
  directory: string;
  tag: string;
};

export type PaidChildRequest = {
  args: string[];
  command: string;
  cwd: string;
  env: Record<string, string>;
};

export type PaidChildResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export function createTerraPaidChildCommand(input: {
  harnessDirectory: string;
  inputPath: string;
}): { args: string[]; command: string } {
  if (!isAbsolute(input.harnessDirectory) || !isAbsolute(input.inputPath)) {
    throw new Error("paid child paths must be absolute");
  }
  return {
    args: [
      join(
        input.harnessDirectory,
        ".project/tickets/Y4ZAAY-prove-cross-provider-review-before-scaling-spend/terra-paid-child.ts"
      ),
      input.inputPath,
    ],
    command: "bun",
  };
}

export function parseTerraPaidChildResult(result: PaidChildResult): {
  attemptCostPicodollars: bigint;
  nativeUsageBytes: string;
  rawResponseBytes: string;
} {
  if (result.exitCode !== 0) {
    throw new Error(`paid child exited ${result.exitCode}: ${result.stderr}`);
  }
  const lines = result.stdout.split("\n");
  if (lines.length !== 2 || lines[0] === "" || lines[1] !== "") {
    throw new Error("paid child must emit exactly one JSON line");
  }
  let value: unknown;
  try {
    value = JSON.parse(lines[0]);
  } catch {
    throw new Error("paid child output is invalid JSON");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("paid child output must be an object");
  }
  const output = value as Record<string, unknown>;
  if (
    Object.keys(output).sort().join(",") !==
      "attemptCostPicodollars,nativeUsageBytes,rawResponseBytes" ||
    typeof output.attemptCostPicodollars !== "string" ||
    !/^(0|[1-9][0-9]*)$/.test(output.attemptCostPicodollars) ||
    typeof output.nativeUsageBytes !== "string" ||
    output.nativeUsageBytes.length === 0 ||
    typeof output.rawResponseBytes !== "string" ||
    output.rawResponseBytes.length === 0
  ) {
    throw new Error("paid child output has an invalid evidence contract");
  }
  return {
    attemptCostPicodollars: BigInt(output.attemptCostPicodollars),
    nativeUsageBytes: output.nativeUsageBytes,
    rawResponseBytes: output.rawResponseBytes,
  };
}

export async function spawnPaidChild(
  request: PaidChildRequest
): Promise<PaidChildResult> {
  try {
    const { stderr, stdout } = await execFileAsync(
      request.command,
      request.args,
      {
        cwd: request.cwd,
        encoding: "utf8",
        env: request.env,
        maxBuffer: PAID_CHILD_MAX_BUFFER_BYTES,
        shell: false,
      }
    );
    return { exitCode: 0, stderr, stdout };
  } catch (error) {
    const failed = error as {
      code?: unknown;
      stderr?: unknown;
      stdout?: unknown;
    };
    if (typeof failed.code !== "number") {
      throw error;
    }
    return {
      exitCode: failed.code,
      stderr: typeof failed.stderr === "string" ? failed.stderr : "",
      stdout: typeof failed.stdout === "string" ? failed.stdout : "",
    };
  }
}

async function git(directory: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: directory,
      encoding: "utf8",
    });
    return stdout.trim();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`checkout preflight failed: ${detail}`);
  }
}

function canonicalRepositoryUrl(repository: string): string {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("canonical repository identity is invalid");
  }
  return `https://github.com/${repository}.git`;
}

export async function preflightPinnedCheckout(
  checkout: PinnedCheckout
): Promise<void> {
  if (!isAbsolute(checkout.directory)) {
    throw new Error("checkout directory must be absolute");
  }
  if (!/^[0-9a-f]{40}$/.test(checkout.commit)) {
    throw new Error("pinned commit must be a full lowercase SHA-1");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(checkout.tag)) {
    throw new Error("pinned tag is invalid");
  }

  const [head, status, tagType, taggedCommit, originUrl, remoteRefs] = await Promise.all([
    git(checkout.directory, ["rev-parse", "--verify", "HEAD"]),
    git(checkout.directory, ["status", "--porcelain=v1", "--untracked-files=all"]),
    git(checkout.directory, ["cat-file", "-t", `refs/tags/${checkout.tag}`]),
    git(checkout.directory, [
      "rev-parse",
      "--verify",
      `refs/tags/${checkout.tag}^{commit}`,
    ]),
    git(checkout.directory, ["config", "--get", "remote.origin.url"]),
    git(checkout.directory, [
      "ls-remote",
      "origin",
      "refs/heads/main",
      `refs/tags/${checkout.tag}`,
      `refs/tags/${checkout.tag}^{}`,
    ]),
  ]);
  if (originUrl !== canonicalRepositoryUrl(checkout.canonicalRepository)) {
    throw new Error("origin does not match the canonical repository");
  }
  if (status !== "") {
    throw new Error("authorized checkout must be clean");
  }
  if (head !== checkout.commit) {
    throw new Error("checkout HEAD does not match its pinned commit");
  }
  if (tagType !== "tag") {
    throw new Error("pinned tag must be annotated");
  }
  if (taggedCommit !== checkout.commit) {
    throw new Error("pinned tag does not resolve to its authorized commit");
  }
  const refs = new Map(
    remoteRefs.split("\n").filter(Boolean).map((line) => {
      const [sha, ref] = line.split("\t");
      return [ref, sha];
    })
  );
  if (
    refs.get(`refs/tags/${checkout.tag}^{}`) !== checkout.commit ||
    refs.get(`refs/tags/${checkout.tag}`) === undefined
  ) {
    throw new Error("pinned tag is not durably reachable from canonical origin");
  }
  const mainCommit = refs.get("refs/heads/main");
  if (mainCommit === undefined) {
    throw new Error("canonical origin main is unavailable");
  }
  try {
    await execFileAsync("git", ["merge-base", "--is-ancestor", checkout.commit, mainCommit], {
      cwd: checkout.directory,
    });
  } catch {
    throw new Error("pinned commit is not reachable from canonical origin main");
  }
}

async function verifyCommittedCorpusRegistration(input: {
  checkout: PinnedCheckout;
  corpusDigest: string;
  registrationCommit: string;
}): Promise<void> {
  if (!/^[0-9a-f]{40}$/.test(input.registrationCommit)) {
    throw new Error("registration commit must be a full lowercase SHA-1");
  }
  try {
    await execFileAsync(
      "git",
      ["merge-base", "--is-ancestor", input.registrationCommit, input.checkout.commit],
      { cwd: input.checkout.directory }
    );
  } catch {
    throw new Error("registration commit is not reachable from the authorized checkout");
  }
  const [registrationBytes, digestBytes] = await Promise.all([
    git(input.checkout.directory, ["show", `${input.registrationCommit}:${REGISTRATION_PATH}`]),
    git(input.checkout.directory, [
      "show",
      `${input.registrationCommit}:${REGISTRATION_DIGEST_PATH}`,
    ]),
  ]);
  let registration: unknown;
  try {
    registration = JSON.parse(registrationBytes);
  } catch {
    throw new Error("committed corpus registration is invalid JSON");
  }
  if (
    typeof registration !== "object" ||
    registration === null ||
    Array.isArray(registration) ||
    (registration as Record<string, unknown>).role !== "development" ||
    (registration as Record<string, unknown>).voidForInstrumentFailure !== true ||
    digestBytes !== input.corpusDigest
  ) {
    throw new Error("committed corpus registration does not match authorization");
  }
}

function requireSecret(value: string, label: string): string {
  if (value.length === 0 || value.trim() !== value) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function paidChildEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
  openAIKey: string
): Record<string, string> {
  const child: Record<string, string> = {};
  for (const key of CHILD_ENVIRONMENT_ALLOWLIST) {
    const value = environment[key];
    if (value !== undefined) {
      child[key] = value;
    }
  }
  child.OPENAI_API_KEY = openAIKey;
  child.SAFEWORD_PAID_CANARY_RETRIES = "0";
  return child;
}

export async function runCredentialSeparatedCanary<T>(input: {
  adapterDirectory: string;
  authorization: {
    adapterCommit: string;
    adapterTag: string;
    adapterCanonicalRepository: string;
    corpusDigest: string;
    harnessCommit: string;
    harnessCanonicalRepository: string;
    harnessTag: string;
    registrationCommit: string;
  };
  child: { args: string[]; command: string };
  environment: Readonly<Record<string, string | undefined>>;
  harnessDirectory: string;
  loadGitHubToken(): Promise<string>;
  loadOpenAIKey(): Promise<string>;
  parent(context: {
    dispatch(): Promise<PaidChildResult>;
    githubToken: string;
  }): Promise<T>;
  spawnChild(request: PaidChildRequest): Promise<PaidChildResult>;
}): Promise<T> {
  await Promise.all([
    preflightPinnedCheckout({
      canonicalRepository: input.authorization.adapterCanonicalRepository,
      commit: input.authorization.adapterCommit,
      directory: input.adapterDirectory,
      tag: input.authorization.adapterTag,
    }),
    preflightPinnedCheckout({
      canonicalRepository: input.authorization.harnessCanonicalRepository,
      commit: input.authorization.harnessCommit,
      directory: input.harnessDirectory,
      tag: input.authorization.harnessTag,
    }),
  ]);
  await verifyCommittedCorpusRegistration({
    checkout: {
      canonicalRepository: input.authorization.harnessCanonicalRepository,
      commit: input.authorization.harnessCommit,
      directory: input.harnessDirectory,
      tag: input.authorization.harnessTag,
    },
    corpusDigest: input.authorization.corpusDigest,
    registrationCommit: input.authorization.registrationCommit,
  });

  const githubToken = requireSecret(await input.loadGitHubToken(), "GitHub token");
  const openAIKey = requireSecret(await input.loadOpenAIKey(), "OpenAI API key");
  const dispatch = (): Promise<PaidChildResult> =>
    input.spawnChild({
      args: [...input.child.args],
      command: input.child.command,
      cwd: input.adapterDirectory,
      env: paidChildEnvironment(input.environment, openAIKey),
    });
  return input.parent({ dispatch, githubToken });
}

export async function runTerraPaidCanary(input: {
  adapterCheckout: PinnedCheckout;
  attemptId: string;
  binding: CanaryInitializationBinding;
  createUpstream(githubToken: string): CanaryUpstream;
  environment?: NodeJS.ProcessEnv;
  harnessCheckout: PinnedCheckout;
  inputPath: string;
  intentId: string;
  loadGitHubToken(): Promise<string>;
  loadOpenAIKey(): Promise<string>;
  outputDirectory: string;
  registration: { corpusDigest: string; registrationCommit: string };
}): Promise<Awaited<ReturnType<typeof runCanaryAttempt>>> {
  return runCredentialSeparatedCanary({
    adapterDirectory: input.adapterCheckout.directory,
    authorization: {
      adapterCommit: input.adapterCheckout.commit,
      adapterTag: input.adapterCheckout.tag,
      adapterCanonicalRepository: input.adapterCheckout.canonicalRepository,
      corpusDigest: input.registration.corpusDigest,
      harnessCommit: input.harnessCheckout.commit,
      harnessCanonicalRepository: input.harnessCheckout.canonicalRepository,
      harnessTag: input.harnessCheckout.tag,
      registrationCommit: input.registration.registrationCommit,
    },
    child: createTerraPaidChildCommand({
      harnessDirectory: input.harnessCheckout.directory,
      inputPath: input.inputPath,
    }),
    environment: input.environment ?? process.env,
    harnessDirectory: input.harnessCheckout.directory,
    loadGitHubToken: input.loadGitHubToken,
    loadOpenAIKey: input.loadOpenAIKey,
    parent: ({ dispatch, githubToken }) =>
      runCanaryAttempt({
        attemptId: input.attemptId,
        binding: input.binding,
        dispatch: async () => parseTerraPaidChildResult(await dispatch()),
        intentId: input.intentId,
        outputDirectory: input.outputDirectory,
        upstream: input.createUpstream(githubToken),
      }),
    spawnChild: spawnPaidChild,
  });
}
