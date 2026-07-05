/**
 * Link a child ticket to its epic (ticket F9W3JP): append the child id to the
 * epic's `children:` list, idempotently and atomically. The child→epic
 * relationship's single source of truth is the child's `parent:` field; this
 * helper maintains the reverse index (`children:`) the navigation contract in
 * `hierarchy.ts` walks.
 *
 * Mirrors `hierarchy.ts`'s zero-dependency approach: inline frontmatter parsing
 * (no `yaml` package) and a write-then-rename atomic mutation, matching
 * `updateTicketStatus`.
 */

import { existsSync, readdirSync } from 'node:fs';
import nodePath from 'node:path';

import { resolveTicketsDirectory } from './configured-paths.js';

export type LinkResult = { ok: true } | { ok: false; reason: string };

/**
 * Append `childId` to the `epicId` epic's `children:` list. Validates the epic
 * exists and is `type: epic`; appends only if absent (idempotent); writes
 * atomically. Returns a reason on failure so the caller can fail loud without
 * having created anything.
 */
export function linkChildToEpic(_cwd: string, _childId: string, _epicId: string): LinkResult {
  // RED stub — implemented in GREEN.
  return { ok: false, reason: 'not implemented' };
}

/** Resolve a ticket folder by id (`{id}-{slug}` or legacy `{id}`), or undefined. */
export function resolveTicketFolderById(cwd: string, id: string): string | undefined {
  const ticketsDirectory = resolveTicketsDirectory(cwd);
  if (!existsSync(ticketsDirectory)) return undefined;
  for (const entry of readdirSync(ticketsDirectory)) {
    if (entry === id || entry.startsWith(`${id}-`)) {
      return nodePath.join(ticketsDirectory, entry);
    }
  }
  return undefined;
}
