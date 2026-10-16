import { describe, expect, it } from 'vitest';

import { PLAN_REVIEW_RUBRIC } from '../../src/review/plan-rubric.generated.js';
import { evaluateImplementationInspiration } from '../../templates/hooks/lib/inspiration.js';
import {
  DECISION_EVIDENCE_APPLICABILITY_OBLIGATION,
  DECISION_EVIDENCE_APPLICABILITY_REQUIREMENTS,
  evidenceApplicabilityPlan,
  missingEvidenceApplicabilityPlan,
  reviewDecisionEvidenceApplicability,
} from '../fixtures/plan-decision-evidence-applicability.js';
import { obligationClause } from '../fixtures/plan-focused-reviewability.js';

const ticketContent = [
  '---',
  'id: EXAMPLE',
  'type: feature',
  'inspiration_contract: v1',
  'inspiration_contract_scaffold: v1',
  'created: 2026-09-10T00:00:00.000Z',
  '---',
].join('\n');
const specContent = '<!-- safeword:inspiration-contract:v1 -->\n# Spec: Example\n';

function inspectStructure(planContent: string) {
  return evaluateImplementationInspiration({
    ticketContent,
    specContent,
    planContent,
    evaluationDate: '2026-09-10',
  });
}

describe('Implementation Plan decision-evidence applicability', () => {
  it('names a missing decision entry when neither evidence nor a skip is present', () => {
    const plan = missingEvidenceApplicabilityPlan();

    const result = inspectStructure(plan);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('missing decision entry');
  });

  it.each([
    {
      name: 'a skip shown only inside a fenced example',
      plan: missingEvidenceApplicabilityPlan().replace('### Recorded Decisions', () =>
        [
          '### Recorded Decisions',
          '',
          '```md',
          'Decision evidence applicability: skip: no load-bearing technology choices',
          '```',
        ].join('\n'),
      ),
    },
    {
      name: 'a skip written outside Decisions',
      plan: missingEvidenceApplicabilityPlan().replace('No technology choice is described.', () =>
        [
          'No technology choice is described.',
          '',
          'Decision evidence applicability: skip: no load-bearing technology choices',
        ].join('\n'),
      ),
    },
  ])('does not accept $name', ({ plan }) => {
    const result = inspectStructure(plan);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('missing decision entry');
  });

  it('keeps signal-free pre-v1 plans on the established legacy path', () => {
    const result = evaluateImplementationInspiration({
      ticketContent: '---\nid: LEGACY\ntype: feature\n---\n',
      specContent: '# Spec: Legacy\n',
      planContent: missingEvidenceApplicabilityPlan(),
      evaluationDate: '2026-09-10',
    });

    expect(result).toEqual({ ok: true, path: 'legacy' });
  });

  it.each([
    {
      name: "rejects a skip contradicted by the plan's load-bearing choice",
      approach: 'Load-bearing technology choice: use a distributed lease for approval writes.',
      reason: 'this feature has no load-bearing technology choices',
      verdict: 'request_changes',
      finding: 'contradicts',
    },
    {
      name: 'accepts a local non-load-bearing choice under a justified skip',
      approach: 'Local non-load-bearing technology choice: reuse the existing string scanner.',
      reason: 'the only technology choice is local, reversible, and does not shape behavior',
      verdict: 'approve',
    },
    {
      name: 'accepts a credible skip when the plan has no technology choice',
      approach: 'The feature only updates user-facing terminology.',
      reason: 'the feature makes no technology or architecture choice',
      verdict: 'approve',
    },
  ] as const)('$name', ({ approach, finding, reason, verdict }) => {
    const plan = evidenceApplicabilityPlan(reason, approach);

    expect(inspectStructure(plan)).toEqual({ ok: true, path: 'not-applicable' });
    const review = reviewDecisionEvidenceApplicability(PLAN_REVIEW_RUBRIC, plan);
    const contractFailures = review.findings.filter(candidate =>
      candidate.message.startsWith('The packaged plan contract is missing'),
    );
    expect(
      contractFailures,
      contractFailures.map(candidate => candidate.message).join('\n'),
    ).toEqual([]);
    expect(review.verdict).toBe(verdict);
    if (finding !== undefined) {
      expect(review.findings.some(candidate => candidate.message.includes(finding))).toBe(true);
    }
  });

  it.each(DECISION_EVIDENCE_APPLICABILITY_REQUIREMENTS)(
    'fails closed when the contract drops $name',
    requirement => {
      const clause =
        obligationClause(PLAN_REVIEW_RUBRIC, DECISION_EVIDENCE_APPLICABILITY_OBLIGATION) ?? '';
      const normalizedClause = clause.replaceAll(/\s+/gu, ' ');
      for (const requiredClause of DECISION_EVIDENCE_APPLICABILITY_REQUIREMENTS) {
        expect(normalizedClause).toContain(requiredClause.text);
      }
      const existingOffset = PLAN_REVIEW_RUBRIC.indexOf(clause);
      const mutatedClause = normalizedClause.replace(requirement.text, '');
      const mutatedContract = `${PLAN_REVIEW_RUBRIC.slice(0, existingOffset)}${mutatedClause}${PLAN_REVIEW_RUBRIC.slice(existingOffset + clause.length)}`;
      const plan =
        requirement.name === 'contradicted skip rejection'
          ? evidenceApplicabilityPlan(
              'this feature has no load-bearing technology choices',
              'Load-bearing technology choice: use a distributed lease for approval writes.',
            )
          : evidenceApplicabilityPlan(
              'the feature makes no technology or architecture choice',
              'The feature only updates user-facing terminology.',
            );

      const result = reviewDecisionEvidenceApplicability(mutatedContract, plan);

      expect(result.verdict).toBe('request_changes');
      expect(result.findings).toEqual([
        expect.objectContaining({ message: expect.stringContaining(requirement.name) }),
      ]);
      if (requirement.name === 'contradicted skip rejection') {
        expect(result.findings.some(candidate => candidate.message.includes('contradicts'))).toBe(
          false,
        );
      }
    },
  );
});
