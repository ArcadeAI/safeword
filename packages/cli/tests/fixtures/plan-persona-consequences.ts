import { createHash } from 'node:crypto';

import type { ReviewerOutput } from '../../src/review/contract.js';
import { obligationClause } from './plan-focused-reviewability.js';

export const PERSONA_COVERAGE_OBLIGATION = 'Personas and surfaces';
export const PERSONA_COVERAGE_REQUIREMENTS = [
  {
    name: 'accepted Product Plan persona inventory',
    pattern: /accepted Product Plan.+persona/iu,
  },
  {
    name: 'consequential trust, operation, approval, and recovery needs',
    pattern: /trust, operation, approval, and recovery/iu,
  },
  {
    name: 'design consequence and confidence limit',
    pattern: /design consequence.+confidence limit/iu,
  },
  {
    name: 'omission blocks with the persona need named',
    pattern: /block.+omitted.+name.+uncovered.+need/iu,
  },
] as const;

export interface PersonaConsequenceFixture {
  readonly persona: string;
  readonly need: 'trust' | 'operation' | 'approval' | 'recovery';
  readonly consequenceRecorded: boolean;
  readonly limitRecorded: boolean;
}

export interface PersonaInventoryFixture {
  readonly persona: string;
  readonly need: string;
  readonly designConsequence: string;
  readonly covered: boolean;
}

type Finding = { severity: 'error'; message: string };

function contractFindings(contract: string): Finding[] {
  const clause = obligationClause(contract, PERSONA_COVERAGE_OBLIGATION);
  if (clause === undefined) {
    return [
      {
        severity: 'error',
        message: `The packaged plan contract is missing the "${PERSONA_COVERAGE_OBLIGATION}" obligation.`,
      },
    ];
  }
  const normalizedClause = clause.replaceAll(/\s+/gu, ' ');
  return PERSONA_COVERAGE_REQUIREMENTS.flatMap(requirement =>
    requirement.pattern.test(normalizedClause)
      ? []
      : [
          {
            severity: 'error' as const,
            message: `The packaged plan contract is missing the persona-coverage requirement for ${requirement.name}.`,
          },
        ],
  );
}

export function reviewPersonaConsequences(
  contract: string,
  fixture: PersonaConsequenceFixture,
): ReviewerOutput {
  const missingContractFindings = contractFindings(contract);
  const findings = [...missingContractFindings];
  if (findings.length === 0 && (!fixture.consequenceRecorded || !fixture.limitRecorded)) {
    findings.push({
      severity: 'error',
      message: `The accepted persona has an uncovered ${fixture.need} need.`,
    });
  }

  return {
    schema_version: 1,
    dispatch_id: createHash('sha256').update(contract).digest('hex'),
    reviewer_agent: 'claude',
    verdict: findings.length === 0 ? 'approve' : 'request_changes',
    summary:
      findings.length === 0
        ? 'Every accepted persona consequence is reviewable.'
        : 'Accepted persona consequences need changes.',
    findings,
  };
}

export function reviewPersonaInventory(
  contract: string,
  fixtures: readonly PersonaInventoryFixture[],
): ReviewerOutput {
  const clause = obligationClause(contract, PERSONA_COVERAGE_OBLIGATION)?.replaceAll(/\s+/gu, ' ');
  const namesEveryOmission =
    clause !== undefined &&
    /block.+omitted.+name.+uncovered persona, need, and design consequence/iu.test(clause);
  const findings: Finding[] = namesEveryOmission
    ? fixtures
        .filter(fixture => !fixture.covered)
        .map(fixture => ({
          severity: 'error' as const,
          message: `The Implementation Plan omits ${fixture.persona} and its ${fixture.designConsequence} consequence.`,
        }))
    : [
        {
          severity: 'error',
          message:
            'The packaged plan contract does not require every omitted persona and design consequence to be named.',
        },
      ];

  return {
    schema_version: 1,
    dispatch_id: createHash('sha256').update(contract).digest('hex'),
    reviewer_agent: 'claude',
    verdict: findings.length === 0 ? 'approve' : 'request_changes',
    summary:
      findings.length === 0
        ? 'Every accepted persona is covered.'
        : 'The accepted persona inventory is incomplete.',
    findings,
  };
}
