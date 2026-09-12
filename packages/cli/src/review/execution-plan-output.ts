import type { ExecutionPlanRecord, UnverifiedReviewerOutput } from './contract.js';

type ValidatedExecutionPlanOutput =
  | {
      readonly kind: 'approved';
      readonly output: UnverifiedReviewerOutput & {
        readonly execution_plan_record: ExecutionPlanRecord;
      };
    }
  | {
      readonly kind: 'denied';
      readonly output: UnverifiedReviewerOutput & {
        readonly verdict: 'request_changes';
        readonly execution_plan_record: null;
      };
    }
  | { readonly kind: 'invalid_output' };

const NULL_EXECUTION_PLAN_RECORD = JSON.parse('null') as null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = new Set(keys);
  return (
    Object.keys(value).length === keys.length && Object.keys(value).every(key => expected.has(key))
  );
}

function isNonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function uniqueNonblankStrings(value: unknown, allowEmpty: boolean): value is string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) return false;
  if (!value.every(isNonblank)) return false;
  return new Set(value).size === value.length;
}

function deniedOutput(
  output: UnverifiedReviewerOutput,
  messages: readonly string[] = [],
): Extract<ValidatedExecutionPlanOutput, { kind: 'denied' }> {
  return {
    kind: 'denied',
    output: {
      ...output,
      verdict: 'request_changes',
      execution_plan_record: NULL_EXECUTION_PLAN_RECORD,
      findings: [
        ...output.findings,
        ...messages.map(message => ({ severity: 'error' as const, message })),
      ],
    },
  };
}

function successorTripwireFinding(value: unknown, index: number): string | undefined {
  if (!isRecord(value) || value.relies_on_unmerged_successor !== true) return undefined;
  const name = isNonblank(value.name) ? value.name : `slice ${index + 1}`;
  return `Execution Plan slice "${name}" relies on an unmerged successor.`;
}

function decisionTripwireFinding(value: unknown, index: number): string | undefined {
  if (!isRecord(value) || !isNonblank(value.status) || value.status === 'unchanged') {
    return undefined;
  }
  const name = isNonblank(value.decision) ? value.decision : `decision ${index + 1}`;
  return `Execution Plan decision "${name}" has status "${value.status}" instead of unchanged.`;
}

function readableTripwireFindings(record: Record<string, unknown>): string[] {
  const sliceFindings = Array.isArray(record.slices)
    ? record.slices
        .map((slice, index) => successorTripwireFinding(slice, index))
        .filter(finding => finding !== undefined)
    : [];
  const decisionFindings = Array.isArray(record.decision_statuses)
    ? record.decision_statuses
        .map((decision, index) => decisionTripwireFinding(decision, index))
        .filter(finding => finding !== undefined)
    : [];
  return [...sliceFindings, ...decisionFindings];
}

function isValidSlice(value: unknown): value is ExecutionPlanRecord['slices'][number] {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(value, [
      'name',
      'purpose',
      'boundary',
      'prerequisites',
      'proof',
      'completion_signal',
      'relies_on_unmerged_successor',
    ])
  ) {
    return false;
  }
  return (
    isNonblank(value.name) &&
    isNonblank(value.purpose) &&
    isNonblank(value.boundary) &&
    uniqueNonblankStrings(value.prerequisites, true) &&
    isNonblank(value.proof) &&
    isNonblank(value.completion_signal) &&
    value.relies_on_unmerged_successor === false
  );
}

function hasValidRecordHeader(value: Record<string, unknown>): boolean {
  const decisionIsValid =
    value.slicing_decision === 'one_pull_request' ||
    value.slicing_decision === 'multiple_pull_requests';
  return (
    hasExactKeys(value, [
      'slicing_decision',
      'rationale',
      'slices',
      'obligation_owners',
      'decision_statuses',
    ]) &&
    decisionIsValid &&
    isNonblank(value.rationale) &&
    Array.isArray(value.slices) &&
    value.slices.every(isValidSlice) &&
    Array.isArray(value.obligation_owners) &&
    Array.isArray(value.decision_statuses)
  );
}

function hasValidSliceGraph(record: ExecutionPlanRecord): boolean {
  const slices = record.slices;
  const countMatchesDecision =
    record.slicing_decision === 'one_pull_request' ? slices.length === 1 : slices.length >= 2;
  const sliceNames = slices.map(slice => slice.name);
  const namesAreUnique = new Set(sliceNames).size === sliceNames.length;
  const prerequisitesAreEarlier = slices.every((slice, index) => {
    const earlier = new Set(sliceNames.slice(0, index));
    return slice.prerequisites.every(prerequisite => earlier.has(prerequisite));
  });
  return countMatchesDecision && namesAreUnique && prerequisitesAreEarlier;
}

function isValidObligationOwner(
  value: unknown,
  sliceNames: readonly string[],
  seen: Set<string>,
): value is ExecutionPlanRecord['obligation_owners'][number] {
  if (!isRecord(value) || !hasExactKeys(value, ['obligation', 'slices'])) return false;
  if (!isNonblank(value.obligation) || seen.has(value.obligation)) return false;
  if (!uniqueNonblankStrings(value.slices, false)) return false;
  if (value.slices.some(slice => !sliceNames.includes(slice))) return false;
  seen.add(value.obligation);
  return true;
}

function hasValidObligationOwners(record: ExecutionPlanRecord): boolean {
  if (record.obligation_owners.length === 0) return false;
  const sliceNames = record.slices.map(slice => slice.name);
  const seen = new Set<string>();
  const valid = record.obligation_owners.every(owner =>
    isValidObligationOwner(owner, sliceNames, seen),
  );
  if (!valid) return false;
  const owned = new Set(record.obligation_owners.flatMap(owner => owner.slices));
  return sliceNames.every(slice => owned.has(slice));
}

function hasValidDecisionStatuses(record: ExecutionPlanRecord): boolean {
  if (record.decision_statuses.length === 0) return false;
  const seen = new Set<string>();
  return record.decision_statuses.every(decision => {
    if (!isRecord(decision) || !hasExactKeys(decision, ['decision', 'status'])) return false;
    if (!isNonblank(decision.decision) || seen.has(decision.decision)) return false;
    if (decision.status !== 'unchanged') return false;
    seen.add(decision.decision);
    return true;
  });
}

function isValidExecutionPlanRecord(value: unknown): value is ExecutionPlanRecord {
  if (!isRecord(value) || !hasValidRecordHeader(value)) return false;
  const record = value as unknown as ExecutionPlanRecord;
  return (
    hasValidSliceGraph(record) &&
    hasValidObligationOwners(record) &&
    hasValidDecisionStatuses(record)
  );
}

/** Classify one already parsed plan-execution result without interpreting plan prose. */
export function validateExecutionPlanOutput(
  output: UnverifiedReviewerOutput,
): ValidatedExecutionPlanOutput {
  if (output.verdict === 'request_changes') return deniedOutput(output);

  const candidate = output.execution_plan_record;
  if (isRecord(candidate)) {
    const tripwires = readableTripwireFindings(candidate);
    if (tripwires.length > 0) return deniedOutput(output, tripwires);
  }
  if (!isValidExecutionPlanRecord(candidate)) return { kind: 'invalid_output' };
  return { kind: 'approved', output: { ...output, execution_plan_record: candidate } };
}
