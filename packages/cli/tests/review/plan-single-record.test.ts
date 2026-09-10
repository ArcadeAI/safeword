import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { ReviewerOutput } from '../../src/review/contract.js';
import { PLAN_REVIEW_RUBRIC } from '../../src/review/plan-rubric.generated.js';

const PLAN_OF_RECORD_OBLIGATION = 'Single design plan of record';
const REQUIRED_PHRASES = [
  'must name all required decisions',
  'each decision and consequence',
  'linked supporting detail may carry full depth',
  'block approval',
  'second feature design document carries required decisions instead',
  'return to',
  'impl-plan.md',
] as const;

function planOfRecordClause(contract: string): string | undefined {
  return contract
    .split(/\n(?=- \*\*)/u)
    .find(candidate => candidate.startsWith(`- **${PLAN_OF_RECORD_OBLIGATION}:**`))
    ?.split('\n\n', 1)[0];
}

function missingContractRequirements(contract: string): string[] {
  const clause = planOfRecordClause(contract);
  if (clause === undefined) return [PLAN_OF_RECORD_OBLIGATION];
  const normalized = clause.replaceAll(/\s+/gu, ' ').toLowerCase();
  return REQUIRED_PHRASES.filter(phrase => !normalized.includes(phrase.toLowerCase()));
}

function field(plan: string, name: string): string | undefined {
  const prefix = `${name}:`;
  return plan
    .split('\n')
    .find(line => line.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
}

function reviewPlanOfRecord(
  contract: string,
  plan: string,
  resolvableSupportingDetail: ReadonlySet<string>,
): ReviewerOutput {
  const findings: { severity: 'error'; message: string }[] = [];
  const missing = missingContractRequirements(contract);
  if (missing.length > 0) {
    findings.push({
      severity: 'error',
      message: `The packaged contract is missing plan-of-record requirements: ${missing.join(', ')}.`,
    });
  } else {
    const decisionLocation = field(plan, 'Required decision location');
    const supportingDetail = field(plan, 'Supporting detail');
    if (decisionLocation === 'second feature design document') {
      findings.push({
        severity: 'error',
        message:
          'Return required decisions from the second feature design document to impl-plan.md.',
      });
    }
    if (
      decisionLocation === 'linked supporting detail' &&
      (supportingDetail === undefined || !resolvableSupportingDetail.has(supportingDetail))
    ) {
      findings.push({
        severity: 'error',
        message: 'The linked supporting detail must resolve from impl-plan.md.',
      });
    }
    if (
      decisionLocation === 'linked supporting detail' &&
      field(plan, 'Decision and consequence') === undefined
    ) {
      findings.push({
        severity: 'error',
        message: 'impl-plan.md must name the supported decision and consequence.',
      });
    }
  }

  return {
    schema_version: 1,
    dispatch_id: createHash('sha256').update(contract).digest('hex'),
    reviewer_agent: 'claude',
    verdict: findings.length === 0 ? 'approve' : 'request_changes',
    summary: `impl-plan.md is the single design plan of record; ${
      findings.length === 0 ? 'its authority is coherent.' : 'its authority needs repair.'
    }`,
    findings,
  };
}

describe('Implementation Plan is the single feature design plan of record', () => {
  it.each([
    {
      artifactState: 'all decisions contained in the Implementation Plan',
      plan: 'Required decision location: impl-plan.md\n',
      supporting: new Set<string>(),
      verdict: 'approve',
      finding: undefined,
    },
    {
      artifactState: 'linked supporting detail outside the plan',
      plan: `Required decision location: linked supporting detail
Decision and consequence: Gateway authorization is shared across transports.
Supporting detail: docs/gateway-sequence.md
`,
      supporting: new Set(['docs/gateway-sequence.md']),
      verdict: 'approve',
      finding: undefined,
    },
    {
      artifactState: 'a second feature design document carries required decisions',
      plan: `Required decision location: second feature design document
Supporting detail: docs/alternate-design.md
`,
      supporting: new Set(['docs/alternate-design.md']),
      verdict: 'request_changes',
      finding: 'Return required decisions',
    },
  ])('$artifactState', ({ finding, plan, supporting, verdict }) => {
    const result = reviewPlanOfRecord(PLAN_REVIEW_RUBRIC, plan, supporting);

    expect(
      result.findings.filter(candidate => candidate.message.startsWith('The packaged contract')),
      'The packaged contract is missing plan-of-record requirements.',
    ).toEqual([]);
    expect(result.summary).toContain('impl-plan.md is the single design plan of record');
    expect(result.verdict).toBe(verdict);
    if (finding === undefined) {
      expect(result.findings).toEqual([]);
    } else {
      expect(result.findings).toEqual([
        expect.objectContaining({ message: expect.stringContaining(finding) }),
      ]);
    }
  });

  it.each(REQUIRED_PHRASES)('fails closed when the packaged obligation drops %s', phrase => {
    const clause = planOfRecordClause(PLAN_REVIEW_RUBRIC) ?? '';
    expect(missingContractRequirements(clause)).toEqual([]);
    const body = clause
      .slice(clause.indexOf(':**') + ':**'.length)
      .replaceAll(/\s+/gu, ' ')
      .toLowerCase()
      .replaceAll(phrase.toLowerCase(), '');
    const mutated = `- **${PLAN_OF_RECORD_OBLIGATION}:**${body}`;

    const result = reviewPlanOfRecord(
      mutated,
      'Required decision location: impl-plan.md\n',
      new Set(),
    );

    expect(result.verdict).toBe('request_changes');
    expect(result.findings[0]?.message.toLowerCase()).toContain(phrase.toLowerCase());
  });
});
