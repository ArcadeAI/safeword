import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { readFrontmatterScalar } from '../utils/frontmatter.js';
import { resolveParentContract, resolveTicketDirectory } from '../utils/product-plan-contract.js';

export interface ReconcileParentOptions {
  accept?: boolean;
}

interface Context {
  ticketPath: string;
  ticket: string;
  parent: string;
  parentJob: string;
  milestone: string;
  phase: string;
  current?: string;
}

function replaceScalar(content: string, field: string, value: string): string {
  const lines = content.split(/\r?\n/);
  const end = lines.indexOf('---', 1);
  if (end === -1) throw new Error('ticket.md has no valid frontmatter.');
  const relative = lines.slice(1, end).findIndex(line => line.startsWith(`${field}:`));
  if (relative === -1) lines.splice(end, 0, `${field}: ${value}`);
  else lines[relative + 1] = `${field}: ${value}`;
  return lines.join('\n');
}

function atomicWrite(path: string, content: string): void {
  const temporaryPath = `${path}.tmp`;
  writeFileSync(temporaryPath, content);
  renameSync(temporaryPath, path);
}

function readContext(cwd: string, ticketId: string): Context {
  const directory = resolveTicketDirectory(cwd, ticketId);
  if (!directory) throw new Error(`Ticket "${ticketId}" does not resolve.`);
  const ticketPath = nodePath.join(directory, 'ticket.md');
  const ticket = readFileSync(ticketPath, 'utf8');
  const parent = readFrontmatterScalar(ticket, 'parent');
  const parentJob = readFrontmatterScalar(ticket, 'parent_job');
  const milestone = readFrontmatterScalar(ticket, 'milestone');
  if (!parent || !parentJob || !milestone) {
    throw new Error('Ticket must declare parent, parent_job, and milestone before reconciliation.');
  }
  return {
    ticketPath,
    ticket,
    parent,
    parentJob,
    milestone,
    phase: readFrontmatterScalar(ticket, 'phase') ?? 'intake',
    current: readFrontmatterScalar(ticket, 'parent_contract_digest'),
  };
}

function healthy(ticketId: string): CliResult {
  return createResult({
    state: 'healthy',
    data: { command: 'ticket reconcile-parent', ticket_id: ticketId },
  });
}

function changed(context: Context, ticketId: string, digest: string, cwd: string): CliResult {
  atomicWrite(context.ticketPath, replaceScalar(context.ticket, 'parent_contract_digest', digest));
  return createResult({
    state: 'changed',
    effects: {
      files: [
        { kind: 'update', target: nodePath.relative(cwd, context.ticketPath), operation: 'write' },
      ],
    },
    data: { command: 'ticket reconcile-parent', ticket_id: ticketId, digest },
  });
}

function reconcile(
  context: Context,
  ticketId: string,
  options: ReconcileParentOptions,
  cwd: string,
): CliResult {
  if (context.phase !== 'intake' && !options.accept && context.current === undefined) {
    throw new Error('Post-intake bootstrap requires --accept after reviewing the parent changes.');
  }
  const resolved = resolveParentContract(cwd, context.parent, context.parentJob, context.milestone);
  if (context.current === resolved.digest) return healthy(ticketId);
  if (context.phase !== 'intake' && !options.accept) {
    throw new Error(
      'Parent contract changed; rerun with --accept after reviewing the changed values.',
    );
  }
  return changed(context, ticketId, resolved.digest, cwd);
}

export function reconcileParentResult(
  ticketId: string,
  options: ReconcileParentOptions,
  cwd: string,
): CliResult {
  try {
    return reconcile(readContext(cwd, ticketId), ticketId, options, cwd);
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
