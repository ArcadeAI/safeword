import { type CliResult, createResult } from '../cli-protocol/result.js';
import type { PlanningContractCopyError } from '../review/packet.js';

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
