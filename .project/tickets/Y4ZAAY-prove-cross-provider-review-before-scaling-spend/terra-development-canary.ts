import { createHash } from "node:crypto";
import { lstat, mkdir, open, readFile, stat, unlink } from "node:fs/promises";
import { join } from "node:path";

import { priceProviderInventory } from "./terra-canary-evidence";

export const PICODOLLARS_PER_DOLLAR = 1_000_000_000_000n;
export const INITIALIZATION_MARKER = "initialization.json";
export const ATTEMPT_JOURNAL = "attempts.jsonl";
export const COST_JOURNAL = "cost.jsonl";
export const EVIDENCE_DIRECTORY = "attempt-evidence";
export const CANARY_LOCK = "canary.lock";
export const PROVIDER_TURN_JOURNAL_SUFFIX = ".turns.jsonl";

type CanaryProviderStage = "finding-verification" | "repository-reading";

export type CanaryDispatchContext = {
  attemptId: string;
  intentId: string;
  outputDirectory: string;
  sequence: number;
};

export type CanaryProviderTurnIntent = {
  endpoint: string;
  intentId: string;
  requestBody: Record<string, unknown>;
  requestedModel: string;
  requestedServiceTier: "default";
  stage: CanaryProviderStage;
};

export type CanaryProviderTurnResponse = {
  errorMessage: string | null;
  errorName: string | null;
  httpStatus: number | null;
  intentId: string;
  nativeUsage: unknown;
  outcome: "response" | "transport-error";
  rawBody: string;
  requestId: string | null;
  responseId: string | null;
  returnedModel: string | null;
  returnedServiceTier: string | null;
  stage: CanaryProviderStage;
};

export type CanaryInitializationBinding = {
  adapterCommit: string;
  adapterTag: string;
  attemptLimit: number;
  canonicalRepository: string;
  corpusDigest: string;
  costLimitPicodollars: string;
  harnessCommit: string;
  harnessTag: string;
  model: "gpt-5.6-terra";
  outputIdentity: string;
  receiptBudget: number;
  serviceTier: "default";
  ticketId: string;
};

export type CanaryInitializationReceipt = {
  authorizationId: string;
  bindingDigest: string;
  observedCostPicodollars: "0";
  receiptId: string;
  startedAttempts: 0;
};

export type CanaryUpstreamHead = {
  observedCostPicodollars: string;
  startedAttempts: number;
};

export type CanaryAttemptStartReceipt = {
  attemptId: string;
  intentId: string;
  receiptId: string;
  sequence: number;
  startedAttempts: number;
};

export type CanaryAttemptCompletionReceipt = {
  attemptCostPicodollars: string;
  attemptId: string;
  nativeUsageDigest: string;
  observedCostPicodollars: string;
  receiptId: string;
  responseDigest: string;
  sequence: number;
  startReceiptId: string;
};

export type CanaryUpstreamSnapshot =
  | { authorizationId: string; kind: "ready" }
  | {
      head: CanaryUpstreamHead;
      kind: "consumed";
      receipt: CanaryInitializationReceipt;
      starts: CanaryAttemptStartReceipt[];
      completions: CanaryAttemptCompletionReceipt[];
    }
  | { kind: "unavailable" | "unreadable" };

export type CanaryUpstream = {
  consumeInitialization(input: {
    authorizationId: string;
    bindingDigest: string;
  }): Promise<CanaryInitializationReceipt>;
  inspect(bindingDigest: string): Promise<CanaryUpstreamSnapshot>;
  postAttemptStart(input: {
    attemptId: string;
    bindingDigest: string;
    intentId: string;
    sequence: number;
  }): Promise<CanaryAttemptStartReceipt>;
  postAttemptCompletion(input: {
    attemptCostPicodollars: string;
    attemptId: string;
    bindingDigest: string;
    nativeUsageDigest: string;
    observedCostPicodollars: string;
    responseDigest: string;
    sequence: number;
    startReceiptId: string;
  }): Promise<CanaryAttemptCompletionReceipt>;
};

export type CanaryAccountingInspection = {
  attemptAccountingComplete: boolean;
  authorizationPresent: boolean;
  costAccountingComplete: boolean;
  observedCostPicodollars: bigint;
  startedAttempts: number;
};

export type CanaryStopReason =
  | "attempt-stop"
  | "cost-stop"
  | "incomplete-attempt-accounting"
  | "incomplete-cost-accounting"
  | "missing-authorization";

export type CanaryDecision =
  | { eligible: true; reasons: ["eligible"] }
  | { eligible: false; reasons: CanaryStopReason[] };

export type CanaryDecisionInput = {
  attemptAccountingComplete: boolean;
  attemptLimit: number;
  authorizationPresent: boolean;
  costAccountingComplete: boolean;
  costLimitPicodollars: bigint;
  observedCostPicodollars: bigint;
  startedAttempts: number;
};

