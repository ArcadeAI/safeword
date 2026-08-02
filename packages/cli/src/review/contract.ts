export type ReviewAgent = 'claude' | 'codex';
export type ReviewAuthor = ReviewAgent | 'cursor' | 'unknown';
export type ReviewKind = 'quality-review' | 'scenario-gate' | 'plan-implementation';
export type ReviewPolicy = 'prefer' | 'require' | 'off';
export type ReviewIndependence = 'cross-agent' | 'degraded' | 'none';
export type ReviewFailure =
  | 'not_installed'
  | 'not_authenticated'
  | 'process_failed'
  | 'timed_out'
  | 'invalid_output'
  | 'source_changed';

export interface ReviewFinding {
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: string;
}

export interface ReviewerOutput {
  readonly schema_version: 1;
  readonly dispatch_id: string;
  readonly reviewer_agent: ReviewAgent;
  readonly verdict: 'approve' | 'request_changes';
  readonly summary: string;
  readonly findings: readonly ReviewFinding[];
}

export interface ReviewPacket {
  readonly schema_version: 1;
  readonly dispatch_id: string;
  readonly kind: ReviewKind;
  readonly logical_files: readonly {
    readonly path: string;
    readonly content: string;
  }[];
}

export const REVIEW_KINDS = new Set<ReviewKind>([
  'quality-review',
  'scenario-gate',
  'plan-implementation',
]);

export function isReviewKind(value: unknown): value is ReviewKind {
  return typeof value === 'string' && REVIEW_KINDS.has(value as ReviewKind);
}
