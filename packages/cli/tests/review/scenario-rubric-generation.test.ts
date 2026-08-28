import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { SCENARIO_REVIEW_RUBRIC } from '../../src/review/scenario-rubric.generated.js';
import {
  extractScenarioReviewRubric,
  SCENARIO_RUBRIC_END,
  SCENARIO_RUBRIC_START,
} from '../../src/review/scenario-rubric.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '../..');
const canonicalSkill = readFileSync(
  nodePath.join(packageRoot, 'templates/skills/review-spec/SKILL.md'),
  'utf8',
);

describe('scenario rubric generation', () => {
  it('keeps the generated reviewer instructions byte-equal to the canonical shared block', () => {
    expect(SCENARIO_REVIEW_RUBRIC).toBe(extractScenarioReviewRubric(canonicalSkill));
  });

  it.each([
    ['missing markers', 'rubric'],
    [
      'duplicate start',
      `${SCENARIO_RUBRIC_START} a ${SCENARIO_RUBRIC_START} b ${SCENARIO_RUBRIC_END}`,
    ],
    ['empty block', `${SCENARIO_RUBRIC_START} \n ${SCENARIO_RUBRIC_END}`],
    ['reversed markers', `${SCENARIO_RUBRIC_END} rubric ${SCENARIO_RUBRIC_START}`],
  ])('rejects %s', (_label, skill) => {
    expect(() => extractScenarioReviewRubric(skill)).toThrow();
  });

  it.each(['run-review.ts', '/finish-review', 'Authoring mode', 'Review mode'])(
    'rejects host-only instruction %s inside the shared block',
    instruction => {
      const skill = `${SCENARIO_RUBRIC_START}\n${instruction}\n${SCENARIO_RUBRIC_END}`;
      expect(() => extractScenarioReviewRubric(skill)).toThrow('host-only instruction');
    },
  );
});