function requireBoolean(value: unknown, label: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be boolean`);
  }
}

function requireCount(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function requirePicodollars(
  value: unknown,
  label: string
): asserts value is bigint {
  if (typeof value !== "bigint" || value < 0n) {
    throw new Error(`${label} must be a non-negative bigint`);
  }
}

export function decideCanaryDispatch(
  input: CanaryDecisionInput
): CanaryDecision {
  requireBoolean(
    input.attemptAccountingComplete,
    "attemptAccountingComplete"
  );
  requireCount(input.attemptLimit, "attemptLimit");
  requireBoolean(input.authorizationPresent, "authorizationPresent");
  requireBoolean(input.costAccountingComplete, "costAccountingComplete");
  requirePicodollars(input.costLimitPicodollars, "costLimitPicodollars");
  requirePicodollars(
    input.observedCostPicodollars,
    "observedCostPicodollars"
  );
  requireCount(input.startedAttempts, "startedAttempts");

  const reasons: CanaryStopReason[] = [];
  if (
    input.attemptAccountingComplete &&
    input.startedAttempts >= input.attemptLimit
  ) {
    reasons.push("attempt-stop");
  }
  if (
    input.costAccountingComplete &&
    input.observedCostPicodollars >= input.costLimitPicodollars
  ) {
    reasons.push("cost-stop");
  }
  if (!input.attemptAccountingComplete) {
    reasons.push("incomplete-attempt-accounting");
  }
  if (!input.costAccountingComplete) {
    reasons.push("incomplete-cost-accounting");
  }
  if (!input.authorizationPresent) {
    reasons.push("missing-authorization");
  }

  return reasons.length === 0
    ? { eligible: true, reasons: ["eligible"] }
    : { eligible: false, reasons };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

export function canaryBindingDigest(
  binding: CanaryInitializationBinding
): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(binding)))
    .digest("hex");
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function syncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writeExclusiveJson(
  directory: string,
  name: string,
  value: unknown
): Promise<void> {
  const handle = await open(join(directory, name), "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory(directory);
}

async function appendDurableJsonLine(
  directory: string,
  name: string,
  value: unknown
): Promise<void> {
  const handle = await open(join(directory, name), "r+");
  try {
    const current = await handle.stat();
    const bytes = Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesWritten } = await handle.write(
        bytes,
        offset,
        bytes.length - offset,
        current.size + offset
      );
      if (bytesWritten === 0) {
        throw new Error(`could not append complete ${name} record`);
      }
      offset += bytesWritten;
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writeExclusiveBytes(
  directory: string,
  name: string,
  bytes: string
): Promise<void> {
  const handle = await open(join(directory, name), "wx", 0o600);
  try {
    await handle.writeFile(bytes, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory(directory);
}

async function ensureEvidenceDirectory(outputDirectory: string): Promise<void> {
  const directory = join(outputDirectory, EVIDENCE_DIRECTORY);
  try {
    await mkdir(directory, { mode: 0o700 });
    await syncDirectory(outputDirectory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }
  const details = await lstat(directory);
  if (details.isSymbolicLink() || !details.isDirectory()) {
    throw new Error("attempt evidence path must be a real directory");
  }
}

async function ensureOutputDirectory(outputDirectory: string): Promise<void> {
  await mkdir(outputDirectory, { mode: 0o700, recursive: true });
  const details = await lstat(outputDirectory);
  if (details.isSymbolicLink() || !details.isDirectory()) {
    throw new Error("canary output path must be a real directory");
  }
}

async function requireUnredirectedOutputPath(outputDirectory: string): Promise<void> {
  try {
    if ((await lstat(outputDirectory)).isSymbolicLink()) {
      throw new Error("canary output path must be a real directory");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

function validateReceipt(
  receipt: CanaryInitializationReceipt,
  expected: { authorizationId?: string; bindingDigest: string }
): void {
  const record = receipt as unknown as Record<string, unknown>;
  if (
    typeof receipt !== "object" ||
    receipt === null ||
    !hasExactKeys(record, [
      "authorizationId",
      "bindingDigest",
      "observedCostPicodollars",
      "receiptId",
      "startedAttempts",
    ]) ||
    typeof receipt.authorizationId !== "string" ||
    receipt.authorizationId.length === 0 ||
    (expected.authorizationId !== undefined &&
      receipt.authorizationId !== expected.authorizationId) ||
    receipt.bindingDigest !== expected.bindingDigest ||
    receipt.observedCostPicodollars !== "0" ||
    typeof receipt.receiptId !== "string" ||
    receipt.receiptId.length === 0 ||
    receipt.startedAttempts !== 0
  ) {
    throw new Error("upstream initialization receipt is invalid");
  }
}

function validateHead(
  head: CanaryUpstreamHead,
  binding?: Pick<CanaryInitializationBinding, "attemptLimit" | "receiptBudget">
): void {
  const record = head as unknown as Record<string, unknown>;
  if (
    !hasExactKeys(record, ["observedCostPicodollars", "startedAttempts"]) ||
    !Number.isSafeInteger(head.startedAttempts) ||
    head.startedAttempts < 0 ||
    (binding !== undefined &&
      (head.startedAttempts > binding.attemptLimit ||
        1 + head.startedAttempts > binding.receiptBudget)) ||
    !/^(0|[1-9]\d*)$/.test(head.observedCostPicodollars)
  ) {
    throw new Error("upstream accounting head is invalid");
  }
}

async function initializeCanaryWhileLocked(input: {
  binding: CanaryInitializationBinding;
  outputDirectory: string;
  upstream: CanaryUpstream;
}): Promise<{
  observedCostPicodollars: 0n;
  receiptId: string;
  startedAttempts: 0;
}> {
  const digest = canaryBindingDigest(input.binding);
  const snapshot = await input.upstream.inspect(digest);
  if (snapshot.kind === "unavailable" || snapshot.kind === "unreadable") {
    throw new Error(`trusted upstream state is ${snapshot.kind}`);
  }
  if (snapshot.kind === "consumed") {
    throw new Error("initialization authorization is already consumed");
  }

  const targetPaths = [
    INITIALIZATION_MARKER,
    ATTEMPT_JOURNAL,
    COST_JOURNAL,
  ].map((name) => join(input.outputDirectory, name));
  if ((await Promise.all(targetPaths.map(exists))).some(Boolean)) {
    throw new Error("local canary initialization state already exists");
  }

  // The irreversible trust-root write happens before any local state exists.
  // A crash after this point deliberately bricks this output identity rather
  // than leaving reusable authorization that could reset paid accounting.
  const receipt = await input.upstream.consumeInitialization({
    authorizationId: snapshot.authorizationId,
    bindingDigest: digest,
  });
  validateReceipt(receipt, {
    authorizationId: snapshot.authorizationId,
    bindingDigest: digest,
  });

  await ensureOutputDirectory(input.outputDirectory);
  await writeExclusiveJson(input.outputDirectory, INITIALIZATION_MARKER, {
    authorizationId: receipt.authorizationId,
    bindingDigest: digest,
    kind: "canary-initialization",
    receiptId: receipt.receiptId,
  });
  await writeExclusiveJson(input.outputDirectory, ATTEMPT_JOURNAL, {
    initializationReceiptId: receipt.receiptId,
    kind: "attempt-genesis",
    startedAttempts: 0,
  });
  await writeExclusiveJson(input.outputDirectory, COST_JOURNAL, {
    accountingComplete: true,
    initializationReceiptId: receipt.receiptId,
    kind: "cost-genesis",
    observedCostPicodollars: "0",
  });
  return {
    observedCostPicodollars: 0n,
    receiptId: receipt.receiptId,
    startedAttempts: 0,
  };
}

export async function initializeCanary(input: {
  binding: CanaryInitializationBinding;
  outputDirectory: string;
  upstream: CanaryUpstream;
}): Promise<{
  observedCostPicodollars: 0n;
  receiptId: string;
  startedAttempts: 0;
}> {
  await requireUnredirectedOutputPath(input.outputDirectory);
  await ensureOutputDirectory(input.outputDirectory);
  return withCanaryLock(input.outputDirectory, () =>
    initializeCanaryWhileLocked(input)
  );
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[]
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function parseSingleRecord(
  bytes: string,
  label: string
): Record<string, unknown> {
  const lines = bytes.split("\n");
  if (lines.length !== 2 || lines[0] === "" || lines[1] !== "") {
    throw new Error(`${label} must contain exactly one genesis record`);
  }
  let value: unknown;
  try {
    value = JSON.parse(lines[0]);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} record must be an object`);
  }
  return value as Record<string, unknown>;
}

