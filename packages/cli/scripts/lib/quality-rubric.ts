import { extractRubricBlock } from './extract-rubric-block.js';

export const QUALITY_RUBRIC_START = '<!-- SAFEWORD:QUALITY_RUBRIC_START -->';
export const QUALITY_RUBRIC_END = '<!-- SAFEWORD:QUALITY_RUBRIC_END -->';

/** Extract the reviewer-safe severity contract from a quality-review surface. */
export function extractQualityReviewRubric(skill: string): string {
  const rubric = extractRubricBlock(skill, QUALITY_RUBRIC_START, QUALITY_RUBRIC_END, {
    missingPair: 'quality review must contain exactly one quality-rubric marker pair',
    outOfOrder: 'quality-review rubric markers are out of order',
    empty: 'quality-review rubric is empty',
  });
  for (const forbidden of ['run-review.ts', '/finish-review', 'write-review-stamp.ts']) {
    if (rubric.includes(forbidden)) {
      throw new Error(`quality-review rubric contains host-only instruction: ${forbidden}`);
    }
  }
  return rubric;
}
