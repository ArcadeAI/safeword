export type ReviewAgent = 'claude' | 'codex' | 'opencode';
export type ReviewAuthor = ReviewAgent | 'cursor' | 'unknown';
export type ReviewKind =
  'quality-review' | 'scenario-gate' | 'plan-implementation' | 'executable-red';
/** Internal packet kind; public command parsing adds plan-execution only at activation. */
export type ReviewPacketKind = ReviewKind | 'plan-execution';
export type ReviewPolicy = 'prefer' | 'require' | 'off';
export type RedEvidenceClass =
  'pure-contract' | 'simulated-host' | 'local-live-host' | 'external-live-host';

export interface RedExecutionRequest {
  readonly scenario: string;
  readonly ledger: string;
  readonly argv: readonly [string, ...string[]];
  readonly cwd: string;
  readonly evidenceClass: RedEvidenceClass;
  readonly expectedFailure: string;
  readonly timeoutMs: number;
}

export interface RedExecutionAttestation {
  readonly schema_version: 1;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly evidence_class: RedEvidenceClass;
  readonly expected_failure: { readonly literal: string; readonly matched: boolean };
  readonly timeout_ms: number;
  readonly source_fingerprint: string;
  readonly environment: {
    readonly sha256: string;
    readonly variable_count: number;
    readonly platform: string;
    readonly arch: string;
    readonly node: string;
    readonly bun?: string;
  };
  readonly started_at: string;
  readonly finished_at: string;
  readonly duration_ms: number;
  readonly termination: {
    readonly exit_code: number | null;
    readonly signal: NodeJS.Signals | null;
    readonly timed_out: boolean;
  };
  readonly stdout: RedExecutionStream;
  readonly stderr: RedExecutionStream;
}

export interface RedExecutionStream {
  readonly excerpt: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly truncated: boolean;
}
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

export interface ExecutionPlanSlice {
  readonly name: string;
  readonly purpose: string;
  readonly boundary: string;
  readonly prerequisites: readonly string[];
  readonly proof: string;
  readonly completion_signal: string;
  readonly relies_on_unmerged_successor: boolean;
}

export interface ExecutionPlanObligationOwner {
  readonly obligation: string;
  readonly slices: readonly string[];
}

export interface ExecutionPlanDecisionStatus {
  readonly decision: string;
  readonly status: 'unchanged';
}

export interface ExecutionPlanRecord {
  readonly slicing_decision: 'one_pull_request' | 'multiple_pull_requests';
  readonly rationale: string;
  readonly slices: readonly ExecutionPlanSlice[];
  readonly obligation_owners: readonly ExecutionPlanObligationOwner[];
  readonly decision_statuses: readonly ExecutionPlanDecisionStatus[];
}

export interface ReviewerOutput {
  readonly schema_version: 1;
  readonly dispatch_id: string;
  readonly reviewer_agent: ReviewAgent;
  readonly verdict: 'approve' | 'request_changes';
  readonly summary: string;
  readonly findings: readonly ReviewFinding[];
  readonly execution_plan_record?: ExecutionPlanRecord | null;
}

export interface UnverifiedReviewerOutput {
  readonly schema_version: 1;
  readonly dispatch_id?: unknown;
  readonly reviewer_agent?: unknown;
  readonly verdict: 'approve' | 'request_changes';
  readonly summary: string;
  readonly findings: readonly ReviewFinding[];
  readonly execution_plan_record?: unknown;
}

export interface PlanContractIdentity {
  readonly sha256: string;
  readonly obligations: readonly string[];
}

export interface PlanContractPair {
  readonly author: PlanContractIdentity;
  readonly reviewer: PlanContractIdentity;
}

export interface ReviewPacket {
  readonly schema_version: 1;
  readonly dispatch_id: string;
  readonly kind: ReviewPacketKind;
  readonly logical_files: readonly {
    readonly path: string;
    readonly content: string;
  }[];
  /** Bounded evidence available to the reviewer, but not part of the work product. */
  readonly context_files?: readonly {
    readonly path: string;
    readonly content: string;
  }[];
  /** Exact author/reviewer planning obligations carried through semantic review. */
  readonly plan_contract?: PlanContractPair;
  /** Trusted process evidence, present only for executable RED review. */
  readonly execution_attestation?: RedExecutionAttestation;
}

const REVIEW_KINDS = new Set<ReviewKind>([
  'quality-review',
  'scenario-gate',
  'plan-implementation',
  'executable-red',
]);

export function isReviewKind(value: unknown): value is ReviewKind {
  return typeof value === 'string' && REVIEW_KINDS.has(value as ReviewKind);
}
