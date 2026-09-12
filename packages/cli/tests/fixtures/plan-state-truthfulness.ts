import { createHash } from 'node:crypto';

import type { ReviewerOutput } from '../../src/review/contract.js';
import { obligationClause } from './plan-focused-reviewability.js';

export const PLAN_STATE_OBLIGATION = 'Plan-state truthfulness';
const PLAN_STATE_REQUIREMENTS = [
  /proposed decisions, implemented facts, available proof, known defects, and pending human authority/iu,
  /implementation.+not proof/iu,
  /proof.+not human authority/iu,
  /independent review.+not human approval/iu,
  /contradict.+label.+separately/iu,
  /absent behavior.+proposed/iu,
] as const;

export interface PlanStateFixture {
  readonly implementationExists: boolean;
  readonly currentBoundaryProof: boolean;
  readonly humanReleaseApproval: boolean;
  readonly humanDesignApproval: boolean;
  readonly independentReviewPassed: boolean;
  readonly knownDefectContradictsDecision: boolean;
  readonly plannedBehaviorImplemented: boolean;
  readonly claim: string;
}

type Finding = { severity: 'error'; message: string };

const STATE_CONFLICTS: readonly {
  applies: (fixture: PlanStateFixture) => boolean;
  message: string;
}[] = [
  {
    applies: fixture =>
      fixture.implementationExists &&
      !fixture.currentBoundaryProof &&
      /implemented and proven/iu.test(fixture.claim),
    message: 'Implementation is presented as proof.',
  },
  {
    applies: fixture =>
      fixture.currentBoundaryProof &&
      !fixture.humanReleaseApproval &&
      /approved to release/iu.test(fixture.claim),
    message: 'Proof is presented as human authority.',
  },
  {
    applies: fixture =>
      fixture.independentReviewPassed &&
      !fixture.humanDesignApproval &&
      /human-approved/iu.test(fixture.claim),
    message: 'Independent review is presented as human authority.',
  },
];

function contractFindings(contract: string): Finding[] {
  const clause = obligationClause(contract, PLAN_STATE_OBLIGATION)?.replaceAll(/\s+/gu, ' ');
  if (clause === undefined) {
    return [{ severity: 'error', message: `The contract is missing ${PLAN_STATE_OBLIGATION}.` }];
  }
  return PLAN_STATE_REQUIREMENTS.flatMap((requirement, index) =>
    requirement.test(clause)
      ? []
      : [
          {
            severity: 'error' as const,
            message: `The ${PLAN_STATE_OBLIGATION} contract is missing requirement ${index + 1}.`,
          },
        ],
  );
}

export function reviewPlanState(contract: string, fixture: PlanStateFixture): ReviewerOutput {
  const findings = contractFindings(contract);
  const conflict = STATE_CONFLICTS.find(candidate => candidate.applies(fixture));
  if (findings.length === 0 && conflict !== undefined) {
    findings.push({ severity: 'error', message: conflict.message });
  }

  return {
    schema_version: 1,
    dispatch_id: createHash('sha256').update(contract).digest('hex'),
    reviewer_agent: 'claude',
    verdict: findings.length === 0 ? 'approve' : 'request_changes',
    summary:
      findings.length === 0 ? 'Plan-state claims are truthful.' : 'Plan-state claims conflict.',
    findings,
  };
}
