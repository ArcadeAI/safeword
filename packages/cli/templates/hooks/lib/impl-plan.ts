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

const STATUS_PREFIX = '**Status:**';

export function parseImplPlan(content: string): ImplPlanResult {
  const errors: string[] = [];
  let status: ImplPlanStatus | null = null;

  let sawStatusLine = false;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(STATUS_PREFIX)) continue;
    sawStatusLine = true;
    const value = trimmed.slice(STATUS_PREFIX.length).trim();
    if (value === 'planned' || value === 'implemented') {
      status = value;
    }
    break;
  }

  if (!sawStatusLine) {
    errors.push(
      `Missing \`${STATUS_PREFIX}\` line — add \`${STATUS_PREFIX} planned\` near the top.`,
    );
  }

  return { status, errors };
}
