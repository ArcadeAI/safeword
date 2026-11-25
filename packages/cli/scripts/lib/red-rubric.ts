export const RED_RUBRIC_START = '<!-- SAFEWORD:EXECUTABLE_RED_RUBRIC_START -->';
export const RED_RUBRIC_END = '<!-- SAFEWORD:EXECUTABLE_RED_RUBRIC_END -->';

/** Extract the reviewer-safe executable RED contract from the canonical TDD-review skill. */
export function extractExecutableRedRubric(skill: string): string {
  if (skill.split(RED_RUBRIC_START).length !== 2 || skill.split(RED_RUBRIC_END).length !== 2)
    throw new Error('tdd-review must contain exactly one executable RED rubric marker pair');
  const start = skill.indexOf(RED_RUBRIC_START) + RED_RUBRIC_START.length;
  const end = skill.indexOf(RED_RUBRIC_END);
  const rubric = skill.slice(start, end).trim();
  if (end <= start || rubric === '') throw new Error('tdd-review executable RED rubric is empty');
  return rubric;
}
