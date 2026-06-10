// Safeword: impl-plan.md parsing + section validation (ticket XDNSZA).
//
// Pure helpers (no I/O) so the stop-quality hook can validate a ticket's
// impl-plan.md without importing the CLI dist (same cross-runtime-copy
// rationale as jtbd.ts — deployed hooks run standalone from .safeword/hooks/).

export type ImplPlanStatus = 'planned' | 'implemented';

/** The five required impl-plan sections, in template order. */
export const IMPL_PLAN_SECTIONS = [
  'Approach',
  'Decisions',
  'Arch alignment',
  'Known deviations',
  'Assessment triggers',
] as const;

export type ImplPlanSectionName = (typeof IMPL_PLAN_SECTIONS)[number];

export interface ImplPlanSectionVerdict {
  /** True when the section has real content or a valid skip. */
  satisfied: boolean;
  /** The skip reason when the section is skip-annotated; null otherwise. */
  skip: string | null;
}

export interface ImplPlanResult {
  /** Parsed status, or null when the line is missing or carries an unknown value. */
  status: ImplPlanStatus | null;
  /** Per-section verdicts keyed by canonical section name. */
  sections: Partial<Record<ImplPlanSectionName, ImplPlanSectionVerdict>>;
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
    } else {
      errors.push(`Unknown status "${value}" — allowed values: planned, implemented.`);
    }
    break;
  }

  if (!sawStatusLine) {
    errors.push(
      `Missing \`${STATUS_PREFIX}\` line — add \`${STATUS_PREFIX} planned\` near the top.`,
    );
  }

  return { status, sections: {}, errors };
}
