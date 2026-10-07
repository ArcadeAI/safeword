import { createHash } from 'node:crypto';

import type { ReviewerOutput } from '../../src/review/contract.js';
import { obligationClause } from './plan-focused-reviewability.js';

export const DECISION_QUALITY_OBLIGATION = 'Decision quality';
export const DECISION_QUALITY_REQUIREMENTS = [
  {
    name: 'credible alternative',
    pattern: /at least one credible alternative/u,
  },
  {
    name: 'losing tradeoff',
    pattern: /why each credible alternative lost/u,
  },
  {
    name: 'applicable evidence version',
    pattern: /evidence current for the applicable target version/u,
  },
  {
    name: 'superseded evidence refresh',
    pattern: /named newer release.+refresh.+before approval/u,
  },
] as const;

export interface DecisionEvidenceFixture {
  readonly alternatives: readonly {
    readonly name: string;
    readonly credible: boolean;
    readonly losingReason?: string;
  }[];
  readonly evidenceBaseline: string;
  readonly namedSupersedingRelease?: string;
}

type Finding = { severity: 'error'; message: string };

function contractFindings(contract: string): Finding[] {
  const clause = obligationClause(contract, DECISION_QUALITY_OBLIGATION);
  if (clause === undefined) {
    return [
      {
        severity: 'error',
        message: `The packaged plan contract is missing the "${DECISION_QUALITY_OBLIGATION}" obligation.`,
      },
    ];
  }
  const normalizedClause = clause.replaceAll(/\s+/gu, ' ');
  return DECISION_QUALITY_REQUIREMENTS.flatMap(requirement =>
    requirement.pattern.test(normalizedClause)
      ? []
      : [
          {
            severity: 'error' as const,
            message: `The packaged plan contract is missing the decision-quality requirement for ${requirement.name}.`,
          },
        ],
  );
}

function evidenceFindings(fixture: DecisionEvidenceFixture): Finding[] {
  const credibleAlternatives = fixture.alternatives.filter(alternative => alternative.credible);
  const findings: Finding[] =
    credibleAlternatives.length === 0
      ? [
          {
            severity: 'error',
            message: 'Name at least one credible alternative to the load-bearing choice.',
          },
        ]
      : credibleAlternatives.flatMap(alternative =>
          (alternative.losingReason ?? '').trim() === ''
            ? [
                {
                  severity: 'error' as const,
                  message: `Explain why the credible alternative "${alternative.name}" lost.`,
                },
              ]
            : [],
        );

  if (
    fixture.namedSupersedingRelease !== undefined &&
    fixture.evidenceBaseline !== fixture.namedSupersedingRelease
  ) {
    findings.push({
      severity: 'error',
      message: `Refresh the decision evidence against ${fixture.namedSupersedingRelease}.`,
    });
  }
  return findings;
}

export function reviewDecisionEvidence(
  contract: string,
  fixture: DecisionEvidenceFixture,
): ReviewerOutput {
  const missingContractFindings = contractFindings(contract);
  const findings =
    missingContractFindings.length > 0 ? missingContractFindings : evidenceFindings(fixture);

  return {
    schema_version: 1,
    dispatch_id: createHash('sha256').update(contract).digest('hex'),
    reviewer_agent: 'claude',
    verdict: findings.length === 0 ? 'approve' : 'request_changes',
    summary:
      findings.length === 0
        ? 'The load-bearing choice has current decision evidence.'
        : 'The load-bearing choice needs stronger decision evidence.',
    findings,
  };
}
