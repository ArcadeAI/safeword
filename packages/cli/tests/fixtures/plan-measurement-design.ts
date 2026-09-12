import { createHash } from 'node:crypto';

import type { ReviewerOutput } from '../../src/review/contract.js';
import { obligationClause } from './plan-focused-reviewability.js';

export const MEASUREMENT_DESIGN_OBLIGATION = 'Measurement design ownership';
const MEASUREMENT_OWNERSHIP_REQUIREMENTS = [
  /Product.+target.+population.+condition/iu,
  /Implementation Plan.+origin.+method.+validity safeguards.+failure behavior/iu,
  /block.+target.+population.+changed/iu,
  /instrumentation.+Execution Planning/iu,
  /missing validity decision/iu,
] as const;

export interface MeasurementDesignFixture {
  readonly quantitativePromise: boolean;
  readonly changesTarget: boolean;
  readonly changesPopulation: boolean;
  readonly originDecided: boolean;
  readonly methodDecided: boolean;
  readonly safeguardsDecided: boolean;
  readonly failureBehaviorDecided: boolean;
  readonly instrumentationCommands: boolean;
}

type Finding = { severity: 'error'; message: string };

function contractFindings(contract: string): Finding[] {
  const clause = obligationClause(contract, MEASUREMENT_DESIGN_OBLIGATION)?.replaceAll(
    /\s+/gu,
    ' ',
  );
  if (clause === undefined) {
    return [
      { severity: 'error', message: `The contract is missing ${MEASUREMENT_DESIGN_OBLIGATION}.` },
    ];
  }
  return MEASUREMENT_OWNERSHIP_REQUIREMENTS.flatMap((requirement, index) =>
    requirement.test(clause)
      ? []
      : [
          {
            severity: 'error' as const,
            message: `${MEASUREMENT_DESIGN_OBLIGATION} is missing requirement ${index + 1}.`,
          },
        ],
  );
}

function semanticFinding(fixture: MeasurementDesignFixture): Finding | undefined {
  if (fixture.changesTarget) {
    return { severity: 'error', message: 'The Product-owned target was changed.' };
  }
  if (fixture.changesPopulation) {
    return { severity: 'error', message: 'The Product-owned population was changed.' };
  }
  if (fixture.instrumentationCommands) {
    return { severity: 'error', message: 'Instrumentation belongs in Execution Planning.' };
  }
  if (!fixture.safeguardsDecided) {
    return { severity: 'error', message: 'The measurement design is missing validity decision.' };
  }
  return undefined;
}

export function reviewMeasurementDesign(
  contract: string,
  fixture: MeasurementDesignFixture,
): ReviewerOutput {
  const findings = contractFindings(contract);
  const semantic = semanticFinding(fixture);
  if (findings.length === 0 && semantic !== undefined) findings.push(semantic);
  return {
    schema_version: 1,
    dispatch_id: createHash('sha256').update(contract).digest('hex'),
    reviewer_agent: 'claude',
    verdict: findings.length === 0 ? 'approve' : 'request_changes',
    summary:
      findings.length === 0
        ? 'Measurement design ownership is clear.'
        : 'Measurement design needs changes.',
    findings,
  };
}
