import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { ReviewerOutput } from '../../src/review/contract.js';
import { PLAN_REVIEW_RUBRIC } from '../../src/review/plan-rubric.generated.js';

const DECISION_BOUNDARY_OBLIGATION = 'Decision ownership boundary';
const REQUIRED_CONTRACT_PHRASES = [
  'API and data contracts',
  'authorization',
  'failure behavior',
  'compatibility',
  'migration',
  'rollout',
  'rollback',
  'proof scope',
  'decided or explicitly not applicable',
  'Implementation Planning obligation',
  'not defer',
  'Execution Planning',
] as const;

function obligationClause(contract: string): string | undefined {
  return contract
    .split(/\n(?=- \*\*)/u)
    .find(candidate => candidate.startsWith(`- **${DECISION_BOUNDARY_OBLIGATION}:**`))
    ?.split('\n\n', 1)[0];
}

function missingContractRequirements(contract: string): string[] {
  const clause = obligationClause(contract);
  if (clause === undefined) return [DECISION_BOUNDARY_OBLIGATION];
  const normalized = clause.replaceAll(/\s+/gu, ' ').toLowerCase();
  return REQUIRED_CONTRACT_PHRASES.filter(phrase => !normalized.includes(phrase.toLowerCase()));
}

function removePhraseCaseInsensitive(value: string, phrase: string): string {
  let result = value;
  let index = result.toLowerCase().indexOf(phrase.toLowerCase());
  while (index !== -1) {
    result = result.slice(0, index) + result.slice(index + phrase.length);
    index = result.toLowerCase().indexOf(phrase.toLowerCase());
  }
  return result;
}

function decisionValue(plan: string, field: string): string | undefined {
  const prefix = `${field}:`;
  return plan
    .split('\n')
    .find(line => line.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
}

function reviewDecisionResolution(contract: string, plan: string): ReviewerOutput {
  const findings: { severity: 'error'; message: string }[] = [];
  const missingContract = missingContractRequirements(contract);
  if (missingContract.length > 0) {
    findings.push({
      severity: 'error',
      message: `The packaged contract is missing decision-boundary requirements: ${missingContract.join(', ')}.`,
    });
  } else {
    for (const field of ['API contract', 'Rollback', 'Proof scope']) {
      const value = decisionValue(plan, field);
      if (value?.startsWith('unresolved') === true) {
        findings.push({
          severity: 'error',
          message: `${field} is unresolved and remains an Implementation Planning obligation.`,
        });
      }
    }
  }

  return {
    schema_version: 1,
    dispatch_id: createHash('sha256').update(contract).digest('hex'),
    reviewer_agent: 'claude',
    verdict: findings.length === 0 ? 'approve' : 'request_changes',
    summary:
      findings.length === 0
        ? 'Behavior-shaping decisions are resolved.'
        : 'Implementation Planning still has unresolved decisions.',
    findings,
  };
}

const OTHERWISE_COMPLETE_PLAN = `# Implementation Plan

API contract: resolved: POST /accounts returns the accepted account-link result
Rollback: resolved: retain the prior lookup until the backfill is verified
Proof scope: resolved: integration proof at the installed CLI boundary
`;

function withDecision(field: string, value: string): string {
  return OTHERWISE_COMPLETE_PLAN.split('\n')
    .map(line => (line.startsWith(`${field}:`) ? `${field}: ${value}` : line))
    .join('\n');
}

describe('Implementation Plan decision ownership boundary', () => {
  it.each([
    {
      state: 'an unresolved API contract',
      plan: withDecision('API contract', 'unresolved: request and response shape'),
      verdict: 'request_changes',
      finding: 'API contract',
    },
    {
      state: 'a resolved API contract',
      plan: withDecision(
        'API contract',
        'resolved: POST /accounts accepts provider identity and returns the account link',
      ),
      verdict: 'approve',
      finding: undefined,
    },
    {
      state: 'unresolved rollback behavior',
      plan: withDecision('Rollback', 'unresolved: fallback after a partial backfill'),
      verdict: 'request_changes',
      finding: 'Rollback',
    },
    {
      state: 'resolved rollback behavior',
      plan: withDecision(
        'Rollback',
        'resolved: disable new writes before restoring the prior lookup',
      ),
      verdict: 'approve',
      finding: undefined,
    },
    {
      state: 'unresolved proof scope',
      plan: withDecision('Proof scope', 'unresolved: real system boundary'),
      verdict: 'request_changes',
      finding: 'Proof scope',
    },
    {
      state: 'resolved proof scope',
      plan: withDecision(
        'Proof scope',
        'resolved: end-to-end proof at the installed CLI process boundary',
      ),
      verdict: 'approve',
      finding: undefined,
    },
  ])('$state', ({ finding, plan, verdict }) => {
    const result = reviewDecisionResolution(PLAN_REVIEW_RUBRIC, plan);

    expect(
      result.findings.filter(candidate => candidate.message.startsWith('The packaged contract')),
      'The packaged contract is missing the decision-ownership boundary.',
    ).toEqual([]);
    expect(result.verdict).toBe(verdict);
    if (finding === undefined) {
      expect(result.findings).toEqual([]);
    } else {
      expect(result.findings).toEqual([
        expect.objectContaining({ message: expect.stringContaining(finding) }),
      ]);
    }
  });

  it.each(REQUIRED_CONTRACT_PHRASES)(
    'fails closed when the packaged decision boundary drops %s',
    phrase => {
      const clause = obligationClause(PLAN_REVIEW_RUBRIC) ?? '';
      expect(missingContractRequirements(clause)).toEqual([]);
      const mutated = removePhraseCaseInsensitive(clause.replaceAll(/\s+/gu, ' '), phrase);

      const result = reviewDecisionResolution(mutated, OTHERWISE_COMPLETE_PLAN);

      expect(result.verdict).toBe('request_changes');
      expect(result.findings[0]?.message.toLowerCase()).toContain(phrase.toLowerCase());
    },
  );
});
