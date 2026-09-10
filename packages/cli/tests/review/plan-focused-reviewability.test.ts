import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { ReviewerOutput } from '../../src/review/contract.js';
import { PLAN_REVIEW_RUBRIC } from '../../src/review/plan-rubric.generated.js';

const FOCUSED_REVIEW_OBLIGATION = 'Focused decision path';
const FOCUSED_REVIEW_REQUIREMENTS = [
  {
    name: 'opening architecture mental model',
    pattern: /architecture-at-a-glance\s+mental model/u,
  },
  {
    name: 'load-bearing choice in the main review path',
    pattern: /every load-bearing choice in the\s+main review path/u,
  },
  {
    name: 'linked supporting detail in the review path',
    pattern: /Explicitly linked supporting detail remains in that path/u,
  },
  {
    name: 'removable execution and evidence detail',
    pattern: /step-by-step coding instructions or repeated test evidence/u,
  },
] as const;

interface PlanReviewFixture {
  readonly plan: string;
  readonly linkedDetail?: string;
}

function obligationClause(contract: string, obligation: string): string | undefined {
  return contract
    .split(/\n(?=- \*\*)/u)
    .find(candidate => candidate.startsWith(`- **${obligation}:**`))
    ?.split('\n\n', 1)[0];
}

function structuralFindings(plan: string): { severity: 'error'; message: string }[] {
  const findings: { severity: 'error'; message: string }[] = [];
  const sections = Array.from(plan.matchAll(/^## (.+)$/gmu), match => match[1]?.trim());
  if (sections[0] !== 'Architecture at a glance') {
    findings.push({
      severity: 'error',
      message: 'The main review path does not open with an architecture-at-a-glance mental model.',
    });
  }

  const architectureOffset = plan.indexOf('## Architecture at a glance');
  const firstDecisionOffset = plan.search(/^## .*Decisions?/mu);
  const reviewLead = plan.slice(0, firstDecisionOffset === -1 ? plan.length : firstDecisionOffset);
  if (/^\d+\.\s+\S+/mu.test(reviewLead)) {
    findings.push({
      severity: 'error',
      message: 'Remove step-by-step coding instructions from the focused decision path.',
    });
  }
  if ((reviewLead.match(/^Evidence:/gmu)?.length ?? 0) > 1) {
    findings.push({
      severity: 'error',
      message: 'Remove repeated test evidence from the focused decision path.',
    });
  }
  if (architectureOffset > firstDecisionOffset && firstDecisionOffset !== -1) {
    findings.push({
      severity: 'error',
      message: 'Move the architecture-at-a-glance mental model before decision detail.',
    });
  }
  return findings;
}

function decisionFindings(fixture: PlanReviewFixture): { severity: 'error'; message: string }[] {
  const linkedDetailIsInReviewPath =
    fixture.linkedDetail !== undefined && /^Supporting detail:\s+\S+$/mu.test(fixture.plan);
  const reviewPath = linkedDetailIsInReviewPath
    ? `${fixture.plan}\n${fixture.linkedDetail}`
    : fixture.plan;
  return /^Failure posture: .+$/mu.test(reviewPath)
    ? []
    : [
        {
          severity: 'error',
          message: 'The load-bearing failure-posture decision is absent from the review path.',
        },
      ];
}

/**
 * Deterministic conformance collaborator for the semantic fixture corpus. It
 * applies one obligation to every artifact shape; it does not select a verdict
 * by scenario name or expected outcome. Live semantic review remains the
 * production judgment boundary.
 */
function reviewFocusedDecisionPath(contract: string, fixture: PlanReviewFixture): ReviewerOutput {
  const findings: { severity: 'error'; message: string }[] = [];
  const clause = obligationClause(contract, FOCUSED_REVIEW_OBLIGATION);
  if (clause === undefined) {
    findings.push({
      severity: 'error',
      message: `The packaged plan contract is missing the "${FOCUSED_REVIEW_OBLIGATION}" obligation.`,
    });
  } else {
    for (const requirement of FOCUSED_REVIEW_REQUIREMENTS) {
      if (!requirement.pattern.test(clause)) {
        findings.push({
          severity: 'error',
          message: `The packaged plan contract is missing the focused-review requirement for ${requirement.name}.`,
        });
      }
    }
  }
  if (findings.length === 0) {
    findings.push(...structuralFindings(fixture.plan), ...decisionFindings(fixture));
  }

  return {
    schema_version: 1,
    dispatch_id: createHash('sha256').update(contract).digest('hex'),
    reviewer_agent: 'claude',
    verdict: findings.length === 0 ? 'approve' : 'request_changes',
    summary:
      findings.length === 0
        ? 'The focused decision path is reviewable.'
        : 'The focused decision path needs changes.',
    findings,
  };
}

const architecture = `# Implementation Plan

## Architecture at a glance

Gateway requests pass through one authorization boundary before resource access.
`;

const decisions = `
## Decision-bearing contracts

Failure posture: deny resource access when current authorization cannot be established.

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
      name: 'accepts a load-bearing decision in linked review detail',
      fixture: {
        plan: `${architecture}\n## Decision-bearing contracts\n\nAuthorization is checked per request.\n\nSupporting detail: linked-design.md\n`,
        linkedDetail:
          '# Supporting design\n\nFailure posture: deny resource access when authorization is unavailable.\n',
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
      findings: ['failure-posture decision is absent'],
    },
    {
      name: 'rejects unlinked supporting detail as outside the review path',
      fixture: {
        plan: `${architecture}\n## Decision-bearing contracts\n\nAuthorization is checked per request.\n`,
        linkedDetail:
          '# Supporting design\n\nFailure posture: deny resource access when authorization is unavailable.\n',
      },
      verdict: 'request_changes',
      findings: ['failure-posture decision is absent'],
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
