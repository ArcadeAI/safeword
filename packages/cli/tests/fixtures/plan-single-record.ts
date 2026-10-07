import { createHash } from 'node:crypto';

import type { ReviewerOutput } from '../../src/review/contract.js';

export const PLAN_OF_RECORD_OBLIGATION = 'Single design plan of record';
export const PLAN_OF_RECORD_REQUIREMENTS = [
  'must name all required decisions',
  'each decision and consequence',
  'linked supporting detail may carry full depth',
  'explicitly subordinate support',
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

export function missingPlanOfRecordRequirements(contract: string): string[] {
  const clause = planOfRecordClause(contract);
  if (clause === undefined) return [PLAN_OF_RECORD_OBLIGATION];
  const normalized = clause.replaceAll(/\s+/gu, ' ').toLowerCase();
  return PLAN_OF_RECORD_REQUIREMENTS.filter(phrase => !normalized.includes(phrase.toLowerCase()));
}

function field(plan: string, name: string): string | undefined {
  const prefix = `${name}:`;
  return plan
    .split('\n')
    .find(line => line.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
}

function planAuthorityFindings(
  plan: string,
  resolvableSupportingDetail: ReadonlySet<string>,
): { severity: 'error'; message: string }[] {
  const decisionLocation = field(plan, 'Required decision location');
  const supportingDetail = field(plan, 'Supporting detail');
  if (field(plan, 'Supporting authority') === 'independent feature plan') {
    return [
      {
        severity: 'error',
        message: 'Return feature-plan authority from the linked document to impl-plan.md.',
      },
    ];
  }
  if (decisionLocation === 'second feature design document') {
    return [
      {
        severity: 'error',
        message:
          'Return required decisions from the second feature design document to impl-plan.md.',
      },
    ];
  }
  if (decisionLocation !== 'linked supporting detail') return [];
  if (supportingDetail === undefined || !resolvableSupportingDetail.has(supportingDetail)) {
    return [
      {
        severity: 'error',
        message: 'The linked supporting detail must resolve from impl-plan.md.',
      },
    ];
  }
  if (field(plan, 'Decision and consequence') === undefined) {
    return [
      {
        severity: 'error',
        message: 'Return the required decision and consequence to impl-plan.md.',
      },
    ];
  }
  return [];
}

export function reviewPlanOfRecord(
  contract: string,
  plan: string,
  resolvableSupportingDetail: ReadonlySet<string>,
): ReviewerOutput {
  const missing = missingPlanOfRecordRequirements(contract);
  const findings: { severity: 'error'; message: string }[] = missing.map(requirement => ({
    severity: 'error',
    message: `The packaged contract is missing the plan-of-record requirement for ${requirement}.`,
  }));
  if (findings.length === 0)
    findings.push(...planAuthorityFindings(plan, resolvableSupportingDetail));
  return {
    schema_version: 1,
    dispatch_id: createHash('sha256').update(contract).digest('hex'),
    reviewer_agent: 'claude',
    verdict: findings.length === 0 ? 'approve' : 'request_changes',
    summary: `impl-plan.md is the single design plan of record; ${findings.length === 0 ? 'its authority is coherent.' : 'its authority needs repair.'}`,
    findings,
  };
}
