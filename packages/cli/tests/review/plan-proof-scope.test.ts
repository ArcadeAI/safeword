import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { ReviewerOutput } from '../../src/review/contract.js';
import { PLAN_REVIEW_RUBRIC } from '../../src/review/plan-rubric.generated.js';

const PROOF_SCOPE_OBLIGATION = 'Proof strategy boundary';
const REQUIRED_CONTRACT_PHRASES = [
  'behavior',
  'real system boundary',
  'proof type',
  'confidence limitation',
  'linked detailed evidence',
  'test paths or commands',
  'Execution Planning',
  'verification ledger',
  'decision review path',
] as const;

function proofScopeClause(contract: string): string | undefined {
  return contract
    .split(/\n(?=- \*\*)/u)
    .find(candidate => candidate.startsWith(`- **${PROOF_SCOPE_OBLIGATION}:**`))
    ?.split('\n\n', 1)[0];
}

function missingContractRequirements(contract: string): string[] {
  const clause = proofScopeClause(contract);
  if (clause === undefined) return [PROOF_SCOPE_OBLIGATION];
  const normalized = clause.replaceAll(/\s+/gu, ' ').toLowerCase();
  return REQUIRED_CONTRACT_PHRASES.filter(phrase => !normalized.includes(phrase.toLowerCase()));
}

function value(plan: string, field: string): string | undefined {
  const prefix = `${field}:`;
  return plan
    .split('\n')
    .find(line => line.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
}

function reviewProofScope(contract: string, plan: string): ReviewerOutput {
  const findings: { severity: 'error'; message: string }[] = [];
  const missingContract = missingContractRequirements(contract);
  if (missingContract.length > 0) {
    findings.push({
      severity: 'error',
      message: `The packaged contract is missing proof-strategy requirements: ${missingContract.join(', ')}.`,
    });
  } else {
    for (const field of [
      'Behavior',
      'Real system boundary',
      'Proof type',
      'Confidence limitation',
    ]) {
      if (!value(plan, field)) {
        findings.push({ severity: 'error', message: `Proof strategy missing: ${field}.` });
      }
    }
    if (/^(?:Test path|Command):/mu.test(plan)) {
      findings.push({
        severity: 'error',
        message: 'Move test paths or commands to Execution Planning.',
      });
    }
    if (/^(?:Current-head hash|Individual test|Scenario result):/mu.test(plan)) {
      findings.push({
        severity: 'error',
        message: 'Remove verification ledger detail from the decision review path.',
      });
    }
  }

  return {
    schema_version: 1,
    dispatch_id: createHash('sha256').update(contract).digest('hex'),
    reviewer_agent: 'claude',
    verdict: findings.length === 0 ? 'approve' : 'request_changes',
    summary:
      findings.length === 0 ? 'Proof scope stays at decision depth.' : 'Proof scope needs changes.',
    findings,
  };
}

const COMPLETE_STRATEGY = `Behavior: a denied planning edit cannot alter application code
Real system boundary: installed pre-tool gate reading real project configuration
Proof type: integration
Confidence limitation: simulated host proves gate behavior, not every host adapter
`;

describe('Implementation Plan proof strategy boundary', () => {
  it.each([
    {
      proofState: 'complete decision-depth strategy without mechanics',
      plan: COMPLETE_STRATEGY,
      verdict: 'approve',
      finding: undefined,
    },
    {
      proofState: 'complete strategy with linked detailed evidence',
      plan: `${COMPLETE_STRATEGY}Detailed evidence: .project/tickets/ABC123/verify.md\n`,
      verdict: 'approve',
      finding: undefined,
    },
    {
      proofState: 'complete strategy with test paths and commands',
      plan: `${COMPLETE_STRATEGY}Test path: tests/integration/planning-gate.test.ts\nCommand: bun run test planning-gate\n`,
      verdict: 'request_changes',
      finding: 'Execution Planning',
    },
    {
      proofState: 'verification ledger repeated in the plan',
      plan: `${COMPLETE_STRATEGY}Current-head hash: abc123\nIndividual test: blocks source edit\nScenario result: passed\n`,
      verdict: 'request_changes',
      finding: 'verification ledger detail',
    },
    {
      proofState: 'strategy missing the real system boundary',
      plan: COMPLETE_STRATEGY.replace(
        'Real system boundary: installed pre-tool gate reading real project configuration\n',
        '',
      ),
      verdict: 'request_changes',
      finding: 'Real system boundary',
    },
  ])('$proofState', ({ finding, plan, verdict }) => {
    const result = reviewProofScope(PLAN_REVIEW_RUBRIC, plan);

    expect(
      result.findings.filter(candidate => candidate.message.startsWith('The packaged contract')),
      'The packaged contract is missing proof-strategy requirements.',
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
});
