/**
 * Ticket sync — generates capability-discovery indexes over the ticket corpus:
 * `.safeword-project/tickets/INDEX.md` (active tickets, grouped by epic) and
 * `INDEX-completed.md` (the `completed/` archive). Mirrors `learning-sync`
 * (plain markdown + grep, no skill-description char cap) so "is there already
 * a ticket for X?" is one grep instead of a hundreds-of-folders hunt.
 *
 * Fired manually via `safeword sync-tickets`, as a `safeword check` step, and
 * after `ticket new`.
 *
 * Ticket 1GGD28.
 */

// STUB — real implementation follows in GREEN.
export const TICKETS_RELATIVE_PATH = '.safeword-project/tickets';
export const INDEX_FILENAME = 'INDEX.md';
export const COMPLETED_INDEX_FILENAME = 'INDEX-completed.md';
export const COMPLETED_DIRNAME = 'completed';

export interface TicketEntry {
  id: string;
  folder: string;
  relativePath: string;
  title: string;
  status: string;
  epic: string | undefined;
  goal: string | undefined;
}

export interface TicketSyncResult {
  wrote: boolean;
  active: TicketEntry[];
  completed: TicketEntry[];
  skipped: { folder: string; reason: string }[];
  indexPath: string;
  completedIndexPath: string;
}

export function parseTicket(
  _filePath: string,
  _folder: string,
): { ok: true; entry: Omit<TicketEntry, 'relativePath'> } | { ok: false; reason: string } {
  return { ok: false, reason: 'stub' };
}

export function readTickets(_ticketsDirectory: string): {
  active: TicketEntry[];
  completed: TicketEntry[];
  skipped: { folder: string; reason: string }[];
} {
  return { active: [], completed: [], skipped: [] };
}

export function buildIndexContent(
  _entries: TicketEntry[],
  _options: { variant: 'active' | 'completed' },
): string {
  return '';
}

export function syncTickets(cwd: string): TicketSyncResult {
  return {
    wrote: false,
    active: [],
    completed: [],
    skipped: [],
    indexPath: `${cwd}/${TICKETS_RELATIVE_PATH}/${INDEX_FILENAME}`,
    completedIndexPath: `${cwd}/${TICKETS_RELATIVE_PATH}/${COMPLETED_INDEX_FILENAME}`,
  };
}
