export const SCENARIO_RUBRIC_START = '<!-- SAFEWORD:SCENARIO_RUBRIC_START -->';
export const SCENARIO_RUBRIC_END = '<!-- SAFEWORD:SCENARIO_RUBRIC_END -->';

/** Extract the one reviewer-safe rubric block from the canonical skill. */
export function extractScenarioReviewRubric(skill: string): string {
  const starts = skill.split(SCENARIO_RUBRIC_START).length - 1;
  const ends = skill.split(SCENARIO_RUBRIC_END).length - 1;
  if (starts !== 1 || ends !== 1) {
    throw new Error('review-spec must contain exactly one scenario-rubric marker pair');
  }
  const start = skill.indexOf(SCENARIO_RUBRIC_START) + SCENARIO_RUBRIC_START.length;
  const end = skill.indexOf(SCENARIO_RUBRIC_END);
  if (end <= start) throw new Error('review-spec scenario-rubric markers are out of order');
  const rubric = skill.slice(start, end).trim();
  if (rubric === '') throw new Error('review-spec scenario rubric is empty');
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
