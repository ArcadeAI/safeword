import { describe, expect, it } from 'vitest';

import { PLAN_REVIEW_RUBRIC } from '../../src/review/plan-rubric.generated.js';
import {
  DECISION_QUALITY_OBLIGATION,
  DECISION_QUALITY_REQUIREMENTS,
  type DecisionEvidenceFixture,
  reviewDecisionEvidence,
} from '../fixtures/plan-decision-evidence.js';
import { obligationClause } from '../fixtures/plan-focused-reviewability.js';

const currentEvidence = {
  evidenceBaseline: 'framework 4.1',
} as const;

describe('Implementation Plan decision-evidence contract', () => {
  it.each<{
    readonly name: string;
    readonly fixture: DecisionEvidenceFixture;
    readonly verdict: 'approve' | 'request_changes';
    readonly finding?: string;
  }>([
    {
      name: 'rejects a choice with no credible alternative',
      fixture: {
        ...currentEvidence,
        alternatives: [{ name: 'legacy adapter', credible: false }],
      },
      verdict: 'request_changes',
      finding: 'Name at least one credible alternative',
    },
    {
      name: 'rejects a credible alternative with no losing reason',
      fixture: {
        ...currentEvidence,
        alternatives: [{ name: 'shared adapter', credible: true }],
      },
      verdict: 'request_changes',
      finding: 'why the credible alternative',
    },
    {
      name: 'accepts a current baseline with a credible alternative and losing reason',
      fixture: {
        ...currentEvidence,
        alternatives: [
          {
            name: 'shared adapter',
            credible: true,
            losingReason: 'it cannot preserve the required failure boundary',
          },
        ],
      },
      verdict: 'approve',
    },
    {
      name: 'rejects evidence superseded by a named release after the choice',
      fixture: {
        ...currentEvidence,
        namedSupersedingRelease: 'framework 5.0',
        alternatives: [
          {
            name: 'shared adapter',
            credible: true,
            losingReason: 'it cannot preserve the required failure boundary',
          },
        ],
      },
      verdict: 'request_changes',
      finding: 'framework 5.0',
    },
  ])('$name', ({ fixture, verdict, finding }) => {
    const result = reviewDecisionEvidence(PLAN_REVIEW_RUBRIC, fixture);

    const contractFailures = result.findings.filter(candidate =>
      candidate.message.startsWith('The packaged plan contract is missing'),
    );
    expect(
      contractFailures,
      contractFailures.map(candidate => candidate.message).join('\n'),
    ).toEqual([]);
    expect(result.verdict).toBe(verdict);
    if (finding !== undefined) {
      expect(result.findings.some(candidate => candidate.message.includes(finding))).toBe(true);
    }
  });

  it.each(DECISION_QUALITY_REQUIREMENTS)(
    'fails closed when the contract drops $name',
    requirement => {
      const existingClause =
        obligationClause(PLAN_REVIEW_RUBRIC, DECISION_QUALITY_OBLIGATION) ?? '';
      const normalizedClause = existingClause.replaceAll(/\s+/gu, ' ');
      for (const requiredClause of DECISION_QUALITY_REQUIREMENTS) {
        expect(normalizedClause).toMatch(requiredClause.pattern);
      }
      const existingOffset = PLAN_REVIEW_RUBRIC.indexOf(existingClause);
      const mutatedClause = normalizedClause.replace(requirement.pattern, '');
      const mutatedContract = `${PLAN_REVIEW_RUBRIC.slice(0, existingOffset)}${mutatedClause}${PLAN_REVIEW_RUBRIC.slice(existingOffset + existingClause.length)}`;

      const result = reviewDecisionEvidence(mutatedContract, {
        ...currentEvidence,
        alternatives: [
          {
            name: 'shared adapter',
            credible: true,
            losingReason: 'it cannot preserve the required failure boundary',
          },
        ],
      });

      expect(result.verdict).toBe('request_changes');
      expect(result.findings).toEqual([
        expect.objectContaining({ message: expect.stringContaining(requirement.name) }),
      ]);
    },
  );
});
