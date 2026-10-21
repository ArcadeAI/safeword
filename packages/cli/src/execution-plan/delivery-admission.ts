import nodePath from 'node:path';

import { parseReviewStamps } from '../../templates/hooks/lib/review-ledger.js';
import type {
  ExecutionPlanDeliveryDefinition,
  ExecutionPlanRecord,
  UnverifiedReviewerOutput,
} from '../review/contract.js';
import { validateExecutionPlanOutput } from '../review/execution-plan-output.js';
import { reviewJobStatus } from '../review/job.js';
import { reviewPolicyAllowsAssurance } from '../review/policy.js';

type ExecutionPlanIdentityMismatch =
  | { readonly kind: 'mismatched_kind'; readonly actualKind: string }
  | { readonly kind: 'mismatched_ticket' };

export type ExecutionPlanAdmission =
  | ExecutionPlanIdentityMismatch
  | {
      readonly kind: 'admitted';
      readonly reviewId: string;
      readonly record: ExecutionPlanRecord;
      readonly independence: 'cross-agent' | 'reduced' | 'degraded';
      readonly provenance: {
        readonly authorAgent: string;
        readonly reviewerAgent: string;
        readonly independence: 'cross-agent' | 'reduced' | 'degraded';
      };
    }
  | { readonly kind: 'missing_verdict' }
  | { readonly kind: 'rejected'; readonly message: string }
  | { readonly kind: 'unearned_assurance' }
  | { readonly kind: 'not_admitted' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function reviewData(cwd: string, reviewId: string): Record<string, unknown> | undefined {
  const current = reviewJobStatus(cwd, reviewId);
  if (current.findings.some(finding => finding.code === 'REVIEW_STALE')) return undefined;
  const status = reviewJobStatus(cwd, reviewId, { allowMalformedReviewerOutput: true });
  return isRecord(status.data) ? status.data : undefined;
}

function coversPlan(data: Record<string, unknown>, cwd: string, planPath: string): boolean {
  const targets = data.review_targets;
  return (
    Array.isArray(targets) &&
    targets.some(target => typeof target === 'string' && nodePath.resolve(cwd, target) === planPath)
  );
}

function rejectionMessage(output: Record<string, unknown>): string {
  const findings = output.findings;
  if (!Array.isArray(findings)) return 'The Execution Plan review requested changes.';
  for (const finding of findings) {
    if (
      typeof finding === 'object' &&
      finding !== null &&
      typeof (finding as Record<string, unknown>).message === 'string'
    ) {
      return (finding as Record<string, unknown>).message as string;
    }
  }
  return 'The Execution Plan review requested changes.';
}

function achievedIndependence(
  data: Record<string, unknown>,
  output: Record<string, unknown>,
  stamp: ReturnType<typeof parseReviewStamps>[number],
): 'cross-agent' | 'reduced' | 'degraded' | undefined {
  const independence = data.independence;
  if (independence !== 'cross-agent' && independence !== 'reduced' && independence !== 'degraded')
    return undefined;
  if (
    stamp.independence !== independence ||
    stamp.author !== data.author_agent ||
    stamp.reviewer !== data.actual_reviewer ||
    output.reviewer_agent !== data.actual_reviewer
  ) {
    return undefined;
  }
  if (independence === 'cross-agent' && data.author_agent === data.actual_reviewer)
    return undefined;
  return independence;
}

function reviewCandidate(
  input: Parameters<typeof executionPlanAdmission>[0],
  stamp: ReturnType<typeof parseReviewStamps>[number],
):
  | {
      readonly reviewId: string;
      readonly data: Record<string, unknown>;
      readonly output: Record<string, unknown>;
    }
  | undefined {
  if (stamp.reviewId === undefined) return undefined;
  const data = reviewData(input.cwd, stamp.reviewId);
  if (data?.review_kind !== 'plan-execution') return undefined;
  if (!coversPlan(data, input.cwd, input.planPath) || !isRecord(data.reviewer_output)) {
    return undefined;
  }
  return { reviewId: stamp.reviewId, data, output: data.reviewer_output };
}

function candidateAdmission(
  input: Parameters<typeof executionPlanAdmission>[0],
  stamp: ReturnType<typeof parseReviewStamps>[number],
): ExecutionPlanAdmission | undefined {
  const candidate = reviewCandidate(input, stamp);
  if (candidate === undefined) return undefined;
  const { data, output, reviewId } = candidate;
  if (output.verdict === undefined) return { kind: 'missing_verdict' };
  if (output.verdict === 'request_changes') {
    return { kind: 'rejected', message: rejectionMessage(output) };
  }
  const independence = achievedIndependence(data, output, stamp);
  if (independence === undefined || !reviewPolicyAllowsAssurance(input.cwd, independence))
    return { kind: 'unearned_assurance' };
  if (data.status !== 'approved') return { kind: 'not_admitted' };
  const validated = validateExecutionPlanOutput(
    output as unknown as UnverifiedReviewerOutput,
    input.definition,
    input.digest,
  );
  if (validated.kind !== 'approved') return { kind: 'not_admitted' };
  return {
    kind: 'admitted',
    reviewId,
    record: validated.output.execution_plan_record,
    independence,
    provenance: {
      authorAgent: data.author_agent as string,
      reviewerAgent: data.actual_reviewer as string,
      independence,
    },
  };
}

function identityMismatch(
  input: Parameters<typeof executionPlanAdmission>[0],
  stamp: ReturnType<typeof parseReviewStamps>[number],
): ExecutionPlanIdentityMismatch | undefined {
  if (stamp.reviewId === undefined) return undefined;
  const data = reviewData(input.cwd, stamp.reviewId);
  if (data === undefined || !isRecord(data.reviewer_output)) return undefined;
  if (typeof data.review_kind === 'string' && data.review_kind !== 'plan-execution') {
    return { kind: 'mismatched_kind', actualKind: data.review_kind };
  }
  const targets = data.review_targets;
  if (
    data.review_kind === 'plan-execution' &&
    Array.isArray(targets) &&
    targets.some(target => {
      if (typeof target !== 'string') return false;
      const resolved = nodePath.resolve(input.cwd, target);
      const directory = nodePath.dirname(resolved);
      return (
        nodePath.basename(resolved) === 'execution-plan.md' &&
        directory !== input.ticketDirectory &&
        nodePath.dirname(directory) === nodePath.dirname(input.ticketDirectory)
      );
    })
  ) {
    return { kind: 'mismatched_ticket' };
  }
  return undefined;
}

/** Diagnose the latest review for the exact current Execution Plan contract. */
export function executionPlanAdmission(input: {
  readonly cwd: string;
  readonly ticketDirectory: string;
  readonly planPath: string;
  readonly ledger: string;
  readonly definition: ExecutionPlanDeliveryDefinition;
  readonly digest: string;
}): ExecutionPlanAdmission {
  const scope = `${nodePath.basename(input.ticketDirectory)}:phase@plan-execution`;
  const candidates = parseReviewStamps(input.ledger)
    .filter(stamp => stamp.scope === scope && stamp.skipReason === undefined)
    .toReversed();
  let mismatch: ExecutionPlanIdentityMismatch | undefined;
  for (const stamp of candidates) {
    const admission = candidateAdmission(input, stamp);
    if (admission !== undefined) return admission;
    mismatch ??= identityMismatch(input, stamp);
  }
  return mismatch ?? { kind: 'not_admitted' };
}

/** Resolve an admitted review for callers that need the approved plan record. */
export function admittedExecutionPlanReview(
  input: Parameters<typeof executionPlanAdmission>[0],
): { readonly reviewId: string; readonly record: ExecutionPlanRecord } | undefined {
  const admission = executionPlanAdmission(input);
  return admission.kind === 'admitted'
    ? { reviewId: admission.reviewId, record: admission.record }
    : undefined;
}
