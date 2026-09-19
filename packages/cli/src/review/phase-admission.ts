import nodePath from 'node:path';

import { parseReviewStamps } from '../../templates/hooks/lib/review-ledger.js';
import type { ReviewKind } from './contract.js';
import { reviewJobStatus } from './job.js';

export interface ReviewProvenance {
  readonly authorAgent: string;
  readonly reviewerAgent: string;
  readonly independence: 'cross-agent' | 'degraded';
}

export type PhaseReviewAdmission =
  | { readonly kind: 'admitted'; readonly provenance: ReviewProvenance }
  | { readonly kind: 'rejected'; readonly message: string }
  | { readonly kind: 'unearned_assurance'; readonly message: string }
  | { readonly kind: 'not_admitted' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coversTarget(data: Record<string, unknown>, cwd: string, target: string): boolean {
  return (
    Array.isArray(data.review_targets) &&
    data.review_targets.some(
      candidate => typeof candidate === 'string' && nodePath.resolve(cwd, candidate) === target,
    )
  );
}

function rejectionMessage(output: Record<string, unknown>, label: string): string {
  if (Array.isArray(output.findings)) {
    for (const finding of output.findings) {
      if (isRecord(finding) && typeof finding.message === 'string') return finding.message;
    }
  }
  return `The ${label} review requested changes.`;
}

interface ReviewCandidate {
  readonly data: Record<string, unknown>;
  readonly output: Record<string, unknown>;
}

function reviewCandidate(
  input: Parameters<typeof phaseReviewAdmission>[0],
  reviewId: string,
): ReviewCandidate | undefined {
  const authenticated = reviewJobStatus(input.cwd, reviewId, {
    allowMalformedReviewerOutput: true,
  });
  if (!isRecord(authenticated.data)) return undefined;
  const data = authenticated.data;
  if (
    data.review_kind !== input.kind ||
    !coversTarget(data, input.cwd, input.target) ||
    !isRecord(data.reviewer_output)
  ) {
    return undefined;
  }
  return { data, output: data.reviewer_output };
}

function isCurrentReceipt(cwd: string, reviewId: string): boolean {
  const current = reviewJobStatus(cwd, reviewId);
  return (
    isRecord(current.data) &&
    current.data.command === 'review run' &&
    ['approved', 'changes_requested'].includes(String(current.data.status))
  );
}

function assuranceMatches(
  candidate: ReviewCandidate,
  stamp: ReturnType<typeof parseReviewStamps>[number],
  independence: 'cross-agent' | 'degraded',
): boolean {
  const { data, output } = candidate;
  return [
    stamp.independence === independence,
    stamp.author === data.author_agent,
    stamp.reviewer === data.actual_reviewer,
    output.reviewer_agent === data.actual_reviewer,
    typeof data.author_agent === 'string',
    typeof data.actual_reviewer === 'string',
  ].every(Boolean);
}

function assuranceAdmission(
  candidate: ReviewCandidate,
  stamp: ReturnType<typeof parseReviewStamps>[number],
  label: string,
): PhaseReviewAdmission {
  const { data } = candidate;
  const independence = data.independence;
  if (independence !== 'cross-agent' && independence !== 'degraded') {
    return {
      kind: 'unearned_assurance',
      message: `The ${label} review has no validated achieved independence.`,
    };
  }
  if (independence === 'cross-agent' && data.author_agent === data.actual_reviewer) {
    return {
      kind: 'unearned_assurance',
      message: `The ${label} review's self-authored cross-agent claim did not establish achieved independence.`,
    };
  }
  if (!assuranceMatches(candidate, stamp, independence)) {
    return {
      kind: 'unearned_assurance',
      message: `The recorded assurance disagrees with the authenticated ${label} review.`,
    };
  }
  return {
    kind: 'admitted',
    provenance: {
      authorAgent: data.author_agent,
      reviewerAgent: data.actual_reviewer,
      independence,
    },
  };
}

/** Admit an authenticated, current semantic phase review and its achieved assurance. */
export function phaseReviewAdmission(input: {
  readonly cwd: string;
  readonly ticketDirectory: string;
  readonly kind: Extract<ReviewKind, 'scenario-gate' | 'plan-implementation'>;
  readonly target: string;
  readonly ledger: string;
  readonly label: string;
}): PhaseReviewAdmission {
  const scope = `${nodePath.basename(input.ticketDirectory)}:phase@${input.kind}`;
  const stamps = parseReviewStamps(input.ledger)
    .filter(stamp => stamp.scope === scope && stamp.skipReason === undefined)
    .toReversed();

  for (const stamp of stamps) {
    if (stamp.reviewId === undefined) continue;
    const candidate = reviewCandidate(input, stamp.reviewId);
    if (candidate === undefined) continue;
    if (!isCurrentReceipt(input.cwd, stamp.reviewId)) return { kind: 'not_admitted' };
    const { data, output } = candidate;
    if (output.verdict === 'request_changes') {
      return { kind: 'rejected', message: rejectionMessage(output, input.label) };
    }
    if (output.verdict !== 'approve' || data.status !== 'approved') {
      return { kind: 'not_admitted' };
    }
    return assuranceAdmission(candidate, stamp, input.label);
  }
  return { kind: 'not_admitted' };
}