async function readRecord(
  directory: string,
  name: string
): Promise<Record<string, unknown> | null> {
  try {
    return parseSingleRecord(
      await readFile(join(directory, name), "utf8"),
      name
    );
  } catch {
    return null;
  }
}

function parseRecordLines(
  bytes: string,
  label: string
): Record<string, unknown>[] {
  const lines = bytes.split("\n");
  if (lines.length < 2 || lines.at(-1) !== "" || lines.slice(0, -1).some((line) => line === "")) {
    throw new Error(`${label} must be newline-terminated JSONL without blank lines`);
  }
  return lines.slice(0, -1).map((line) => {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new Error(`${label} contains invalid JSON`);
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`${label} records must be objects`);
    }
    return value as Record<string, unknown>;
  });
}

async function readRecords(
  directory: string,
  name: string
): Promise<Record<string, unknown>[] | null> {
  try {
    return parseRecordLines(await readFile(join(directory, name), "utf8"), name);
  } catch {
    return null;
  }
}

export async function completeCanaryProviderJournal(
  input: CanaryDispatchContext
): Promise<{
  attemptCostPicodollars: bigint;
  nativeUsageBytes: string;
  rawResponseBytes: string;
}> {
  if (!isSafeIdentifier(input.attemptId) || !isSafeIdentifier(input.intentId)) {
    throw new Error("attemptId and intentId must be safe identifiers");
  }
  const directory = join(input.outputDirectory, EVIDENCE_DIRECTORY);
  const name = `${input.attemptId}${PROVIDER_TURN_JOURNAL_SUFFIX}`;
  const records = await readRecords(directory, name);
  if (records === null || records.length < 3) {
    throw new Error("provider turn journal is incomplete");
  }
  const [intent, ...turns] = records;
  if (
    intent?.kind !== "attempt-intent" ||
    intent.attemptId !== input.attemptId ||
    intent.intentId !== input.intentId ||
    intent.sequence !== input.sequence
  ) {
    throw new Error("provider turn journal has an invalid attempt intent");
  }
  const requests = turns
    .filter((record) => record.kind === "provider-turn-intent")
    .map((record) => ({
      endpoint: record.endpoint,
      intentId: record.attemptIntentId,
      model: record.requestedModel,
      sequence: record.sequence,
      serviceTier: record.requestedServiceTier,
      stage: record.stage,
      turnIntentId: record.turnIntentId,
    }));
  const responses = turns
    .filter((record) => record.kind === "provider-turn-response")
    .map((record) => ({
      errorMessage: record.errorMessage,
      errorName: record.errorName,
      httpStatus: record.httpStatus,
      intentId: record.attemptIntentId,
      nativeUsage: record.nativeUsage,
      outcome: record.outcome,
      rawBody: record.rawBody,
      requestId: record.requestId,
      responseId: record.responseId,
      returnedModel: record.returnedModel,
      returnedServiceTier: record.returnedServiceTier,
      sequence: record.sequence,
      stage: record.stage,
      turnIntentId: record.turnIntentId,
    }));
  if (
    turns.some(
      (record) =>
        record.kind !== "provider-turn-intent" &&
        record.kind !== "provider-turn-response"
    )
  ) {
    throw new Error("provider turn journal contains an unknown record");
  }
  const inventory = {
    intent: {
      attemptId: intent?.attemptId,
      intentId: intent?.intentId,
      sequence: intent?.sequence,
    },
    requests,
    responses,
  };
  const validated = priceProviderInventory(inventory);
  if (
    validated.attemptId !== input.attemptId ||
    validated.intentId !== input.intentId
  ) {
    throw new Error("provider inventory belongs to a different attempt");
  }
  return {
    attemptCostPicodollars: validated.totalCostPicodollars,
    nativeUsageBytes: JSON.stringify({
      turns: validated.turns.map((turn) => ({
        rawUsage: turn.rawUsage,
        requestId: turn.requestId,
        responseId: turn.responseId,
        stage: turn.stage,
      })),
    }),
    rawResponseBytes: JSON.stringify(inventory),
  };
}

