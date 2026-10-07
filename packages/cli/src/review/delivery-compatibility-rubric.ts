export const DELIVERY_COMPATIBILITY_RUBRIC_START =
  '<!-- SAFEWORD:DELIVERY_COMPATIBILITY_RUBRIC_START -->';
export const DELIVERY_COMPATIBILITY_RUBRIC_END =
  '<!-- SAFEWORD:DELIVERY_COMPATIBILITY_RUBRIC_END -->';

/** Extract the reviewer-safe compatibility block from Execution Planning. */
export function extractDeliveryCompatibilityReviewRubric(reference: string): string {
  const starts = reference.split(DELIVERY_COMPATIBILITY_RUBRIC_START).length - 1;
  const ends = reference.split(DELIVERY_COMPATIBILITY_RUBRIC_END).length - 1;
  if (starts !== 1 || ends !== 1) {
    throw new Error('PLAN_EXECUTION.md must contain exactly one compatibility rubric marker pair');
  }
  const start =
    reference.indexOf(DELIVERY_COMPATIBILITY_RUBRIC_START) +
    DELIVERY_COMPATIBILITY_RUBRIC_START.length;
  const end = reference.indexOf(DELIVERY_COMPATIBILITY_RUBRIC_END);
  if (end <= start)
    throw new Error('PLAN_EXECUTION.md compatibility rubric markers are out of order');
  const rubric = reference.slice(start, end).trim();
  if (rubric === '') throw new Error('PLAN_EXECUTION.md compatibility rubric is empty');
  return rubric;
}
