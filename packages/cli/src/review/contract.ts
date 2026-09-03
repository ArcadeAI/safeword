export type ReviewAgent = 'claude' | 'codex' | 'opencode';
export type ReviewAuthor = ReviewAgent | 'cursor' | 'unknown';
export type ReviewKind = 'quality-review' | 'scenario-gate' | 'plan-implementation';
export type ReviewPolicy = 'prefer' | 'require' | 'off';
export type ReviewFailure =
  | 'not_installed'
  | 'untrusted_install'
  | 'unsupported'
  | 'probe_timed_out'
  | 'launch_failed'
  | 'not_authenticated'
  | 'process_failed'
  | 'timed_out'
  | 'invalid_output'
  | 'REVIEWER_PROVENANCE_MISSING'
  | 'REVIEWER_PROVENANCE_CONTRADICTORY';

interface ReviewFinding {
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

export interface UnverifiedReviewerOutput {
  readonly schema_version: 1;
  readonly dispatch_id?: unknown;
  readonly reviewer_agent?: unknown;
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
  /** Bounded evidence available to the reviewer, but not part of the work product. */
  readonly context_files?: readonly {
    readonly path: string;
    readonly content: string;
  }[];
}

const REVIEW_KINDS = new Set<ReviewKind>([
  'quality-review',
  'scenario-gate',
  'plan-implementation',
]);

export function isReviewKind(value: unknown): value is ReviewKind {
  return typeof value === 'string' && REVIEW_KINDS.has(value as ReviewKind);
}