export async function createCanaryProviderRecorder(
  input: CanaryDispatchContext
): Promise<{
  complete(): Promise<{
    attemptCostPicodollars: bigint;
    nativeUsageBytes: string;
    rawResponseBytes: string;
  }>;
  journalPath: string;
  recordIntent(intent: CanaryProviderTurnIntent): Promise<void>;
  recordResponse(response: CanaryProviderTurnResponse): Promise<void>;
}> {
  if (!isSafeIdentifier(input.attemptId) || !isSafeIdentifier(input.intentId)) {
    throw new Error("attemptId and intentId must be safe identifiers");
  }
  await ensureEvidenceDirectory(input.outputDirectory);
  const directory = join(input.outputDirectory, EVIDENCE_DIRECTORY);
  const name = `${input.attemptId}${PROVIDER_TURN_JOURNAL_SUFFIX}`;
  const journalPath = join(directory, name);
  let nextSequence = 2;
  let appendQueue = Promise.resolve();
  const appendRecord = (value: unknown): Promise<void> => {
    const pending = appendQueue.then(() =>
      appendDurableJsonLine(directory, name, value)
    );
    appendQueue = pending.catch(() => undefined);
    return pending;
  };
  await writeExclusiveJson(directory, name, {
    attemptId: input.attemptId,
    intentId: input.intentId,
    kind: "attempt-intent",
    sequence: 1,
  });

  return {
    complete: () => completeCanaryProviderJournal(input),
    journalPath,
    recordIntent: async (intent) => {
      await appendRecord({
        attemptId: input.attemptId,
        attemptIntentId: input.intentId,
        endpoint: intent.endpoint,
        kind: "provider-turn-intent",
        requestBody: intent.requestBody,
        requestedModel: intent.requestedModel,
        requestedServiceTier: intent.requestedServiceTier,
        sequence: nextSequence++,
        stage: intent.stage,
        turnIntentId: intent.intentId,
      });
    },
    recordResponse: async (response) => {
      await appendRecord({
        attemptId: input.attemptId,
        attemptIntentId: input.intentId,
        errorMessage: response.errorMessage,
        errorName: response.errorName,
        httpStatus: response.httpStatus,
        kind: "provider-turn-response",
        nativeUsage: response.nativeUsage,
        outcome: response.outcome,
        rawBody: response.rawBody,
        requestId: response.requestId,
        responseId: response.responseId,
        returnedModel: response.returnedModel,
        returnedServiceTier: response.returnedServiceTier,
        sequence: nextSequence++,
        stage: response.stage,
        turnIntentId: response.intentId,
      });
    },
  };
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isDecimal(value: unknown): value is string {
  return typeof value === "string" && /^(0|[1-9]\d*)$/.test(value);
}

function validateStartReceipts(
  starts: unknown,
  head: CanaryUpstreamHead,
  initializationReceiptId: string
): CanaryAttemptStartReceipt[] | null {
  if (
    !Array.isArray(starts) ||
    starts.length !== head.startedAttempts ||
    (head.startedAttempts === 0 && head.observedCostPicodollars !== "0")
  ) {
    return null;
  }
  const attemptIds = new Set<string>();
  const intentIds = new Set<string>();
  const receiptIds = new Set<string>();
  for (const [index, raw] of starts.entries()) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return null;
    }
    const record = raw as Record<string, unknown>;
    if (
      !hasExactKeys(record, [
        "attemptId",
        "intentId",
        "receiptId",
        "sequence",
        "startedAttempts",
      ]) ||
      !isSafeIdentifier(record.attemptId) ||
      !isNonemptyString(record.intentId) ||
      !isNonemptyString(record.receiptId) ||
      record.sequence !== index + 1 ||
      record.startedAttempts !== index + 1 ||
      attemptIds.has(record.attemptId) ||
      intentIds.has(record.intentId) ||
      receiptIds.has(record.receiptId) ||
      record.receiptId === initializationReceiptId
    ) {
      return null;
    }
    attemptIds.add(record.attemptId);
    intentIds.add(record.intentId);
    receiptIds.add(record.receiptId);
  }
  return starts as CanaryAttemptStartReceipt[];
}

function localStartsMatch(
  records: Record<string, unknown>[] | null,
  receiptId: string,
  starts: CanaryAttemptStartReceipt[]
): boolean {
  const [genesis, ...localStarts] = records ?? [];
  if (
    genesis === undefined ||
    !hasExactKeys(genesis, [
      "initializationReceiptId",
      "kind",
      "startedAttempts",
    ]) ||
    genesis.kind !== "attempt-genesis" ||
    genesis.initializationReceiptId !== receiptId ||
    genesis.startedAttempts !== 0 ||
    localStarts.length !== starts.length
  ) {
    return false;
  }
  return localStarts.every((local, index) => {
    const upstream = starts[index];
    return (
      upstream !== undefined &&
      hasExactKeys(local, [
        "attemptId",
        "intentId",
        "kind",
        "receiptId",
        "sequence",
        "startedAttempts",
      ]) &&
      local.kind === "attempt-start" &&
      local.attemptId === upstream.attemptId &&
      local.intentId === upstream.intentId &&
      local.receiptId === upstream.receiptId &&
      local.sequence === upstream.sequence &&
      local.startedAttempts === upstream.startedAttempts
    );
  });
}

