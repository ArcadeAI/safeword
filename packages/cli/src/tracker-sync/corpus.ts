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

type TicketProjectionEntry = Pick<
  TicketEntry,
  'id' | 'title' | 'status' | 'epic' | 'relativePath'
> &
  Partial<Pick<TicketEntry, 'dependsOn' | 'blockedOn'>>;

/** Parse the `type:` frontmatter value from ticket.md content, defaulting to `task`. */
function parseType(content: string): string {
  return /^type:\s*(\S+)/m.exec(content)?.[1] ?? 'task';
}

/** Parse a scalar frontmatter field from the hand-rolled ticket format. */
function parseScalar(content: string, field: string): string | undefined {
  const prefix = `${field}:`;
  const line = content.split('\n').find(candidate => candidate.startsWith(prefix));
  const value = line?.slice(prefix.length).trim();
  if (value === undefined || value.length === 0) return undefined;
  if (
    value.length >= 2 &&
    ((value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"')))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/** Build the back-link URL for a ticket from the configured repo, else its path. */
export function backLinkUrl(relativePath: string, repo: string | undefined): string {
  return repo === undefined ? relativePath : `https://github.com/${repo}/tree/HEAD/${relativePath}`;
}

/** Map a ticket entry + its type to the neutral TicketInput. */
export function toTicketInput(
  entry: TicketProjectionEntry,
  type: string,
  repo: string | undefined,
  bodyMarkdown: string | undefined,
  graph: { parent?: string; slug?: string } = {},
): TicketInput {
  return {
    id: entry.id,
    slug: graph.slug,
    folder: nodePath.basename(entry.relativePath),
    title: entry.title,
    status: entry.status,
    type,
    epic: entry.epic,
    parent: graph.parent,
    dependsOn: entry.dependsOn ?? [],
    blockedOn: entry.blockedOn ?? [],
    ticketUrl: backLinkUrl(entry.relativePath, repo),
    bodyMarkdown,
  };
}

/** Read all active tickets as TicketInput[] for projection. */
export function readCorpus(cwd: string, repo: string | undefined): TicketInput[] {
  const ticketsDirectory = resolveTicketsDirectory(cwd);
  const relativeLabel = nodePath.relative(cwd, ticketsDirectory) || TICKETS_RELATIVE_PATH;
  return readTickets(ticketsDirectory, relativeLabel).active.map(entry => {
    // Read ticket.md once; derive both the type and the body from its content.
    const ticketPath = nodePath.join(cwd, entry.relativePath, 'ticket.md');
    const content = existsSync(ticketPath) ? readFileSync(ticketPath, 'utf8') : undefined;
    return toTicketInput(entry, parseType(content ?? ''), repo, content, {
      parent: parseScalar(content ?? '', 'parent'),
      slug: parseScalar(content ?? '', 'slug'),
    });
  });
}
