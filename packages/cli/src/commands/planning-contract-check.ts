import { type CliResult, createResult } from '../cli-protocol/result.js';
import type { PlanningPhase } from '../planning/phase-contract.js';
import {
  assertActivePlanningAuthorCopy,
  assertActivePlanningReviewerCopy,
  PlanningContractCopyError,
} from '../review/packet.js';
import { planningContractCopyFailure } from '../utils/planning-contract-copy-failure.js';
import { resolveTicketDirectory } from '../utils/product-plan-contract.js';

export function checkPlanningContractCopy(
  cwd: string,
  ticket: string,
  phase: PlanningPhase,
): CliResult {
  if (resolveTicketDirectory(cwd, ticket) === undefined) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'TICKET_NOT_FOUND',
          message: `Ticket "${ticket}" does not resolve.`,
          retryable: false,
        },
      ],
    });
  }
  try {
    assertActivePlanningAuthorCopy(cwd, phase);
    assertActivePlanningReviewerCopy(phase);
    return createResult({
      state: 'healthy',
      data: { command: 'ticket planning-contract-check', status: 'current', planning_phase: phase },
    });
  } catch (error) {
    if (!(error instanceof PlanningContractCopyError)) throw error;
    return planningContractCopyFailure(error, 'ticket planning-contract-check');
  }
}
