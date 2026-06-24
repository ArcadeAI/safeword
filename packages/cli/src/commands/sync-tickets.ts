/**
 * Sync Tickets command — regenerates the capability-discovery indexes
 * `<namespace-root>/tickets/INDEX.md` (active, grouped by epic) and
 * `INDEX-completed.md` (the completed/ archive) from each ticket.md's
 * frontmatter + Goal line.
 *
 * Runnable manually via `safeword sync-tickets`; also invoked as a
 * `safeword check` step and after `safeword ticket new`.
 *
 * Ticket 1GGD28.
 */

import process from 'node:process';

import { syncTickets } from '../ticket-sync/index.js';
import { info, success, warn } from '../utils/output.js';
import { buildIndexConflictSummary } from './ticket-index-warnings.js';

interface SyncTicketsOptions {
  quiet?: boolean;
}

export function syncTicketsCommand(options: SyncTicketsOptions = {}): void {
  const cwd = process.cwd();
  const result = syncTickets(cwd);

  for (const skip of result.skipped) {
    process.stderr.write(`skipping tickets/${skip.folder}: ${skip.reason}\n`);
  }

  if (options.quiet) return;

  const counts = `${result.active.length} active, ${result.completed.length} completed`;
  if (result.wrote) {
    success(`Regenerated ticket indexes (${counts})`);
  } else {
    info(`ticket indexes already current (${counts})`);
  }

  if (result.skipped.length > 0) {
    warn(`${result.skipped.length} ticket folder(s) skipped — see stderr for details`);
  }

  if (result.indexConflicts.length > 0) {
    warn(buildIndexConflictSummary(result.indexConflicts.length));
  }
}