function validateCompletionReceipts(
  completions: unknown,
  head: CanaryUpstreamHead,
  forbiddenReceiptIds: ReadonlySet<string>
): CanaryAttemptCompletionReceipt[] | null {
  if (
    !Array.isArray(completions) ||
    completions.length !== head.startedAttempts
  ) {
    return null;
  }
  const attemptIds = new Set<string>();
  const receiptIds = new Set<string>();
  const startReceiptIds = new Set<string>();
  let priorCost = 0n;
  for (const [index, raw] of completions.entries()) {
    if (
      typeof raw !== "object" ||
      raw === null ||
      Array.isArray(raw)
    ) {
      return null;
    }
    const record = raw as Record<string, unknown>;
    if (
      !hasExactKeys(record, [
        "attemptCostPicodollars",
        "attemptId",
        "nativeUsageDigest",
        "observedCostPicodollars",
        "receiptId",
        "responseDigest",
        "sequence",
        "startReceiptId",
      ]) ||
      !isDecimal(record.attemptCostPicodollars) ||
      !isDecimal(record.observedCostPicodollars) ||
      !isNonemptyString(record.nativeUsageDigest) ||
      !isNonemptyString(record.receiptId) ||
      !isNonemptyString(record.responseDigest) ||
      !isSafeIdentifier(record.attemptId) ||
      !isNonemptyString(record.startReceiptId) ||
      record.sequence !== index + 1 ||
      attemptIds.has(record.attemptId) ||
      receiptIds.has(record.receiptId) ||
      startReceiptIds.has(record.startReceiptId) ||
      forbiddenReceiptIds.has(record.receiptId) ||
      BigInt(record.observedCostPicodollars) !==
        priorCost + BigInt(record.attemptCostPicodollars)
    ) {
      return null;
    }
    priorCost = BigInt(record.observedCostPicodollars);
    attemptIds.add(record.attemptId);
    receiptIds.add(record.receiptId);
    startReceiptIds.add(record.startReceiptId);
  }
  if (priorCost.toString() !== head.observedCostPicodollars) {
    return null;
  }
  return completions as CanaryAttemptCompletionReceipt[];
}

function completionsMatchStarts(
  completions: CanaryAttemptCompletionReceipt[],
  starts: CanaryAttemptStartReceipt[]
): boolean {
  return completions.every((completion, index) => {
    const start = starts[index];
    return (
      start !== undefined &&
      completion.sequence === start.sequence &&
      completion.attemptId === start.attemptId &&
      completion.startReceiptId === start.receiptId
    );
  });
}

function receiptCountWithinBudget(
  snapshot: Extract<CanaryUpstreamSnapshot, { kind: "consumed" }>,
  receiptBudget: number
): boolean {
  return (
    Array.isArray(snapshot.starts) &&
    Array.isArray(snapshot.completions) &&
    1 + snapshot.starts.length + snapshot.completions.length <= receiptBudget
  );
}

function upstreamReceiptIds(
  initializationReceiptId: string,
  starts: unknown
): Set<string> {
  const ids = new Set([initializationReceiptId]);
  if (Array.isArray(starts)) {
    for (const raw of starts) {
      if (
        typeof raw === "object" &&
        raw !== null &&
        !Array.isArray(raw) &&
        isNonemptyString((raw as Record<string, unknown>).receiptId)
      ) {
        ids.add((raw as Record<string, unknown>).receiptId as string);
      }
    }
  }
  return ids;
}

function localCompletionsMatch(
  records: Record<string, unknown>[] | null,
  receiptId: string,
  completions: CanaryAttemptCompletionReceipt[]
): boolean {
  const [genesis, ...localCompletions] = records ?? [];
  if (
    genesis === undefined ||
    !hasExactKeys(genesis, [
      "accountingComplete",
      "initializationReceiptId",
      "kind",
      "observedCostPicodollars",
    ]) ||
    genesis.kind !== "cost-genesis" ||
    genesis.initializationReceiptId !== receiptId ||
    genesis.accountingComplete !== true ||
    genesis.observedCostPicodollars !== "0" ||
    localCompletions.length !== completions.length
  ) {
    return false;
  }
  return localCompletions.every((local, index) => {
    const upstream = completions[index];
    return (
      upstream !== undefined &&
      hasExactKeys(local, [
        "attemptCostPicodollars",
        "attemptId",
        "kind",
        "nativeUsageDigest",
        "observedCostPicodollars",
        "receiptId",
        "responseDigest",
        "sequence",
        "startReceiptId",
      ]) &&
      local.kind === "attempt-completion" &&
      local.attemptCostPicodollars === upstream.attemptCostPicodollars &&
      local.attemptId === upstream.attemptId &&
      local.nativeUsageDigest === upstream.nativeUsageDigest &&
      local.observedCostPicodollars === upstream.observedCostPicodollars &&
      local.receiptId === upstream.receiptId &&
      local.responseDigest === upstream.responseDigest &&
      local.sequence === upstream.sequence &&
      local.startReceiptId === upstream.startReceiptId
    );
  });
}

async function retainedEvidenceMatches(
  directory: string,
  completions: CanaryAttemptCompletionReceipt[]
): Promise<boolean> {
  try {
    const evidenceDirectory = join(directory, EVIDENCE_DIRECTORY);
    const retained = await Promise.all(
      completions.map(async (completion) => ({
        completion,
        nativeUsageBytes: await readFile(
          join(evidenceDirectory, `${completion.attemptId}.usage.json`),
          "utf8"
        ),
        rawResponseBytes: await readFile(
          join(evidenceDirectory, `${completion.attemptId}.json`),
          "utf8"
        ),
      }))
    );
    return retained.every(
      ({ completion, nativeUsageBytes, rawResponseBytes }) =>
        digestBytes(nativeUsageBytes) === completion.nativeUsageDigest &&
        digestBytes(rawResponseBytes) === completion.responseDigest
    );
  } catch {
    return false;
  }
}

