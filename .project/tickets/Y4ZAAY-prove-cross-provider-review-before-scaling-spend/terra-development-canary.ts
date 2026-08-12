import { createHash } from "node:crypto";
import { mkdir, open, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export const PICODOLLARS_PER_DOLLAR = 1_000_000_000_000n;
export const INITIALIZATION_MARKER = "initialization.json";
export const ATTEMPT_JOURNAL = "attempts.jsonl";
export const COST_JOURNAL = "cost.jsonl";

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
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function bindingDigest(binding: CanaryInitializationBinding): string {
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

export async function initializeCanary(input: {
  binding: CanaryInitializationBinding;
  outputDirectory: string;
  upstream: CanaryUpstream;
}): Promise<{
  observedCostPicodollars: 0n;
  receiptId: string;
  startedAttempts: 0;
}> {
  const digest = bindingDigest(input.binding);
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

  await mkdir(input.outputDirectory, { recursive: true });
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
      !isNonemptyString(record.attemptId) ||
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
      !isNonemptyString(record.attemptId) ||
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

export async function inspectCanaryAccounting(input: {
  binding: CanaryInitializationBinding;
  outputDirectory: string;
  upstream: CanaryUpstream;
}): Promise<CanaryAccountingInspection> {
  const digest = bindingDigest(input.binding);
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
    );
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
