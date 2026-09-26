import { type CliResult, createResult } from '../cli-protocol/result.js';
import type { PlanningPhase } from '../planning/phase-contract.js';
import { assertActivePlanningAuthorCopy, PlanningContractCopyError } from '../review/packet.js';
import { resolveTicketDirectory } from '../utils/product-plan-contract.js';

export function planningContractCopyFailure(
  error: PlanningContractCopyError,
  command: string,
): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: error.code,
        message: error.message,
        severity: 'error',
        metadata: { planning_phase: error.phase, contract_path: error.contractPath },
      },
    ],
    data: { command, status: 'blocked' },
  });
}

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
    return createResult({
      state: 'healthy',
      data: { command: 'ticket planning-contract-check', status: 'current', planning_phase: phase },
    });
  } catch (error) {
    if (!(error instanceof PlanningContractCopyError)) throw error;
    return planningContractCopyFailure(error, 'ticket planning-contract-check');
  }
}
