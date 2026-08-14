import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";

import {
  type CanaryDispatchContext,
  type CanaryInitializationBinding,
  type CanaryUpstream,
  completeCanaryProviderJournal,
  runCanaryAttempt,
} from "./terra-development-canary";
import type { CanaryAuthorization } from "./terra-github-authorization";
import {
  createAuthenticatedGitHubHttp,
  createGitHubCanaryUpstream,
} from "./terra-github-upstream";

const execFileAsync = promisify(execFile);
const PAID_CHILD_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const GIT_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const CHILD_ENVIRONMENT_ALLOWLIST = [
  "NODE_EXTRA_CA_CERTS",
  "PATH",
  "SSL_CERT_FILE",
  "TMPDIR",
] as const;
const REGISTRATION_PATH =
  ".project/tickets/CWGYH0-pr-review-eval/corpus-registration-development-2026-08-11.json";
const REGISTRATION_DIGEST_PATH =
  ".project/tickets/CWGYH0-pr-review-eval/corpus-registration-development-2026-08-11.sha256";
const PRIMARY_MANIFEST_PATH =
  ".project/tickets/CWGYH0-pr-review-eval/scored-cases-frozen-2026-08-01.json";
const RESERVE_MANIFEST_PATH =
  ".project/tickets/CWGYH0-pr-review-eval/reserve-cases-frozen-2026-08-01.json";

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
  runtime?: { bunInstall?: string; execPath: string; isBun: boolean };
}): { args: string[]; command: string } {
  if (!isAbsolute(input.harnessDirectory) || !isAbsolute(input.inputPath)) {
    throw new Error("paid child paths must be absolute");
  }
  const runtime = input.runtime ?? {
    bunInstall: process.env.BUN_INSTALL,
    execPath: process.execPath,
    isBun: process.versions.bun !== undefined,
  };
  const command =
    runtime.isBun
      ? runtime.execPath
      : runtime.bunInstall === undefined
        ? ""
        : join(runtime.bunInstall, "bin/bun");
  if (!isAbsolute(command)) {
    throw new Error("an absolute Bun runtime path is required");
  }
  return {
    args: [
      join(
        input.harnessDirectory,
        ".project/tickets/Y4ZAAY-prove-cross-provider-review-before-scaling-spend/terra-paid-child.ts"
      ),
      input.inputPath,
    ],
    command,
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

export async function reconcilePaidChildEvidence(
  context: CanaryDispatchContext,
  reported: ReturnType<typeof parseTerraPaidChildResult>
): Promise<ReturnType<typeof parseTerraPaidChildResult>> {
  const retained = await completeCanaryProviderJournal(context);
  if (
    reported.attemptCostPicodollars !== retained.attemptCostPicodollars ||
    reported.nativeUsageBytes !== retained.nativeUsageBytes ||
    reported.rawResponseBytes !== retained.rawResponseBytes
  ) {
    throw new Error("paid child evidence does not match its durable turn journal");
  }
  return retained;
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
      maxBuffer: GIT_MAX_BUFFER_BYTES,
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

const ALLOW_SYNTHETIC_TEST_REMOTE = Symbol("allow-synthetic-test-remote");

async function preflightPinnedCheckoutInternal(
  checkout: PinnedCheckout,
  testRemote?: typeof ALLOW_SYNTHETIC_TEST_REMOTE
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

  const [head, status, tagType, taggedCommit, originUrl, effectiveOriginUrl] =
    await Promise.all([
    git(checkout.directory, ["rev-parse", "--verify", "HEAD"]),
    git(checkout.directory, ["status", "--porcelain=v1", "--untracked-files=all"]),
    git(checkout.directory, ["cat-file", "-t", `refs/tags/${checkout.tag}`]),
    git(checkout.directory, [
      "rev-parse",
      "--verify",
      `refs/tags/${checkout.tag}^{commit}`,
    ]),
    git(checkout.directory, ["config", "--get", "remote.origin.url"]),
    git(checkout.directory, ["remote", "get-url", "origin"]),
  ]);
  const expectedOriginUrl = canonicalRepositoryUrl(checkout.canonicalRepository);
  if (
    originUrl !== expectedOriginUrl ||
    (testRemote !== ALLOW_SYNTHETIC_TEST_REMOTE &&
      effectiveOriginUrl !== expectedOriginUrl)
  ) {
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
  const remoteRefs = await git(checkout.directory, [
    "ls-remote",
    "origin",
    "refs/heads/main",
    `refs/tags/${checkout.tag}`,
    `refs/tags/${checkout.tag}^{}`,
  ]);
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
    await execFileAsync(
      "git",
      ["fetch", "--quiet", "--no-tags", "origin", "refs/heads/main"],
      { cwd: checkout.directory, maxBuffer: GIT_MAX_BUFFER_BYTES }
    );
    const fetchedMain = await git(checkout.directory, [
      "rev-parse",
      "--verify",
      "FETCH_HEAD",
    ]);
    if (fetchedMain !== mainCommit) {
      throw new Error("fetched canonical main does not match its advertised ref");
    }
    await execFileAsync(
      "git",
      ["merge-base", "--is-ancestor", checkout.commit, mainCommit],
      { cwd: checkout.directory, maxBuffer: GIT_MAX_BUFFER_BYTES }
    );
  } catch {
    throw new Error("pinned commit is not reachable from canonical origin main");
  }
}

export async function preflightPinnedCheckout(
  checkout: PinnedCheckout
): Promise<void> {
  return preflightPinnedCheckoutInternal(checkout);
}

type CorpusRegistration = {
  developmentCaseIds: string[];
  primaryManifestSha256: string;
  reserveManifestSha256: string;
};

async function gitBytes(directory: string, objectPath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["show", objectPath], {
      cwd: directory,
      encoding: "utf8",
      maxBuffer: GIT_MAX_BUFFER_BYTES,
    });
    return stdout;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`committed corpus evidence is unavailable: ${detail}`);
  }
}

