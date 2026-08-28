import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { PLAN_REVIEW_RUBRIC } from '../../src/review/plan-rubric.generated.js';
import {
  extractPlanReviewRubric,
  PLAN_RUBRIC_END,
  PLAN_RUBRIC_START,
} from '../../src/review/plan-rubric.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '../..');
const canonicalSkill = readFileSync(
  nodePath.join(packageRoot, 'templates/skills/bdd/PLAN_IMPLEMENTATION.md'),
  'utf8',
);

describe('plan rubric generation', () => {
  it('keeps reviewer instructions byte-equal to the canonical authoring block', () => {
    expect(PLAN_REVIEW_RUBRIC).toBe(extractPlanReviewRubric(canonicalSkill));
  });

  it.each([
    ['missing markers', 'rubric'],
    ['duplicate start', `${PLAN_RUBRIC_START} a ${PLAN_RUBRIC_START} b ${PLAN_RUBRIC_END}`],
    ['empty block', `${PLAN_RUBRIC_START} \n ${PLAN_RUBRIC_END}`],
    ['reversed markers', `${PLAN_RUBRIC_END} rubric ${PLAN_RUBRIC_START}`],
  ])('rejects %s', (_label, skill) => {
    expect(() => extractPlanReviewRubric(skill)).toThrow();
  });

  it.each(['run-review.ts', '/finish-review', 'write-review-stamp.ts', 'designApprovalGate'])(
    'rejects host-only instruction %s inside the shared block',
    instruction => {
      const skill = `${PLAN_RUBRIC_START}\n${instruction}\n${PLAN_RUBRIC_END}`;
      expect(() => extractPlanReviewRubric(skill)).toThrow('host-only instruction');
    },
  );
});
