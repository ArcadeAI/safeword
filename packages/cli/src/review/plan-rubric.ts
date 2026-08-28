export const PLAN_RUBRIC_START = '<!-- SAFEWORD:PLAN_RUBRIC_START -->';
export const PLAN_RUBRIC_END = '<!-- SAFEWORD:PLAN_RUBRIC_END -->';

/** Extract the one reviewer-safe rubric block from the canonical planning skill. */
export function extractPlanReviewRubric(skill: string): string {
  const starts = skill.split(PLAN_RUBRIC_START).length - 1;
  const ends = skill.split(PLAN_RUBRIC_END).length - 1;
  if (starts !== 1 || ends !== 1) {
    throw new Error('PLAN_IMPLEMENTATION.md must contain exactly one plan-rubric marker pair');
  }
  const start = skill.indexOf(PLAN_RUBRIC_START) + PLAN_RUBRIC_START.length;
  const end = skill.indexOf(PLAN_RUBRIC_END);
  if (end <= start) throw new Error('PLAN_IMPLEMENTATION.md plan-rubric markers are out of order');
  const rubric = skill.slice(start, end).trim();
  if (rubric === '') throw new Error('PLAN_IMPLEMENTATION.md plan rubric is empty');
  for (const forbidden of [
    'run-review.ts',
    'resolve-project-knowledge.ts',
    '/finish-review',
    'advance the phase',
    'write-review-stamp.ts',
    'designApprovalGate',
  ]) {
    if (rubric.includes(forbidden)) {
      throw new Error(
        `PLAN_IMPLEMENTATION.md plan rubric contains host-only instruction: ${forbidden}`,
      );
    }
  }
  return rubric;
}
