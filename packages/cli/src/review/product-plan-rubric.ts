export const PRODUCT_PLAN_RUBRIC_START = '<!-- SAFEWORD:PRODUCT_PLAN_RUBRIC_START -->';
export const PRODUCT_PLAN_RUBRIC_END = '<!-- SAFEWORD:PRODUCT_PLAN_RUBRIC_END -->';

/** Extract the reviewer-safe Product decision from its canonical authoring owner. */
export function extractProductPlanReviewRubric(skill: string): string {
  const starts = skill.split(PRODUCT_PLAN_RUBRIC_START).length - 1;
  const ends = skill.split(PRODUCT_PLAN_RUBRIC_END).length - 1;
  if (starts !== 1 || ends !== 1) {
    throw new Error('DISCOVERY.md must contain exactly one Product Plan rubric marker pair');
  }
  const start = skill.indexOf(PRODUCT_PLAN_RUBRIC_START) + PRODUCT_PLAN_RUBRIC_START.length;
  const end = skill.indexOf(PRODUCT_PLAN_RUBRIC_END);
  if (end <= start) throw new Error('DISCOVERY.md Product Plan rubric markers are out of order');
  const rubric = skill.slice(start, end).trim();
  if (rubric === '') throw new Error('DISCOVERY.md Product Plan rubric is empty');
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
        `DISCOVERY.md Product Plan rubric contains host-only instruction: ${forbidden}`,
      );
    }
  }
  return rubric;
}
