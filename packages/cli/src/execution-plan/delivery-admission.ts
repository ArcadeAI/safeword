import nodePath from 'node:path';

import { parseReviewStamps } from '../../templates/hooks/lib/review-ledger.js';
import type {
  ExecutionPlanDeliveryDefinition,
  ExecutionPlanRecord,
  UnverifiedReviewerOutput,
} from '../review/contract.js';
import { validateExecutionPlanOutput } from '../review/execution-plan-output.js';
import { reviewJobStatus } from '../review/job.js';

function healthyReviewData(cwd: string, reviewId: string): Record<string, unknown> | undefined {
  const status = reviewJobStatus(cwd, reviewId);
  if (status.state !== 'healthy') return undefined;
  if (typeof status.data !== 'object' || status.data === null) return undefined;
  return status.data as Record<string, unknown>;
}

function approvedReviewOutput(
  cwd: string,
  reviewId: string,
  planPath: string,
  definition: ExecutionPlanDeliveryDefinition,
  digest: string,
): ExecutionPlanRecord | undefined {
  const data = healthyReviewData(cwd, reviewId);
  if (data === undefined) return undefined;
  if (data.status !== 'approved' || data.review_kind !== 'plan-execution') return undefined;
  const targets = data.review_targets;
  if (!Array.isArray(targets)) return undefined;
  const coversPlan = targets.some(
    target => typeof target === 'string' && nodePath.resolve(cwd, target) === planPath,
  );
  if (!coversPlan) return undefined;
  if (typeof data.reviewer_output !== 'object' || data.reviewer_output === null) return undefined;
  const output = data.reviewer_output as UnverifiedReviewerOutput;
  const validated = validateExecutionPlanOutput(output, definition, digest);
  return validated.kind === 'approved' ? validated.output.execution_plan_record : undefined;
}

/** Resolve an admitted review for the exact current Execution Plan contract. */
export function admittedExecutionPlanReview(input: {
  readonly cwd: string;
  readonly ticketDirectory: string;
  readonly planPath: string;
  readonly ledger: string;
  readonly definition: ExecutionPlanDeliveryDefinition;
  readonly digest: string;
}): { readonly reviewId: string; readonly record: ExecutionPlanRecord } | undefined {
  const scope = `${nodePath.basename(input.ticketDirectory)}:phase@plan-execution`;
  const candidates = parseReviewStamps(input.ledger)
    .filter(stamp => stamp.scope === scope && stamp.skipReason === undefined)
    .toReversed();
  for (const stamp of candidates) {
    if (stamp.reviewId === undefined) continue;
    const record = approvedReviewOutput(
      input.cwd,
      stamp.reviewId,
      input.planPath,
      input.definition,
      input.digest,
    );
    if (record !== undefined) return { reviewId: stamp.reviewId, record };
  }
  return undefined;
}
