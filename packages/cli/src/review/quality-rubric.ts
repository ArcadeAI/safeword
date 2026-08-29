export const QUALITY_RUBRIC_START = '<!-- SAFEWORD:QUALITY_RUBRIC_START -->';
export const QUALITY_RUBRIC_END = '<!-- SAFEWORD:QUALITY_RUBRIC_END -->';

/** Extract the reviewer-safe severity contract from a quality-review surface. */
export function extractQualityReviewRubric(skill: string): string {
  const starts = skill.split(QUALITY_RUBRIC_START).length - 1;
  const ends = skill.split(QUALITY_RUBRIC_END).length - 1;
  if (starts !== 1 || ends !== 1) {
    throw new Error('quality review must contain exactly one quality-rubric marker pair');
  }
  const start = skill.indexOf(QUALITY_RUBRIC_START) + QUALITY_RUBRIC_START.length;
  const end = skill.indexOf(QUALITY_RUBRIC_END);
  if (end <= start) throw new Error('quality-review rubric markers are out of order');
  const rubric = skill.slice(start, end).trim();
  if (rubric === '') throw new Error('quality-review rubric is empty');
  for (const forbidden of ['run-review.ts', '/finish-review', 'write-review-stamp.ts']) {
    if (rubric.includes(forbidden)) {
      throw new Error(`quality-review rubric contains host-only instruction: ${forbidden}`);
    }
  }
  return rubric;
}