export async function inspectCanaryAccounting(input: {
  binding: CanaryInitializationBinding;
  outputDirectory: string;
  upstream: CanaryUpstream;
}): Promise<CanaryAccountingInspection> {
  const digest = canaryBindingDigest(input.binding);
  const snapshot = await input.upstream.inspect(digest);
  if (snapshot.kind !== "consumed") {
    return {
      attemptAccountingComplete: false,
      authorizationPresent: snapshot.kind === "ready",
      costAccountingComplete: false,
      observedCostPicodollars: 0n,
      startedAttempts: 0,
    };
  }

  try {
    validateReceipt(snapshot.receipt, { bindingDigest: digest });
    validateHead(snapshot.head, input.binding);
    if (!receiptCountWithinBudget(snapshot, input.binding.receiptBudget)) {
      throw new Error("upstream receipt budget is exceeded");
    }
  } catch {
    return {
      attemptAccountingComplete: false,
      authorizationPresent: false,
      costAccountingComplete: false,
      observedCostPicodollars: 0n,
      startedAttempts: 0,
    };
  }
  const [marker, attemptRecords, costRecords] = await Promise.all([
    readRecord(input.outputDirectory, INITIALIZATION_MARKER),
    readRecords(input.outputDirectory, ATTEMPT_JOURNAL),
    readRecords(input.outputDirectory, COST_JOURNAL),
  ]);
  const markerValid =
    marker?.kind === "canary-initialization" &&
    hasExactKeys(marker, [
      "authorizationId",
      "bindingDigest",
      "kind",
      "receiptId",
    ]) &&
    marker.authorizationId === snapshot.receipt.authorizationId &&
    marker.bindingDigest === digest &&
    marker.receiptId === snapshot.receipt.receiptId;
  if (!markerValid) {
    return {
      attemptAccountingComplete: false,
      authorizationPresent: false,
      costAccountingComplete: false,
      observedCostPicodollars: 0n,
      startedAttempts: 0,
    };
  }
  const starts = validateStartReceipts(
    snapshot.starts,
    snapshot.head,
    snapshot.receipt.receiptId
  );
  const attemptAccountingComplete =
    starts !== null &&
    localStartsMatch(attemptRecords, snapshot.receipt.receiptId, starts);
  const completions = validateCompletionReceipts(
    snapshot.completions,
    snapshot.head,
    upstreamReceiptIds(snapshot.receipt.receiptId, snapshot.starts)
  );
  const costAccountingComplete =
    completions !== null &&
    (starts === null || completionsMatchStarts(completions, starts)) &&
    localCompletionsMatch(
      costRecords,
      snapshot.receipt.receiptId,
      completions
    ) &&
    (await retainedEvidenceMatches(input.outputDirectory, completions));
  return {
    attemptAccountingComplete,
    authorizationPresent: true,
    costAccountingComplete,
    observedCostPicodollars: costAccountingComplete
      ? BigInt(snapshot.head.observedCostPicodollars)
      : 0n,
    startedAttempts: attemptAccountingComplete
      ? snapshot.head.startedAttempts
      : 0,
  };
}

function digestBytes(bytes: string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isSafeIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)
  );
}

function validatePostedStart(
  receipt: CanaryAttemptStartReceipt,
  expected: {
    attemptId: string;
    intentId: string;
    sequence: number;
  }
): void {
  const record = receipt as unknown as Record<string, unknown>;
  if (
    !hasExactKeys(record, [
      "attemptId",
      "intentId",
      "receiptId",
      "sequence",
      "startedAttempts",
    ]) ||
    receipt.attemptId !== expected.attemptId ||
    receipt.intentId !== expected.intentId ||
    !isNonemptyString(receipt.receiptId) ||
    receipt.sequence !== expected.sequence ||
    receipt.startedAttempts !== expected.sequence
  ) {
    throw new Error("upstream attempt-start receipt is invalid");
  }
}

async function readVerifiedConsumedSnapshot(input: {
  binding: CanaryInitializationBinding;
  bindingDigest: string;
  errorMessage: string;
  upstream: CanaryUpstream;
}): Promise<Extract<CanaryUpstreamSnapshot, { kind: "consumed" }>> {
  const snapshot = await input.upstream.inspect(input.bindingDigest);
  if (snapshot.kind !== "consumed") {
    throw new Error(input.errorMessage);
  }
  try {
    validateReceipt(snapshot.receipt, { bindingDigest: input.bindingDigest });
    validateHead(snapshot.head, input.binding);
  } catch {
    throw new Error(input.errorMessage);
  }
  return snapshot;
}

async function verifyPostedStartIsDurable(input: {
  binding: CanaryInitializationBinding;
  bindingDigest: string;
  outputDirectory: string;
  priorObservedCostPicodollars: bigint;
  receipt: CanaryAttemptStartReceipt;
  upstream: CanaryUpstream;
}): Promise<void> {
  const snapshot = await readVerifiedConsumedSnapshot({
    binding: input.binding,
    bindingDigest: input.bindingDigest,
    errorMessage: "upstream attempt start is not durably visible",
    upstream: input.upstream,
  });
  const starts = validateStartReceipts(
    snapshot.starts,
    snapshot.head,
    snapshot.receipt.receiptId
  );
  const lastStart = starts?.at(-1);
  const priorHead = {
    observedCostPicodollars: input.priorObservedCostPicodollars.toString(),
    startedAttempts: input.receipt.sequence - 1,
  };
  const completions = validateCompletionReceipts(
    snapshot.completions,
    priorHead,
    upstreamReceiptIds(snapshot.receipt.receiptId, snapshot.starts)
  );
  const [attemptRecords, costRecords] = await Promise.all([
    readRecords(input.outputDirectory, ATTEMPT_JOURNAL),
    readRecords(input.outputDirectory, COST_JOURNAL),
  ]);
  if (
    starts === null ||
    lastStart === undefined ||
    !hasExactKeys(lastStart as unknown as Record<string, unknown>, [
      "attemptId",
      "intentId",
      "receiptId",
      "sequence",
      "startedAttempts",
    ]) ||
    lastStart.attemptId !== input.receipt.attemptId ||
    lastStart.intentId !== input.receipt.intentId ||
    lastStart.receiptId !== input.receipt.receiptId ||
    lastStart.sequence !== input.receipt.sequence ||
    lastStart.startedAttempts !== input.receipt.startedAttempts ||
    snapshot.head.observedCostPicodollars !== priorHead.observedCostPicodollars ||
    !localStartsMatch(
      attemptRecords,
      snapshot.receipt.receiptId,
      starts.slice(0, -1)
    ) ||
    completions === null ||
    !completionsMatchStarts(completions, starts.slice(0, -1)) ||
    !localCompletionsMatch(
      costRecords,
      snapshot.receipt.receiptId,
      completions
    ) ||
    !(await retainedEvidenceMatches(input.outputDirectory, completions)) ||
    !receiptCountWithinBudget(snapshot, input.binding.receiptBudget)
  ) {
    throw new Error("upstream attempt start is not durably visible");
  }
}

