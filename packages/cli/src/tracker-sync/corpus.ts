/**
 * Walk the active ticket corpus into the neutral TicketInput the payload builder
 * consumes (JS5K5G). Reuses ticket-sync's reader for the shared fields and reads
 * `type` + body per folder. The back-link URL is derived from the configured
 * `target.repo` when present, else the in-repo relative path (still a stable
 * pointer). Terminal tickets are included so their issues get closed (AC7).
 */

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { readTickets, type TicketEntry, TICKETS_RELATIVE_PATH } from '../ticket-sync/index.js';
import { resolveTicketsDirectory } from '../utils/configured-paths.js';
import type { TicketInput } from './types.js';

/** Read the `type:` frontmatter value from a ticket.md, defaulting to `task`. */
function readType(relativePath: string, cwd: string): string {
  const ticketPath = nodePath.join(cwd, relativePath, 'ticket.md');
  if (!existsSync(ticketPath)) return 'task';
  const match = /^type:\s*(\S+)/m.exec(readFileSync(ticketPath, 'utf8'));
  return match?.[1] ?? 'task';
}

/** Build the back-link URL for a ticket from the configured repo, else its path. */
export function backLinkUrl(relativePath: string, repo: string | undefined): string {
  return repo === undefined ? relativePath : `https://github.com/${repo}/tree/HEAD/${relativePath}`;
}

/** Map a ticket entry + its type to the neutral TicketInput. */
export function toTicketInput(
  entry: Pick<TicketEntry, 'id' | 'title' | 'status' | 'epic' | 'relativePath'>,
  type: string,
  repo: string | undefined,
  bodyMarkdown: string | undefined,
): TicketInput {
  return {
    id: entry.id,
    title: entry.title,
    status: entry.status,
    type,
    epic: entry.epic,
    ticketUrl: backLinkUrl(entry.relativePath, repo),
    bodyMarkdown,
  };
}

/** Read all active tickets as TicketInput[] for projection. */
export function readCorpus(cwd: string, repo: string | undefined): TicketInput[] {
  const ticketsDirectory = resolveTicketsDirectory(cwd);
  const relativeLabel = nodePath.relative(cwd, ticketsDirectory) || TICKETS_RELATIVE_PATH;
  return readTickets(ticketsDirectory, relativeLabel).active.map(entry => {
    const ticketPath = nodePath.join(cwd, entry.relativePath, 'ticket.md');
    const bodyMarkdown = existsSync(ticketPath) ? readFileSync(ticketPath, 'utf8') : undefined;
    return toTicketInput(entry, readType(entry.relativePath, cwd), repo, bodyMarkdown);
  });
}
