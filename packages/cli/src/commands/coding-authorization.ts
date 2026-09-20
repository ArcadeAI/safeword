import type { CliResult } from '../cli-protocol/result.js';
import { evaluateExecutionPrerequisite } from './execution-prerequisite.js';

/** Project planning admission as the narrow public coding-authorization contract. */
export function evaluateCodingAuthorization(cwd: string, ticketId: string): CliResult {
  const prerequisite = evaluateExecutionPrerequisite(cwd, ticketId, {
    legacyExemption: false,
    includeAssurance: true,
    includeAuthorizationIdentity: true,
  });
  const prerequisiteData =
    typeof prerequisite.data === 'object' && prerequisite.data !== null
      ? (prerequisite.data as Record<string, unknown>)
      : {};
  const authorized =
    prerequisite.state === 'healthy' && prerequisiteData.prerequisite_status === 'satisfied';
  const notApplicable =
    prerequisite.state === 'healthy' && prerequisiteData.prerequisite_status === 'not_applicable';
  return {
    ...prerequisite,
    ...(notApplicable && {
      state: 'action_required',
      findings: [
        ...prerequisite.findings,
        {
          code: 'coding_authorization_not_applicable',
          message: `Ticket ${ticketId} is not an applicable feature ticket for coding authorization.`,
          severity: 'warning' as const,
        },
      ],
    }),
    data: {
      command: 'ticket coding-authorization',
      coding_authorization: authorized ? 'authorized' : 'denied',
      grants_authority: false,
      ...(typeof prerequisiteData.achieved_independence === 'string' && {
        achieved_independence: prerequisiteData.achieved_independence,
      }),
      ...(typeof prerequisiteData.authorization_input_identity === 'string' && {
        authorization_input_identity: prerequisiteData.authorization_input_identity,
      }),
    },
  };
}
