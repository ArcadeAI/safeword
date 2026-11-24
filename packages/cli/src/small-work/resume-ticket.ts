import nodePath from 'node:path';

import { isGitOperationInProgress } from '../../templates/hooks/lib/git-operation.js';
import { reviewReceiptFromStatus } from '../../templates/hooks/lib/read-receipt.js';
import { resumePendingSmallWork } from '../../templates/hooks/lib/small-work-admission.js';
import { type CliResult, createResult, invalidOperand } from '../cli-protocol/result.js';
import { reviewJobStatus } from '../review/job.js';
import { resolveTicketDirectory } from '../utils/product-plan-contract.js';

export function resumeTicket(cwd: string, ticketId: string): CliResult {
  const command = 'ticket resume';
  const directory = resolveTicketDirectory(cwd, ticketId);
  if (directory === undefined) {
    return invalidOperand(command, 'Supply the ID of an existing ticket.');
  }
  const ticket = nodePath.join(directory, 'ticket.md');
  const result = isGitOperationInProgress(cwd)
    ? { state: 'blocked' as const, message: 'Finish the Git operation before resuming the ticket.' }
    : resumePendingSmallWork(cwd, ticket, id => {
        const { data } = reviewJobStatus(cwd, id);
        return typeof data === 'object' && data !== null
          ? reviewReceiptFromStatus(id, data as Record<string, unknown>)
          : undefined;
      });
  const data = { command, ticket: ticketId, outcome: result.state };
  if (result.state === 'changed') {
    return createResult({
      state: 'changed',
      effects: {
        files: [{ kind: 'update', target: nodePath.relative(cwd, ticket), operation: 'write' }],
      },
      data: { ...data, phase: 'plan-implementation' },
    });
  }
  if (result.state === 'unchanged') return createResult({ state: 'healthy', data });
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: result.state === 'waiting' ? 'SCENARIO_APPROVAL_REQUIRED' : 'TICKET_RESUME_BLOCKED',
        message: result.message ?? 'The ticket could not be resumed.',
        severity: 'warning',
      },
    ],
    data,
  });
}
