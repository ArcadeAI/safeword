export const EXECUTION_PLAN_RUBRIC_START = '<!-- SAFEWORD:EXECUTION_PLAN_RUBRIC_START -->';
export const EXECUTION_PLAN_RUBRIC_END = '<!-- SAFEWORD:EXECUTION_PLAN_RUBRIC_END -->';

/** Extract the reviewer-safe block from the canonical Execution Planning reference. */
export function extractExecutionPlanReviewRubric(reference: string): string {
  const starts = reference.split(EXECUTION_PLAN_RUBRIC_START).length - 1;
  const ends = reference.split(EXECUTION_PLAN_RUBRIC_END).length - 1;
  if (starts !== 1 || ends !== 1) {
    throw new Error('PLAN_EXECUTION.md must contain exactly one rubric marker pair');
  }
  const start = reference.indexOf(EXECUTION_PLAN_RUBRIC_START) + EXECUTION_PLAN_RUBRIC_START.length;
  const end = reference.indexOf(EXECUTION_PLAN_RUBRIC_END);
  if (end <= start) throw new Error('PLAN_EXECUTION.md rubric markers are out of order');
  const rubric = reference.slice(start, end).trim();
  if (rubric === '') throw new Error('PLAN_EXECUTION.md rubric is empty');
  for (const forbidden of [
    'run-review.ts',
    '/finish-review',
    'advance the ticket',
    'write-review-stamp.ts',
  ]) {
    if (rubric.includes(forbidden)) {
      throw new Error(`PLAN_EXECUTION.md rubric contains host-only instruction: ${forbidden}`);
    }
  }
  return rubric;
}
