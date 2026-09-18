import nodePath from 'node:path';

import { parseReviewStamps } from '../../templates/hooks/lib/review-ledger.js';
import type {
  ExecutionPlanDeliveryDefinition,
  ExecutionPlanRecord,
  UnverifiedReviewerOutput,
} from '../review/contract.js';
import { validateExecutionPlanOutput } from '../review/execution-plan-output.js';
import { authenticatedReviewReceiptData } from '../review/job.js';

export type ExecutionPlanAdmission =
  | {
      readonly kind: 'admitted';
      readonly reviewId: string;
      readonly record: ExecutionPlanRecord;
      readonly independence: 'cross-agent' | 'degraded';
    }
  | { readonly kind: 'missing_verdict' }
  | { readonly kind: 'rejected'; readonly message: string }
  | { readonly kind: 'unearned_assurance' }
  | { readonly kind: 'not_admitted' };

function reviewData(cwd: string, reviewId: string): Record<string, unknown> | undefined {
  return authenticatedReviewReceiptData(cwd, reviewId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
): 'cross-agent' | 'degraded' | undefined {
  const independence = data.independence;
  if (independence !== 'cross-agent' && independence !== 'degraded') return undefined;
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
  if (independence === undefined) return { kind: 'unearned_assurance' };
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
  };
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
  for (const stamp of candidates) {
    const admission = candidateAdmission(input, stamp);
    if (admission !== undefined) return admission;
  }
  return { kind: 'not_admitted' };
}

/** Resolve an admitted review for callers that need the approved plan record. */
export function admittedExecutionPlanReview(input: Parameters<typeof executionPlanAdmission>[0]):
  | {
      readonly reviewId: string;
      readonly record: ExecutionPlanRecord;
      readonly independence: 'cross-agent' | 'degraded';
    }
  | undefined {
  const admission = executionPlanAdmission(input);
  return admission.kind === 'admitted' ? admission : undefined;
}
