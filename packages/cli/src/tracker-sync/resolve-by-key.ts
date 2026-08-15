/**
 * The tracker-key → local-folder join reader (KKNFZA SM2.AC6 / child DGH59K
 * SM1.AC1). Reverse-resolves a tracker key (a tracker's own issue id, e.g.
 * Linear "ENG-45" or GitHub "#123"/"123") to the local ticket folder recorded
 * for it. The tracker-map is the index (ref id → ticket id); the folder is then
 * found by ticket-id prefix and must exist — a stale entry whose folder is gone
 * returns `undefined`, never a dangling path. Pure over the tickets dir + the
 * map. No network.
 */

import { existsSync, readdirSync } from 'node:fs';
import nodePath from 'node:path';

import { findTicketFolderMatch } from '../utils/ticket-folder-matches.js';
import type { TrackerMap } from './tracker-map.js';

/**
 * Strip a GitHub-style leading '#': "#123" matches a recorded ref id "123".
 * Exported so the adopt boundary (`resolveCreationMode`) keys a ticket with the
 * SAME normalized form the reader looks up by — the two sides cannot drift.
 */
export function normalizeTrackerKey(key: string): string {
  return key.startsWith('#') ? key.slice(1) : key;
}

/** Find the `{ID}` or `{ID}-{slug}` folder for a ticket id, or undefined. */
function resolveTicketFolder(ticketsDirectory: string, ticketId: string): string | undefined {
  let entries: string[];
  try {
    entries = readdirSync(ticketsDirectory, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch {
    return undefined;
  }
  const match = findTicketFolderMatch(entries, ticketId);
  return match === undefined ? undefined : nodePath.join(ticketsDirectory, match);
}

/**
 * Resolve a tracker key to its local ticket folder, or undefined when no ticket
 * records that key or the recorded folder no longer exists (the not-found
 * sentinel — never a dangling path).
 */
export function resolveFolderByTrackerKey(
  ticketsDirectory: string,
  map: TrackerMap,
  key: string,
): string | undefined {
  const ticketId = map.findTicketIdByRefId(normalizeTrackerKey(key));
  if (ticketId === undefined) return undefined;
  const folder = resolveTicketFolder(ticketsDirectory, ticketId);
  return folder !== undefined && existsSync(folder) ? folder : undefined;
}
