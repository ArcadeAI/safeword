import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { readFrontmatterScalar } from '../utils/frontmatter.js';
import { resolveParentContract, resolveTicketDirectory } from '../utils/product-plan-contract.js';

export interface ReconcileParentOptions {
  accept?: boolean;
}

function replaceFrontmatterScalar(content: string, field: string, value: string): string {
  const lines = content.split(/\r?\n/);
  const end = lines.indexOf('---', 1);
  if (end === -1) throw new Error('ticket.md has no valid frontmatter.');
  const index = lines.slice(1, end).findIndex(line => line.startsWith(`${field}:`));
  if (index === -1) lines.splice(end, 0, `${field}: ${value}`);
  else lines[index + 1] = `${field}: ${value}`;
  return lines.join('\n');
}

function atomicWrite(path: string, content: string): void {
  const temporaryPath = `${path}.tmp`;
  writeFileSync(temporaryPath, content);
  renameSync(temporaryPath, path);
}

export function reconcileParentResult(
  ticketId: string,
  options: ReconcileParentOptions,
  cwd: string,
): CliResult {
  try {
    const directory = resolveTicketDirectory(cwd, ticketId);
    if (!directory) throw new Error(`Ticket "${ticketId}" does not resolve.`);
    const ticketPath = nodePath.join(directory, 'ticket.md');
    const ticket = readFileSync(ticketPath, 'utf8');
    const parent = readFrontmatterScalar(ticket, 'parent');
    const parentJob = readFrontmatterScalar(ticket, 'parent_job');
    const milestone = readFrontmatterScalar(ticket, 'milestone');
    if (!parent || !parentJob || !milestone) {
      throw new Error(
        'Ticket must declare parent, parent_job, and milestone before reconciliation.',
      );
    }
    const phase = readFrontmatterScalar(ticket, 'phase') ?? 'intake';
    const current = readFrontmatterScalar(ticket, 'parent_contract_digest');
    if (phase !== 'intake' && !options.accept && current === undefined) {
      throw new Error(
        'Post-intake bootstrap requires --accept after reviewing the parent changes.',
      );
    }
    const resolved = resolveParentContract(cwd, parent, parentJob, milestone);
    if (current === resolved.digest) {
      return createResult({
        state: 'healthy',
        data: { command: 'ticket reconcile-parent', ticket_id: ticketId },
      });
    }
    if (phase !== 'intake' && !options.accept) {
      throw new Error(
        'Parent contract changed; rerun with --accept after reviewing the changed values.',
      );
    }
    atomicWrite(
      ticketPath,
      replaceFrontmatterScalar(ticket, 'parent_contract_digest', resolved.digest),
    );
    return createResult({
      state: 'changed',
      effects: {
        files: [{ kind: 'update', target: nodePath.relative(cwd, ticketPath), operation: 'write' }],
      },
      data: { command: 'ticket reconcile-parent', ticket_id: ticketId, digest: resolved.digest },
    });
  } catch (error) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'PARENT_RECONCILIATION_FAILED',
          message: error instanceof Error ? error.message : String(error),
          retryable: false,
        },
      ],
      data: { command: 'ticket reconcile-parent', ticket_id: ticketId },
    });
  }
}