function validatePostedCompletion(
  receipt: CanaryAttemptCompletionReceipt,
  expected: Omit<CanaryAttemptCompletionReceipt, "receiptId">
): void {
  const record = receipt as unknown as Record<string, unknown>;
  if (
    !hasExactKeys(record, [
      "attemptCostPicodollars",
      "attemptId",
      "nativeUsageDigest",
      "observedCostPicodollars",
      "receiptId",
      "responseDigest",
      "sequence",
      "startReceiptId",
    ]) ||
    !isNonemptyString(receipt.receiptId) ||
    Object.entries(expected).some(
      ([key, value]) => record[key] !== value
    )
  ) {
    throw new Error("upstream attempt-completion receipt is invalid");
  }
}

async function verifyPostedCompletionIsDurable(input: {
  binding: CanaryInitializationBinding;
  bindingDigest: string;
  outputDirectory: string;
  receipt: CanaryAttemptCompletionReceipt;
  upstream: CanaryUpstream;
}): Promise<void> {
  const snapshot = await readVerifiedConsumedSnapshot({
    binding: input.binding,
    bindingDigest: input.bindingDigest,
    errorMessage: "upstream attempt completion is not durably visible",
    upstream: input.upstream,
  });
  const starts = validateStartReceipts(
    snapshot.starts,
    snapshot.head,
    snapshot.receipt.receiptId
  );
  const completions = validateCompletionReceipts(
    snapshot.completions,
    snapshot.head,
    upstreamReceiptIds(snapshot.receipt.receiptId, snapshot.starts)
  );
  const lastCompletion = completions?.at(-1);
  const [attemptRecords, costRecords] = await Promise.all([
    readRecords(input.outputDirectory, ATTEMPT_JOURNAL),
    readRecords(input.outputDirectory, COST_JOURNAL),
  ]);
  if (
    starts === null ||
    completions === null ||
    lastCompletion === undefined ||
    Object.entries(input.receipt).some(
      ([key, value]) =>
        (lastCompletion as unknown as Record<string, unknown>)[key] !== value
    ) ||
    !localStartsMatch(
      attemptRecords,
      snapshot.receipt.receiptId,
      starts
    ) ||
    !completionsMatchStarts(completions, starts) ||
    !localCompletionsMatch(
      costRecords,
      snapshot.receipt.receiptId,
      completions.slice(0, -1)
    ) ||
    !(await retainedEvidenceMatches(input.outputDirectory, completions)) ||
    !receiptCountWithinBudget(snapshot, input.binding.receiptBudget)
  ) {
    throw new Error("upstream attempt completion is not durably visible");
  }
}

