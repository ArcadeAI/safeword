import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { QUALITY_REVIEW_RUBRIC } from '../../src/review/quality-rubric.generated.js';
import {
  extractQualityReviewRubric,
  QUALITY_RUBRIC_END,
  QUALITY_RUBRIC_START,
} from '../../src/review/quality-rubric.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '../..');
const canonicalSkill = readFileSync(
  nodePath.join(packageRoot, 'templates/skills/quality-review/SKILL.md'),
  'utf8',
);
const degradedContract = readFileSync(
  nodePath.join(packageRoot, 'templates/skills/finish-review/REVIEWER.md'),
  'utf8',
);
const scenarioSkill = readFileSync(
  nodePath.join(packageRoot, 'templates/skills/review-spec/SKILL.md'),
  'utf8',
);
const planSkill = readFileSync(
  nodePath.join(packageRoot, 'templates/skills/bdd/PLAN_IMPLEMENTATION.md'),
  'utf8',
);

describe('quality-review rubric generation', () => {
  it('keeps independent and degraded reviewers on the canonical severity contract', () => {
    const canonicalRubric = extractQualityReviewRubric(canonicalSkill);
    for (const skill of [canonicalSkill, degradedContract, scenarioSkill, planSkill]) {
      expect(skill).toContain(`\n${QUALITY_RUBRIC_START}\n`);
    }
    expect(QUALITY_REVIEW_RUBRIC).toBe(canonicalRubric);
    expect(extractQualityReviewRubric(degradedContract)).toBe(canonicalRubric);
    expect(extractQualityReviewRubric(scenarioSkill)).toBe(canonicalRubric);
    expect(extractQualityReviewRubric(planSkill)).toBe(canonicalRubric);
  });

  it.each([
    ['missing markers', 'rubric'],
    [
      'duplicate start',
      `${QUALITY_RUBRIC_START} a ${QUALITY_RUBRIC_START} b ${QUALITY_RUBRIC_END}`,
    ],
    ['empty block', `${QUALITY_RUBRIC_START} \n ${QUALITY_RUBRIC_END}`],
    ['reversed markers', `${QUALITY_RUBRIC_END} rubric ${QUALITY_RUBRIC_START}`],
  ])('rejects %s', (_label, skill) => {
    expect(() => extractQualityReviewRubric(skill)).toThrow();
  });

  it.each(['run-review.ts', '/finish-review', 'write-review-stamp.ts'])(
    'rejects host-only instruction %s inside the shared block',
    instruction => {
      const skill = `${QUALITY_RUBRIC_START}\n${instruction}\n${QUALITY_RUBRIC_END}`;
      expect(() => extractQualityReviewRubric(skill)).toThrow('host-only instruction');
    },
  );
});
