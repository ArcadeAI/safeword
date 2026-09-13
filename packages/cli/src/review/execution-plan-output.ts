import { DELIVERY_CHECKLIST_CATEGORIES } from '../execution-plan/delivery-checklist.js';
import type {
  ExecutionPlanDeliveryDefinition,
  ExecutionPlanProofSpecification,
  ExecutionPlanRecord,
  UnverifiedReviewerOutput,
} from './contract.js';

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
      'accepted_scenarios_covered',
      'accepted_approach_preserved',
      'delivery_definition',
    ]) &&
    decisionIsValid &&
    isNonblank(value.rationale) &&
    Array.isArray(value.slices) &&
    value.slices.every(isValidSlice) &&
    Array.isArray(value.obligation_owners) &&
    Array.isArray(value.decision_statuses) &&
    hasValidPlanJudgmentHeader(value)
  );
}

function hasValidPlanJudgmentHeader(value: Record<string, unknown>): boolean {
  return (
    value.accepted_scenarios_covered === true &&
    value.accepted_approach_preserved === true &&
    isRecord(value.delivery_definition)
  );
}

function isProjectContainedPath(value: string): boolean {
  if (value === '' || value.startsWith('/') || value.startsWith('\\')) return false;
  if (/^[A-Za-z]:[\\/]/u.test(value) || value.includes('\0')) return false;
  return !value.split(/[\\/]/u).includes('..');
}

function isValidProofInvocation(
  value: unknown,
  method: ExecutionPlanProofSpecification['method'],
): boolean {
  if (!isRecord(value) || value.type !== method) return false;
  if (method === 'command') {
    return (
      hasExactKeys(value, ['type', 'cwd', 'argv']) &&
      typeof value.cwd === 'string' &&
      isProjectContainedPath(value.cwd) &&
      uniqueNonblankStrings(value.argv, false)
    );
  }
  return (
    hasExactKeys(value, ['type', 'kind', 'targets']) &&
    isNonblank(value.kind) &&
    uniqueNonblankStrings(value.targets, false) &&
    value.targets.every(target => isProjectContainedPath(target))
  );
}

function isValidProofSpecification(value: unknown): value is ExecutionPlanProofSpecification {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'proof_id',
      'method',
      'scope',
      'boundary_exercised',
      'qualifies_as',
      'currency',
      'invocation',
    ])
  ) {
    return false;
  }
  const methodIsValid = value.method === 'command' || value.method === 'review_receipt';
  const scopeIsValid = ['unit', 'integration', 'E2E', 'eval'].includes(String(value.scope));
  const qualificationIsValid = ['real_boundary', 'partial_or_structural'].includes(
    String(value.qualifies_as),
  );
  const currencyIsValid = ['current_required', 'compatible_earlier_allowed'].includes(
    String(value.currency),
  );
  return (
    isNonblank(value.proof_id) &&
    isNonblank(value.boundary_exercised) &&
    methodIsValid &&
    scopeIsValid &&
    qualificationIsValid &&
    currencyIsValid &&
    isValidProofInvocation(
      value.invocation,
      value.method as ExecutionPlanProofSpecification['method'],
    )
  );
}

function hasValidChecklistItemBase(value: Record<string, unknown>): boolean {
  return (
    isNonblank(value.id) &&
    DELIVERY_CHECKLIST_CATEGORIES.includes(
      value.category as (typeof DELIVERY_CHECKLIST_CATEGORIES)[number],
    ) &&
    isNonblank(value.obligation)
  );
}

function contributorDefinitionIsValid(value: Record<string, unknown>): boolean {
  const reviewedIsValid =
    (value.reviewed_disposition === null && value.reviewed_detail === null) ||
    (value.reviewed_disposition === 'not_applicable' && isNonblank(value.reviewed_detail));
  return isNonblank(value.required_proof) && reviewedIsValid;
}

function humanDefinitionIsValid(value: Record<string, unknown>): boolean {
  return (
    value.required_proof === '' &&
    (value.reviewed_disposition === 'not_applicable' ||
      value.reviewed_disposition === 'pending_human') &&
    isNonblank(value.reviewed_detail)
  );
}

function isValidChecklistDefinitionItem(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'id',
      'category',
      'obligation',
      'owner',
      'required_proof',
      'reviewed_disposition',
      'reviewed_detail',
    ])
  ) {
    return false;
  }
  if (!hasValidChecklistItemBase(value)) return false;
  if (value.owner === 'contributor') return contributorDefinitionIsValid(value);
  return value.owner === 'human' && humanDefinitionIsValid(value);
}

function hasValidDeliveryDefinitionHeader(definition: ExecutionPlanDeliveryDefinition): boolean {
  return (
    hasExactKeys(definition as unknown as Record<string, unknown>, [
      'schema_version',
      'design_approval_gate',
      'proof_specifications',
      'checklist_items',
    ]) &&
    definition.schema_version === 1 &&
    typeof definition.design_approval_gate === 'boolean' &&
    Array.isArray(definition.proof_specifications) &&
    Array.isArray(definition.checklist_items) &&
    definition.proof_specifications.length > 0 &&
    definition.checklist_items.length > 0
  );
}

function hasUniqueDefinitionIds(definition: ExecutionPlanDeliveryDefinition): boolean {
  const proofIds = definition.proof_specifications.map(proof => proof.proof_id);
  const itemIds = definition.checklist_items.map(item => item.id);
  return new Set(proofIds).size === proofIds.length && new Set(itemIds).size === itemIds.length;
}

function hasEveryDefinitionCategory(definition: ExecutionPlanDeliveryDefinition): boolean {
  const presentCategories = new Set(definition.checklist_items.map(item => item.category));
  return DELIVERY_CHECKLIST_CATEGORIES.every(category => presentCategories.has(category));
}

function contributorProofsAreReal(definition: ExecutionPlanDeliveryDefinition): boolean {
  const realProofs = new Set(
    definition.proof_specifications
      .filter(proof => proof.qualifies_as === 'real_boundary')
      .map(proof => proof.proof_id),
  );
  return definition.checklist_items.every(
    item => item.owner !== 'contributor' || realProofs.has(item.required_proof),
  );
}

function hasValidDeliveryDefinition(definition: ExecutionPlanDeliveryDefinition): boolean {
  if (!hasValidDeliveryDefinitionHeader(definition)) return false;
  if (definition.proof_specifications.some(proof => !isValidProofSpecification(proof))) {
    return false;
  }
  if (definition.checklist_items.some(item => !isValidChecklistDefinitionItem(item))) {
    return false;
  }
  return (
    hasUniqueDefinitionIds(definition) &&
    hasEveryDefinitionCategory(definition) &&
    contributorProofsAreReal(definition)
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
    hasValidDecisionStatuses(record) &&
    hasValidDeliveryDefinition(record.delivery_definition)
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
