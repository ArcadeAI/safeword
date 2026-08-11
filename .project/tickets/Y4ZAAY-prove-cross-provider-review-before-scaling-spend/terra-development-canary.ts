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

export type CanaryUpstreamSnapshot =
  | { authorizationId: string; kind: "ready" }
  | {
      head: CanaryUpstreamHead;
      kind: "consumed";
      receipt: CanaryInitializationReceipt;
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

function validateHead(head: CanaryUpstreamHead): void {
  const record = head as unknown as Record<string, unknown>;
  if (
    !hasExactKeys(record, ["observedCostPicodollars", "startedAttempts"]) ||
    !Number.isSafeInteger(head.startedAttempts) ||
    head.startedAttempts < 0 ||
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
    validateHead(snapshot.head);
  } catch {
    return {
      attemptAccountingComplete: false,
      authorizationPresent: false,
      costAccountingComplete: false,
      observedCostPicodollars: 0n,
      startedAttempts: 0,
    };
  }
  const [marker, attempts, cost] = await Promise.all([
    readRecord(input.outputDirectory, INITIALIZATION_MARKER),
    readRecord(input.outputDirectory, ATTEMPT_JOURNAL),
    readRecord(input.outputDirectory, COST_JOURNAL),
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
  const headIsGenesis =
    snapshot.head.startedAttempts === 0 &&
    snapshot.head.observedCostPicodollars === "0";
  const attemptAccountingComplete =
    headIsGenesis &&
    attempts?.kind === "attempt-genesis" &&
    hasExactKeys(attempts, [
      "initializationReceiptId",
      "kind",
      "startedAttempts",
    ]) &&
    attempts.initializationReceiptId === snapshot.receipt.receiptId &&
    attempts.startedAttempts === 0;
  const costAccountingComplete =
    headIsGenesis &&
    cost?.kind === "cost-genesis" &&
    hasExactKeys(cost, [
      "accountingComplete",
      "initializationReceiptId",
      "kind",
      "observedCostPicodollars",
    ]) &&
    cost.initializationReceiptId === snapshot.receipt.receiptId &&
    cost.accountingComplete === true &&
    cost.observedCostPicodollars === "0";
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
