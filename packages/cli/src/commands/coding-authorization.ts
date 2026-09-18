import type { CliResult } from '../cli-protocol/result.js';
import { evaluateExecutionPrerequisite } from './execution-prerequisite.js';

/** Project planning admission as the narrow public coding-authorization contract. */
export function evaluateCodingAuthorization(cwd: string, ticketId: string): CliResult {
  const prerequisite = evaluateExecutionPrerequisite(cwd, ticketId, { legacyExemption: false });
  const authorized = prerequisite.state === 'healthy';
  return {
    ...prerequisite,
    data: {
      command: 'ticket coding-authorization',
      coding_authorization: authorized ? 'authorized' : 'denied',
      grants_authority: false,
    },
  };
}