export async function verifyCommittedCorpusRegistration(input: {
  checkout: PinnedCheckout;
  corpusDigest: string;
  registrationCommit: string;
}): Promise<CorpusRegistration> {
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
    gitBytes(input.checkout.directory, `${input.registrationCommit}:${REGISTRATION_PATH}`),
    gitBytes(input.checkout.directory, `${input.registrationCommit}:${REGISTRATION_DIGEST_PATH}`),
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
    !Array.isArray((registration as Record<string, unknown>).developmentCaseIds) ||
    typeof (registration as Record<string, unknown>).primaryManifestSha256 !== "string" ||
    typeof (registration as Record<string, unknown>).reserveManifestSha256 !== "string" ||
    digestBytes.trim() !== input.corpusDigest ||
    createHash("sha256").update(registrationBytes).digest("hex") !== input.corpusDigest
  ) {
    throw new Error("committed corpus registration does not match authorization");
  }
  return registration as CorpusRegistration;
}

export async function verifyAuthorizedPaidChildInput(input: {
  checkout: PinnedCheckout;
  expectedContext?: CanaryDispatchContext;
  inputPath: string;
  registration: CorpusRegistration;
  registrationCommit: string;
}): Promise<string> {
  const [inputBytes, primaryBytes, reserveBytes] = await Promise.all([
    readFile(input.inputPath, "utf8"),
    gitBytes(input.checkout.directory, `${input.registrationCommit}:${PRIMARY_MANIFEST_PATH}`),
    gitBytes(input.checkout.directory, `${input.registrationCommit}:${RESERVE_MANIFEST_PATH}`),
  ]);
  if (
    createHash("sha256").update(primaryBytes).digest("hex") !==
      input.registration.primaryManifestSha256 ||
    createHash("sha256").update(reserveBytes).digest("hex") !==
      input.registration.reserveManifestSha256
  ) {
    throw new Error("committed corpus manifest digest does not match registration");
  }
  let request: Record<string, unknown>;
  try {
    request = JSON.parse(inputBytes) as Record<string, unknown>;
  } catch {
    throw new Error("paid child input is invalid JSON");
  }
  const exactKeys = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === [...keys].sort().join(",");
  if (!exactKeys(request, ["context", "expertsDirectory", "policy", "review", "target"])) {
    throw new Error("paid child input has unexpected or missing fields");
  }
  const context = request.context;
  const policy = request.policy;
  const target = request.target;
  if (
    !exactKeys(context, ["attemptId", "intentId", "outputDirectory", "sequence"]) ||
    typeof context.attemptId !== "string" ||
    typeof context.intentId !== "string" ||
    typeof context.outputDirectory !== "string" ||
    !isAbsolute(context.outputDirectory) ||
    !Number.isSafeInteger(context.sequence) ||
    !exactKeys(policy, ["maxVerifications", "toolCallsPerExpert", "wallClockMsPerExpert"]) ||
    Object.values(policy).some((value) => !Number.isSafeInteger(value) || (value as number) <= 0) ||
    !exactKeys(target, ["baseRef", "root"]) ||
    typeof target.baseRef !== "string" ||
    target.baseRef.length === 0 ||
    typeof target.root !== "string" ||
    !isAbsolute(target.root) ||
    typeof request.expertsDirectory !== "string" ||
    !isAbsolute(request.expertsDirectory)
  ) {
    throw new Error("paid child input has an invalid execution contract");
  }
  if (
    input.expectedContext !== undefined &&
    canonicalJson(context) !== canonicalJson(input.expectedContext)
  ) {
    throw new Error("paid child context does not match the authorized attempt");
  }
  const review = request.review as Record<string, unknown> | undefined;
  if (!exactKeys(review, [
    "caseId",
    "causalPaths",
    "failureDescription",
    "modelCutoff",
    "reviewBaseSha",
    "runnerRef",
    "sourceSha",
    "variant",
  ])) {
    throw new Error("paid child review has unexpected or missing fields");
  }
  const caseId = review?.caseId;
  if (typeof caseId !== "string" || !input.registration.developmentCaseIds.includes(caseId)) {
    throw new Error("paid child case is not authorized by the corpus registration");
  }
  const manifests = [JSON.parse(primaryBytes), JSON.parse(reserveBytes)] as Array<{
    cases?: Array<Record<string, unknown>>;
    modelCutoff?: unknown;
    runnerRef?: unknown;
  }>;
  const manifest = manifests.find((candidate) => candidate.cases?.some((item) => item.id === caseId));
  const corpusCase = manifest?.cases?.find((item) => item.id === caseId);
  const variant = review?.variant;
  const expectedSourceSha =
    variant === "buggy" ? corpusCase?.baseSha : variant === "fixed" ? corpusCase?.fixedSha : undefined;
  if (
    corpusCase === undefined ||
    review?.reviewBaseSha !== corpusCase.reviewBaseSha ||
    review?.sourceSha !== expectedSourceSha ||
    review?.modelCutoff !== manifest?.modelCutoff ||
    review?.runnerRef !== manifest?.runnerRef ||
    canonicalJson(review?.causalPaths) !== canonicalJson(corpusCase.causalPaths) ||
    canonicalJson(review?.failureDescription) !== canonicalJson(corpusCase.failureDescription)
  ) {
    throw new Error("paid child review does not match its frozen corpus case");
  }
  return createHash("sha256").update(inputBytes).digest("hex");
}

