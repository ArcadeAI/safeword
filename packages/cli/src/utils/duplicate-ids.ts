/**
 * Duplicate ticket-ID detector (ticket 158, slice 5).
 *
 * Pure function: scans `.safeword-project/tickets/`, parses `id:` from each
 * ticket.md's frontmatter, returns groups of folders sharing the same ID.
 * Both wiring sites (pre-commit hook, CI step) reuse this — one source of
 * truth for the loud-failure mechanism that catches anything the
 * uncoordinated-ID prevention layer misses.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import nodePath from 'node:path';

export interface DuplicateGroup {
  id: string;
  folders: string[];
}

const SKIP_DIRECTORIES = new Set(['completed', 'tmp']);

const ID_FRONTMATTER = /^id:\s*['"]?([^'"\s]+)['"]?\s*$/m;

export function findDuplicateTicketIds(projectDirectory: string): DuplicateGroup[] {
  const ticketsDirectory = nodePath.join(projectDirectory, '.safeword-project', 'tickets');
  if (!existsSync(ticketsDirectory)) return [];

  const groups = collectIdToFolders(ticketsDirectory);
  const duplicates: DuplicateGroup[] = [];
  for (const [id, folders] of groups) {
    if (folders.length > 1) duplicates.push({ id, folders });
  }
  return duplicates;
}

function collectIdToFolders(ticketsDirectory: string): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const entry of readdirSync(ticketsDirectory)) {
    const id = readTicketId(ticketsDirectory, entry);
    if (id === undefined) continue;
    const existing = groups.get(id);
    if (existing) existing.push(entry);
    else groups.set(id, [entry]);
  }
  return groups;
}

function readTicketId(ticketsDirectory: string, entry: string): string | undefined {
  if (SKIP_DIRECTORIES.has(entry)) return undefined;
  const folderPath = nodePath.join(ticketsDirectory, entry);
  if (!statSync(folderPath).isDirectory()) return undefined;
  const ticketPath = nodePath.join(folderPath, 'ticket.md');
  if (!existsSync(ticketPath)) return undefined;
  return ID_FRONTMATTER.exec(readFileSync(ticketPath, 'utf8'))?.[1];
}
