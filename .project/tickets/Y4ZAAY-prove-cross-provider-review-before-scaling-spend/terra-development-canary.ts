export const PICODOLLARS_PER_DOLLAR = 1_000_000_000_000n;

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