function canonicalJson(value: unknown): string | undefined {
  const canonicalize = (item: unknown): unknown => {
    if (Array.isArray(item)) {
      return item.map(canonicalize);
    }
    if (typeof item === "object" && item !== null) {
      return Object.fromEntries(
        Object.entries(item)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, canonicalize(nested)])
      );
    }
    return item;
  };
  return JSON.stringify(canonicalize(value));
}

function requireAuthorizedCheckouts(input: {
  adapterCheckout: PinnedCheckout;
  binding: CanaryInitializationBinding;
  harnessCheckout: PinnedCheckout;
  registration: { corpusDigest: string };
}): void {
  const { adapterCheckout, binding, harnessCheckout } = input;
  if (
    adapterCheckout.canonicalRepository !== binding.canonicalRepository ||
    harnessCheckout.canonicalRepository !== binding.canonicalRepository ||
    adapterCheckout.commit !== binding.adapterCommit ||
    adapterCheckout.tag !== binding.adapterTag ||
    harnessCheckout.commit !== binding.harnessCommit ||
    harnessCheckout.tag !== binding.harnessTag ||
    input.registration.corpusDigest !== binding.corpusDigest
  ) {
    throw new Error("pinned checkouts do not match the canary authorization");
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
  inputDigest: string,
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
  child.SAFEWORD_PAID_CANARY_INPUT_SHA256 = inputDigest;
  child.SAFEWORD_PAID_CANARY_RETRIES = "0";
  return child;
}

async function runCredentialedChild<T>(input: {
  adapterDirectory: string;
  child: { args: string[]; command: string };
  environment: Readonly<Record<string, string | undefined>>;
  inputDigest: string;
  loadGitHubToken(): Promise<string>;
  loadOpenAIKey(): Promise<string>;
  parent(context: {
    dispatch(): Promise<PaidChildResult>;
    githubToken: string;
  }): Promise<T>;
  spawnChild(request: PaidChildRequest): Promise<PaidChildResult>;
}): Promise<T> {
  const githubToken = requireSecret(await input.loadGitHubToken(), "GitHub token");
  const openAIKey = requireSecret(await input.loadOpenAIKey(), "OpenAI API key");
  const dispatch = (): Promise<PaidChildResult> =>
    input.spawnChild({
      args: [...input.child.args],
      command: input.child.command,
      cwd: input.adapterDirectory,
      env: paidChildEnvironment(input.environment, input.inputDigest, openAIKey),
    });
  return input.parent({ dispatch, githubToken });
}

type TerraPaidCanaryInput = {
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
  spawnChild?: (request: PaidChildRequest) => Promise<PaidChildResult>;
};

async function runTerraPaidCanaryInternal(
  input: TerraPaidCanaryInput,
  testRemote?: typeof ALLOW_SYNTHETIC_TEST_REMOTE
): Promise<Awaited<ReturnType<typeof runCanaryAttempt>>> {
  requireAuthorizedCheckouts(input);
  await Promise.all([
    preflightPinnedCheckoutInternal(input.adapterCheckout, testRemote),
    preflightPinnedCheckoutInternal(input.harnessCheckout, testRemote),
  ]);
  const registration = await verifyCommittedCorpusRegistration({
    checkout: input.harnessCheckout,
    corpusDigest: input.registration.corpusDigest,
    registrationCommit: input.registration.registrationCommit,
  });
  const inputDigest = await verifyAuthorizedPaidChildInput({
    checkout: input.harnessCheckout,
    inputPath: input.inputPath,
    registration,
    registrationCommit: input.registration.registrationCommit,
  });
  let preparedContext: CanaryDispatchContext | undefined;
  return runCredentialedChild({
    adapterDirectory: input.adapterCheckout.directory,
    child: createTerraPaidChildCommand({
      harnessDirectory: input.harnessCheckout.directory,
      inputPath: input.inputPath,
    }),
    environment: input.environment ?? process.env,
    inputDigest,
    loadGitHubToken: input.loadGitHubToken,
    loadOpenAIKey: input.loadOpenAIKey,
    parent: ({ dispatch, githubToken }) =>
      runCanaryAttempt({
        attemptId: input.attemptId,
        binding: input.binding,
        dispatch: async () => {
          if (preparedContext === undefined) {
            throw new Error("paid child dispatch was not prepared");
          }
          await Promise.all([
            preflightPinnedCheckoutInternal(input.adapterCheckout, testRemote),
            preflightPinnedCheckoutInternal(input.harnessCheckout, testRemote),
          ]);
          const dispatchDigest = await verifyAuthorizedPaidChildInput({
            checkout: input.harnessCheckout,
            expectedContext: preparedContext,
            inputPath: input.inputPath,
            registration,
            registrationCommit: input.registration.registrationCommit,
          });
          if (dispatchDigest !== inputDigest) {
            throw new Error("paid child input changed at dispatch");
          }
          return reconcilePaidChildEvidence(
            preparedContext,
            parseTerraPaidChildResult(await dispatch())
          );
        },
        intentId: input.intentId,
        outputDirectory: input.outputDirectory,
        prepare: async (context) => {
          const preparedDigest = await verifyAuthorizedPaidChildInput({
            checkout: input.harnessCheckout,
            expectedContext: context,
            inputPath: input.inputPath,
            registration,
            registrationCommit: input.registration.registrationCommit,
          });
          if (preparedDigest !== inputDigest) {
            throw new Error("paid child input changed during authorization");
          }
          preparedContext = context;
        },
        upstream: input.createUpstream(githubToken),
      }),
    spawnChild: input.spawnChild ?? spawnPaidChild,
  });
}

export async function runTerraPaidCanary(
  input: TerraPaidCanaryInput
): Promise<Awaited<ReturnType<typeof runCanaryAttempt>>> {
  return runTerraPaidCanaryInternal(input);
}

type AuthorizedTerraPaidCanaryInput = {
  adapterCheckout: PinnedCheckout;
  allowlistedMaintainers: readonly string[];
  attemptId: string;
  authorization: CanaryAuthorization;
  createUpstream?: (binding: CanaryInitializationBinding, githubToken: string) => CanaryUpstream;
  environment?: NodeJS.ProcessEnv;
  fetch?: typeof globalThis.fetch;
  harnessCheckout: PinnedCheckout;
  inputPath: string;
  intentId: string;
  issueNumber: number;
  loadGitHubToken(): Promise<string>;
  loadOpenAIKey(): Promise<string>;
  outputDirectory: string;
  spawnChild?: (request: PaidChildRequest) => Promise<PaidChildResult>;
};

async function runAuthorizedTerraPaidCanaryInternal(
  input: AuthorizedTerraPaidCanaryInput,
  testRemote?: typeof ALLOW_SYNTHETIC_TEST_REMOTE
): Promise<Awaited<ReturnType<typeof runCanaryAttempt>>> {
  const binding: CanaryInitializationBinding = {
    adapterCommit: input.authorization.adapterCommit,
    adapterTag: input.authorization.adapterTag,
    attemptLimit: input.authorization.attemptLimit,
    canonicalRepository: input.authorization.canonicalRepository,
    corpusDigest: input.authorization.corpusDigest,
    costLimitPicodollars: input.authorization.costLimitPicodollars,
    harnessCommit: input.authorization.harnessCommit,
    harnessTag: input.authorization.harnessTag,
    model: input.authorization.model,
    outputIdentity: input.authorization.outputIdentity,
    receiptBudget: input.authorization.receiptBudget,
    serviceTier: input.authorization.serviceTier,
    ticketId: input.authorization.ticketId,
  };
  return runTerraPaidCanaryInternal({
    adapterCheckout: input.adapterCheckout,
    attemptId: input.attemptId,
    binding,
    createUpstream: (githubToken) =>
      input.createUpstream === undefined
        ? createGitHubCanaryUpstream({
        allowlistedMaintainers: input.allowlistedMaintainers,
        authorization: input.authorization,
        http: createAuthenticatedGitHubHttp({ fetch: input.fetch, token: githubToken }),
        issueNumber: input.issueNumber,
        nextReceiptId: randomUUID,
          })
        : input.createUpstream(binding, githubToken),
    environment: input.environment,
    harnessCheckout: input.harnessCheckout,
    inputPath: input.inputPath,
    intentId: input.intentId,
    loadGitHubToken: input.loadGitHubToken,
    loadOpenAIKey: input.loadOpenAIKey,
    outputDirectory: input.outputDirectory,
    registration: {
      corpusDigest: input.authorization.corpusDigest,
      registrationCommit: input.authorization.registrationCommit,
    },
    ...(input.spawnChild === undefined ? {} : { spawnChild: input.spawnChild }),
  }, testRemote);
}

export async function runAuthorizedTerraPaidCanary(
  input: AuthorizedTerraPaidCanaryInput
): Promise<Awaited<ReturnType<typeof runCanaryAttempt>>> {
  return runAuthorizedTerraPaidCanaryInternal(input);
}

export const terraLiveLauncherTestSupport = {
  preflightPinnedCheckout: (checkout: PinnedCheckout): Promise<void> =>
    preflightPinnedCheckoutInternal(checkout, ALLOW_SYNTHETIC_TEST_REMOTE),
  runAuthorizedTerraPaidCanary: (
    input: AuthorizedTerraPaidCanaryInput
  ): Promise<Awaited<ReturnType<typeof runCanaryAttempt>>> =>
    runAuthorizedTerraPaidCanaryInternal(input, ALLOW_SYNTHETIC_TEST_REMOTE),
  runTerraPaidCanary: (
    input: TerraPaidCanaryInput
  ): Promise<Awaited<ReturnType<typeof runCanaryAttempt>>> =>
    runTerraPaidCanaryInternal(input, ALLOW_SYNTHETIC_TEST_REMOTE),
};
