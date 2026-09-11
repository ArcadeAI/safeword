import { describe, expect, it } from 'vitest';

import { PLAN_REVIEW_RUBRIC } from '../../src/review/plan-rubric.generated.js';
import {
  FOCUSED_REVIEW_OBLIGATION,
  FOCUSED_REVIEW_REQUIREMENTS,
  obligationClause,
  reviewFocusedDecisionPath,
} from '../fixtures/plan-focused-reviewability.js';

const architecture = `# Implementation Plan

## Architecture at a glance

Gateway requests pass through one authorization boundary before resource access.
`;

const decisions = `
## Decision-bearing contracts

Failure posture: deny resource access when current authorization cannot be established.
Consequence: authorization outages deny resource access instead of risking exposure.

## Operational risks

Stale authorization could expose a resource after tool access is revoked.

## Unresolved authority

Product must decide whether denied reads are visible in the activity log.
`;

const FOCUSED_REVIEW_CLAUSE_FIXTURE = `- **Focused decision path:** Require the plan to open with an
  architecture-at-a-glance mental model, then keep decision-bearing contracts,
  operational risks, unresolved authority, and every load-bearing choice in the
  main review path. Explicitly linked supporting detail remains in that path and
  may carry a decision's full depth when the plan names the decision and its
  consequence. Block a missing mental model or load-bearing decision. When
  step-by-step coding instructions or repeated test evidence obscure the
  choices, name the removable detail instead of rewarding its volume.`;

function contractWithFocusedReviewFixture(): string {
  const existing = obligationClause(PLAN_REVIEW_RUBRIC, FOCUSED_REVIEW_OBLIGATION);
  if (existing === undefined) return `${PLAN_REVIEW_RUBRIC}\n${FOCUSED_REVIEW_CLAUSE_FIXTURE}`;
  const offset = PLAN_REVIEW_RUBRIC.indexOf(existing);
  return `${PLAN_REVIEW_RUBRIC.slice(0, offset)}${FOCUSED_REVIEW_CLAUSE_FIXTURE}${PLAN_REVIEW_RUBRIC.slice(offset + existing.length)}`;
}

describe('Implementation Plan focused reviewability contract', () => {
  it.each([
    {
      name: 'rejects coding choreography and repeated evidence ahead of the decisions',
      fixture: {
        plan: `# Implementation Plan

## Approach

1. Create the authorization service.
2. Run the gateway integration test.
Evidence: gateway test passed.
Evidence: gateway test passed again.

${architecture}${decisions}`,
      },
      verdict: 'request_changes',
      findings: ['step-by-step coding instructions', 'repeated test evidence'],
    },
    {
      name: 'accepts an architecture-first decision path with linked support',
      fixture: { plan: `${architecture}${decisions}\nSupporting detail: linked-design.md\n` },
      verdict: 'approve',
      findings: [],
    },
    {
      name: 'rejects a decision path without an opening mental model',
      fixture: { plan: `# Implementation Plan\n${decisions}` },
      verdict: 'request_changes',
      findings: ['architecture-at-a-glance mental model'],
    },
    {
      name: 'accepts linked detail after the main plan names the decision and consequence',
      fixture: {
        plan: `${architecture}\n## Decision-bearing contracts\n\nFailure posture: deny resource access when authorization is unavailable.\nConsequence: authorization outages deny resource access instead of risking exposure.\n\nSupporting detail: linked-design.md\n`,
        linkedDetail:
          '# Supporting design\n\nThe denial response uses the existing unavailable status.\n',
      },
      verdict: 'approve',
      findings: [],
    },
    {
      name: 'rejects a missing load-bearing decision',
      fixture: {
        plan: `${architecture}\n## Decision-bearing contracts\n\nAuthorization is checked per request.\n`,
      },
      verdict: 'request_changes',
      findings: ['failure-posture decision and its consequence are absent'],
    },
    {
      name: 'rejects unlinked supporting detail as outside the review path',
      fixture: {
        plan: `${architecture}\n## Decision-bearing contracts\n\nAuthorization is checked per request.\n`,
        linkedDetail:
          '# Supporting design\n\nFailure posture: deny resource access when authorization is unavailable.\n',
      },
      verdict: 'request_changes',
      findings: ['failure-posture decision and its consequence are absent'],
    },
  ])('$name', ({ fixture, findings, verdict }) => {
    const result = reviewFocusedDecisionPath(PLAN_REVIEW_RUBRIC, fixture);

    const contractFailures = result.findings.filter(finding =>
      finding.message.startsWith('The packaged plan contract is missing'),
    );
    expect(contractFailures, contractFailures.map(finding => finding.message).join('\n')).toEqual(
      [],
    );

    expect(result.verdict).toBe(verdict);
    for (const finding of findings) {
      expect(result.findings.some(candidate => candidate.message.includes(finding))).toBe(true);
    }
  });

  it('fails closed and names the missing obligation when its exact clause is removed', () => {
    const contract = contractWithFocusedReviewFixture();
    const clause = obligationClause(contract, FOCUSED_REVIEW_OBLIGATION) ?? '';
    const clauseOffset = contract.indexOf(clause);
    const mutatedContract = `${contract.slice(0, clauseOffset)}${contract.slice(clauseOffset + clause.length)}`;

    const result = reviewFocusedDecisionPath(mutatedContract, {
      plan: `${architecture}${decisions}`,
    });

    expect(result.verdict).toBe('request_changes');
    expect(result.findings).toEqual([
      expect.objectContaining({ message: expect.stringContaining(FOCUSED_REVIEW_OBLIGATION) }),
    ]);
  });

  it.each(FOCUSED_REVIEW_REQUIREMENTS)(
    'fails closed when the contract drops $name',
    requirement => {
      const contract = contractWithFocusedReviewFixture();
      const clause = obligationClause(contract, FOCUSED_REVIEW_OBLIGATION);
      const clauseText = clause ?? '';
      const clauseOffset = contract.indexOf(clauseText);
      const mutatedClause = clauseText.replace(requirement.pattern, '');
      const mutatedContract = `${contract.slice(0, clauseOffset)}${mutatedClause}${contract.slice(clauseOffset + clauseText.length)}`;

      const result = reviewFocusedDecisionPath(mutatedContract, {
        plan: `${architecture}${decisions}\nSupporting detail: linked-design.md\n`,
        linkedDetail:
          '# Supporting design\n\nFailure posture: deny resource access when authorization is unavailable.\n',
      });

      expect(result.verdict).toBe('request_changes');
      expect(result.findings).toEqual([
        expect.objectContaining({ message: expect.stringContaining(requirement.name) }),
      ]);
    },
  );
});
