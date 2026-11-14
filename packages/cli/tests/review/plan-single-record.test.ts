import { describe, expect, it } from 'vitest';

import { PLAN_REVIEW_RUBRIC } from '../../src/review/plan-rubric.generated.js';
import {
  missingPlanOfRecordRequirements,
  PLAN_OF_RECORD_OBLIGATION,
  PLAN_OF_RECORD_REQUIREMENTS,
  reviewPlanOfRecord,
} from '../fixtures/plan-single-record.js';

describe('Implementation Plan is the single feature design plan of record', () => {
  it.each([
    {
      plan: 'Required decision location: impl-plan.md\n',
      supporting: new Set<string>(),
      verdict: 'approve',
      finding: undefined,
    },
    {
      plan: 'Required decision location: linked supporting detail\nDecision and consequence: Gateway authorization is shared.\nSupporting detail: docs/detail.md\nSupporting authority: subordinate\n',
      supporting: new Set(['docs/detail.md']),
      verdict: 'approve',
      finding: undefined,
    },
    {
      plan: 'Required decision location: second feature design document\nSupporting detail: docs/alternate.md\n',
      supporting: new Set(['docs/alternate.md']),
      verdict: 'request_changes',
      finding: 'Return required decisions',
    },
    {
      plan: 'Required decision location: linked supporting detail\nDecision and consequence: Gateway authorization is shared.\nSupporting detail: docs/alternate.md\nSupporting authority: independent feature plan\n',
      supporting: new Set(['docs/alternate.md']),
      verdict: 'request_changes',
      finding: 'Return feature-plan authority',
    },
  ])('judges $verdict plan authority', ({ finding, plan, supporting, verdict }) => {
    const result = reviewPlanOfRecord(PLAN_REVIEW_RUBRIC, plan, supporting);
    expect(
      result.findings.filter(candidate => candidate.message.startsWith('The packaged contract')),
    ).toEqual([]);
    expect(result.summary).toContain('impl-plan.md is the single design plan of record');
    expect(result.verdict).toBe(verdict);
    if (finding === undefined) expect(result.findings).toEqual([]);
    else expect(result.findings[0]?.message).toContain(finding);
  });

  it.each(PLAN_OF_RECORD_REQUIREMENTS)(
    'fails closed when the packaged obligation drops %s',
    phrase => {
      const result = reviewPlanOfRecord(
        PLAN_REVIEW_RUBRIC.replaceAll(phrase, ''),
        'Required decision location: impl-plan.md\n',
        new Set(),
      );
      expect(result.verdict).toBe('request_changes');
      expect(result.findings[0]?.message.toLowerCase()).toContain(phrase.toLowerCase());
    },
  );

  it('fails closed when the whole plan-of-record obligation is absent', () => {
    expect(missingPlanOfRecordRequirements('')).toEqual([PLAN_OF_RECORD_OBLIGATION]);
  });
});
