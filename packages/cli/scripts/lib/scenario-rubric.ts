import { extractRubricBlock } from './extract-rubric-block.js';

export const SCENARIO_RUBRIC_START = '<!-- SAFEWORD:SCENARIO_RUBRIC_START -->';
export const SCENARIO_RUBRIC_END = '<!-- SAFEWORD:SCENARIO_RUBRIC_END -->';

/** Extract the one reviewer-safe rubric block from the canonical skill. */
export function extractScenarioReviewRubric(skill: string): string {
  const rubric = extractRubricBlock(skill, SCENARIO_RUBRIC_START, SCENARIO_RUBRIC_END, {
    missingPair: 'review-spec must contain exactly one scenario-rubric marker pair',
    outOfOrder: 'review-spec scenario-rubric markers are out of order',
    empty: 'review-spec scenario rubric is empty',
  });
  for (const forbidden of [
    'run-review.ts',
    'resolve-project-knowledge.ts',
    '/finish-review',
    'advance the phase',
    'Authoring mode',
    'Review mode',
  ]) {
    if (rubric.includes(forbidden)) {
      throw new Error(`review-spec scenario rubric contains host-only instruction: ${forbidden}`);
    }
  }
  return rubric;
}
