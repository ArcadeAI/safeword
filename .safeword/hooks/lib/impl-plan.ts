// Safeword: impl-plan.md parsing + section validation (ticket XDNSZA).
//
// Pure helpers (no I/O) so the stop-quality hook can validate a ticket's
// impl-plan.md without importing the CLI dist (same cross-runtime-copy
// rationale as jtbd.ts — deployed hooks run standalone from .safeword/hooks/).

export type ImplPlanStatus = 'planned' | 'implemented';

export interface ImplPlanResult {
  /** Parsed status, or null when the line is missing or carries an unknown value. */
  status: ImplPlanStatus | null;
  /** Validation errors; empty when the plan is valid. */
  errors: string[];
}

export function parseImplPlan(_content: string): ImplPlanResult {
  throw new Error('not implemented');
}
