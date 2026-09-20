import type { CliResult } from '../cli-protocol/result.js';
import { evaluateExecutionPrerequisite } from './execution-prerequisite.js';

function prerequisiteData(result: CliResult): Record<string, unknown> {
  return typeof result.data === 'object' && result.data !== null
    ? (result.data as Record<string, unknown>)
    : {};
}

function healthyDenialOverride(
  prerequisite: CliResult,
  data: Record<string, unknown>,
  ticketId: string,
): Partial<CliResult> {
  if (prerequisite.state !== 'healthy' || data.prerequisite_status === 'satisfied') return {};
  const notApplicable = data.prerequisite_status === 'not_applicable';
  return {
    state: 'action_required',
    findings: [
      ...prerequisite.findings,
      {
        code: notApplicable
          ? 'coding_authorization_not_applicable'
          : 'invalid_execution_prerequisite_result',
        message: notApplicable
          ? `Ticket ${ticketId} is not an applicable feature ticket for coding authorization.`
          : `Ticket ${ticketId} did not produce a valid execution prerequisite status.`,
        severity: 'warning',
      },
    ],
  };
}

function authorizationEvidence(data: Record<string, unknown>): Record<string, string> {
  return {
    ...(typeof data.achieved_independence === 'string' && {
      achieved_independence: data.achieved_independence,
    }),
    ...(typeof data.authorization_input_identity === 'string' && {
      authorization_input_identity: data.authorization_input_identity,
    }),
  };
}

/** Project planning admission as the narrow public coding-authorization contract. */
export function evaluateCodingAuthorization(cwd: string, ticketId: string): CliResult {
  const prerequisite = evaluateExecutionPrerequisite(cwd, ticketId, {
    legacyExemption: false,
    includeAssurance: true,
    includeAuthorizationIdentity: true,
  });
  return projectCodingAuthorization(prerequisite, ticketId);
}

/** Convert prerequisite evidence into the closed public coding decision. */
export function projectCodingAuthorization(prerequisite: CliResult, ticketId: string): CliResult {
  const data = prerequisiteData(prerequisite);
  const authorized = prerequisite.state === 'healthy' && data.prerequisite_status === 'satisfied';
  return {
    ...prerequisite,
    ...healthyDenialOverride(prerequisite, data, ticketId),
    data: {
      command: 'ticket coding-authorization',
      coding_authorization: authorized ? 'authorized' : 'denied',
      grants_authority: false,
      ...authorizationEvidence(data),
    },
  };
}
