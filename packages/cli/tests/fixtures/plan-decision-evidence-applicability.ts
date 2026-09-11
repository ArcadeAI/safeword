import { createHash } from 'node:crypto';

import type { ReviewerOutput } from '../../src/review/contract.js';
import { withoutFencedCode } from '../../templates/hooks/lib/markdown-structure.js';
import { obligationClause } from './plan-focused-reviewability.js';

export const DECISION_EVIDENCE_APPLICABILITY_OBLIGATION = 'Decision quality';
export const DECISION_EVIDENCE_APPLICABILITY_REQUIREMENTS = [
  {
    name: 'evidence entry or justified skip',
    text: 'Require an evidence-bearing decision entry or a justified no-load-bearing-choice skip.',
  },
  {
    name: 'local choice eligibility',
    text: 'A local non-load-bearing choice does not contradict that skip.',
  },
  {
    name: 'contradicted skip rejection',
    text: "Block the skip when it contradicts the plan's own load-bearing choice.",
  },
] as const;

type Finding = { severity: 'error'; message: string };

function decisionsSection(plan: string): string {
  const lines = withoutFencedCode(plan).split(/\r?\n/u);
  const headings = lines.flatMap((line, index) => (line === '## Decisions' ? [index] : []));
  const [start] = headings;
  if (headings.length !== 1 || start === undefined) return '';
  const relativeEnd = lines.slice(start + 1).findIndex(line => /^#{1,2}\s/u.test(line));
  const end = relativeEnd === -1 ? lines.length : start + 1 + relativeEnd;
  return lines.slice(start + 1, end).join('\n');
}

function hasDecisionEvidenceSkip(plan: string): boolean {
  return /^Decision evidence applicability: skip: \S.+$/mu.test(decisionsSection(plan));
}

function contractFindings(contract: string): Finding[] {
  const normalizedClause =
    obligationClause(contract, DECISION_EVIDENCE_APPLICABILITY_OBLIGATION)?.replaceAll(
      /\s+/gu,
      ' ',
    ) ?? '';
  return DECISION_EVIDENCE_APPLICABILITY_REQUIREMENTS.flatMap(requirement =>
    normalizedClause.includes(requirement.text)
      ? []
      : [
          {
            severity: 'error' as const,
            message: `The packaged plan contract is missing the decision-evidence applicability requirement for ${requirement.name}.`,
          },
        ],
  );
}

export function reviewDecisionEvidenceApplicability(
  contract: string,
  plan: string,
): ReviewerOutput {
  const normalizedClause =
    obligationClause(contract, DECISION_EVIDENCE_APPLICABILITY_OBLIGATION)?.replaceAll(
      /\s+/gu,
      ' ',
    ) ?? '';
  const missingContractFindings = contractFindings(contract);
  const contradictionRequirement = DECISION_EVIDENCE_APPLICABILITY_REQUIREMENTS[2].text;
  const contradictedSkipFindings: Finding[] =
    normalizedClause.includes(contradictionRequirement) &&
    hasDecisionEvidenceSkip(plan) &&
    /^Load-bearing technology choice:/mu.test(plan)
      ? [
          {
            severity: 'error',
            message:
              "The no-load-bearing-choice skip contradicts the plan's own load-bearing technology choice.",
          },
        ]
      : [];
  const findings = [...missingContractFindings, ...contradictedSkipFindings];

  return {
    schema_version: 1,
    dispatch_id: createHash('sha256').update(contract).digest('hex'),
    reviewer_agent: 'claude',
    verdict: findings.length === 0 ? 'approve' : 'request_changes',
    summary:
      findings.length === 0
        ? 'Decision-evidence applicability is coherent.'
        : 'Decision-evidence applicability needs changes.',
    findings,
  };
}

export function evidenceApplicabilityPlan(reason: string, approach: string): string {
  return [
    '# Impl Plan: Evidence applicability',
    '',
    '**Status:** planned',
    '**Planned on:** 2026-09-10',
    '',
    '## Decisions',
    '',
    '### Recorded Decisions',
    '',
    `Decision evidence applicability: skip: ${reason}`,
    '',
    '## Approach',
    '',
    approach,
  ].join('\n');
}

export function missingEvidenceApplicabilityPlan(): string {
  return [
    '# Impl Plan: Evidence applicability',
    '',
    '**Status:** planned',
    '**Planned on:** 2026-09-10',
    '',
    '## Decisions',
    '',
    '### Recorded Decisions',
    '',
    '## Approach',
    '',
    'No technology choice is described.',
  ].join('\n');
}
