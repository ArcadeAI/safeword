import type { CliResult } from '../cli-protocol/result.js';
import { evaluateExecutionPrerequisite } from './execution-prerequisite.js';

/** Project planning admission as the narrow public coding-authorization contract. */
export function evaluateCodingAuthorization(cwd: string, ticketId: string): CliResult {
  const prerequisite = evaluateExecutionPrerequisite(cwd, ticketId, {
    legacyExemption: false,
    includeAssurance: true,
  });
  const authorized = prerequisite.state === 'healthy';
  const prerequisiteData =
    typeof prerequisite.data === 'object' && prerequisite.data !== null
      ? (prerequisite.data as Record<string, unknown>)
      : {};
  return {
    ...prerequisite,
    data: {
      command: 'ticket coding-authorization',
      coding_authorization: authorized ? 'authorized' : 'denied',
      grants_authority: false,
      ...(typeof prerequisiteData.achieved_independence === 'string' && {
        achieved_independence: prerequisiteData.achieved_independence,
      }),
    },
  };
}
