import { extractRubricBlock } from './extract-rubric-block.js';

export const RED_RUBRIC_START = '<!-- SAFEWORD:EXECUTABLE_RED_RUBRIC_START -->';
export const RED_RUBRIC_END = '<!-- SAFEWORD:EXECUTABLE_RED_RUBRIC_END -->';

/** Extract the reviewer-safe executable RED contract from the canonical TDD-review skill. */
export function extractExecutableRedRubric(skill: string): string {
  return extractRubricBlock(skill, RED_RUBRIC_START, RED_RUBRIC_END, {
    missingPair: 'tdd-review must contain exactly one executable RED rubric marker pair',
    outOfOrder: 'tdd-review executable RED rubric is empty',
    empty: 'tdd-review executable RED rubric is empty',
  });
}