async function runCanaryAttemptWhileLocked(input: {
  attemptId: string;
  binding: CanaryInitializationBinding;
  dispatch(context: CanaryDispatchContext): Promise<{
    attemptCostPicodollars: bigint;
    nativeUsageBytes: string;
    rawResponseBytes: string;
  }>;
  intentId: string;
  outputDirectory: string;
  prepare?(context: CanaryDispatchContext): Promise<void>;
  upstream: CanaryUpstream;
}): Promise<{
  attemptId: string;
  observedCostPicodollars: bigint;
  sequence: number;
  startedAttempts: number;
}> {
  if (!isSafeIdentifier(input.attemptId) || !isSafeIdentifier(input.intentId)) {
    throw new Error("attemptId and intentId must be safe identifiers");
  }
  const inspected = await inspectCanaryAccounting(input);
  const decision = decideCanaryDispatch({
    ...inspected,
    attemptLimit: input.binding.attemptLimit,
    costLimitPicodollars: BigInt(input.binding.costLimitPicodollars),
  });
  if (!decision.eligible) {
    throw new Error(`canary dispatch blocked: ${decision.reasons.join(", ")}`);
  }
  const receiptsAfterCompleteAttempt =
    1 + 2 * (inspected.startedAttempts + 1);
  if (receiptsAfterCompleteAttempt > input.binding.receiptBudget) {
    throw new Error("receipt budget cannot fund another complete attempt");
  }
  await ensureEvidenceDirectory(input.outputDirectory);

  const evidenceDirectory = join(input.outputDirectory, EVIDENCE_DIRECTORY);
  if (
    (await exists(join(evidenceDirectory, `${input.attemptId}.json`))) ||
    (await exists(join(evidenceDirectory, `${input.attemptId}.usage.json`))) ||
    (await exists(
      join(evidenceDirectory, `${input.attemptId}${PROVIDER_TURN_JOURNAL_SUFFIX}`)
    ))
  ) {
    throw new Error("attempt evidence already exists before dispatch");
  }

  const sequence = inspected.startedAttempts + 1;
  const context = {
    attemptId: input.attemptId,
    intentId: input.intentId,
    outputDirectory: input.outputDirectory,
    sequence,
  };
  await input.prepare?.(context);
  const digest = canaryBindingDigest(input.binding);
  const beforeStart = await readVerifiedConsumedSnapshot({
    binding: input.binding,
    bindingDigest: digest,
    errorMessage: "upstream attempt state changed before dispatch",
    upstream: input.upstream,
  });
  const priorStarts = validateStartReceipts(
    beforeStart.starts,
    beforeStart.head,
    beforeStart.receipt.receiptId
  );
  if (
    priorStarts === null ||
    beforeStart.head.startedAttempts !== inspected.startedAttempts ||
    beforeStart.head.observedCostPicodollars !==
      inspected.observedCostPicodollars.toString()
  ) {
    throw new Error("upstream attempt state changed before dispatch");
  }
  if (
    priorStarts.some(
      (prior) =>
        prior.attemptId === input.attemptId || prior.intentId === input.intentId
    )
  ) {
    throw new Error("attemptId and intentId must be new before dispatch");
  }
  const start = await input.upstream.postAttemptStart({
    attemptId: input.attemptId,
    bindingDigest: digest,
    intentId: input.intentId,
    sequence,
  });
  validatePostedStart(start, {
    attemptId: input.attemptId,
    intentId: input.intentId,
    sequence,
  });
  await verifyPostedStartIsDurable({
    binding: input.binding,
    bindingDigest: digest,
    outputDirectory: input.outputDirectory,
    priorObservedCostPicodollars: inspected.observedCostPicodollars,
    receipt: start,
    upstream: input.upstream,
  });
  await appendDurableJsonLine(input.outputDirectory, ATTEMPT_JOURNAL, {
    ...start,
    kind: "attempt-start",
  });

  const completed = await input.dispatch(context);
  requirePicodollars(
    completed.attemptCostPicodollars,
    "attemptCostPicodollars"
  );
  if (
    typeof completed.nativeUsageBytes !== "string" ||
    typeof completed.rawResponseBytes !== "string"
  ) {
    throw new Error("completed attempt evidence must be strings");
  }
  let inventory: unknown;
  try {
    inventory = JSON.parse(completed.rawResponseBytes);
  } catch {
    throw new Error("completed attempt response evidence is invalid JSON");
  }
  const validatedInventory = priceProviderInventory(inventory);
  if (
    validatedInventory.attemptId !== input.attemptId ||
    validatedInventory.intentId !== input.intentId
  ) {
    throw new Error("completed provider inventory belongs to another attempt");
  }
  const expectedUsageBytes = JSON.stringify({
    turns: validatedInventory.turns.map((turn) => ({
      rawUsage: turn.rawUsage,
      requestId: turn.requestId,
      responseId: turn.responseId,
      stage: turn.stage,
    })),
  });
  if (
    completed.attemptCostPicodollars !==
      validatedInventory.totalCostPicodollars ||
    completed.nativeUsageBytes !== expectedUsageBytes
  ) {
    throw new Error("completed attempt cost or usage contradicts native evidence");
  }
  const responseDigest = digestBytes(completed.rawResponseBytes);
  const nativeUsageDigest = digestBytes(completed.nativeUsageBytes);
  await writeExclusiveBytes(
    join(input.outputDirectory, EVIDENCE_DIRECTORY),
    `${input.attemptId}.json`,
    completed.rawResponseBytes
  );
  await writeExclusiveBytes(
    join(input.outputDirectory, EVIDENCE_DIRECTORY),
    `${input.attemptId}.usage.json`,
    completed.nativeUsageBytes
  );

  const observedCostPicodollars =
    inspected.observedCostPicodollars + completed.attemptCostPicodollars;
  const expectedCompletion = {
    attemptCostPicodollars: completed.attemptCostPicodollars.toString(),
    attemptId: input.attemptId,
    nativeUsageDigest,
    observedCostPicodollars: observedCostPicodollars.toString(),
    responseDigest,
    sequence,
    startReceiptId: start.receiptId,
  };
  const completion = await input.upstream.postAttemptCompletion({
    ...expectedCompletion,
    bindingDigest: digest,
  });
  validatePostedCompletion(completion, expectedCompletion);
  await verifyPostedCompletionIsDurable({
    binding: input.binding,
    bindingDigest: digest,
    outputDirectory: input.outputDirectory,
    receipt: completion,
    upstream: input.upstream,
  });
  await appendDurableJsonLine(input.outputDirectory, COST_JOURNAL, {
    ...completion,
    kind: "attempt-completion",
  });

  if (!validatedInventory.routeValid) {
    throw new Error("completed attempt used an unauthorized provider route");
  }

  return {
    attemptId: input.attemptId,
    observedCostPicodollars,
    sequence,
    startedAttempts: sequence,
  };
}

async function withCanaryLock<T>(
  outputDirectory: string,
  action: () => Promise<T>
): Promise<T> {
  let handle;
  try {
    handle = await open(join(outputDirectory, CANARY_LOCK), "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("canary is already running");
    }
    throw error;
  }
  try {
    await handle.writeFile("exclusive canary owner\n", "utf8");
    await handle.sync();
    await syncDirectory(outputDirectory);
    return await action();
  } finally {
    await handle.close();
    await unlink(join(outputDirectory, CANARY_LOCK));
    await syncDirectory(outputDirectory);
  }
}

export async function runCanaryAttempt(
  input: Parameters<typeof runCanaryAttemptWhileLocked>[0]
): ReturnType<typeof runCanaryAttemptWhileLocked> {
  if (!(await exists(input.outputDirectory))) {
    throw new Error("canary output is not initialized");
  }
  return withCanaryLock(input.outputDirectory, () =>
    runCanaryAttemptWhileLocked(input)
  );
}
