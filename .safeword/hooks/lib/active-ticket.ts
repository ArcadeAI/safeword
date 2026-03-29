/**
 * Ticket lookup utilities for quality hooks.
 *
 * getTicketPhase() — look up a specific ticket by ID (used by pre-tool for session-scoped access)
 * getActiveTicket() — find most recent in_progress ticket globally (used by stop hook for review)
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import nodePath from 'node:path';

export interface ActiveTicketInfo {
  phase: string | undefined;
  type: string | undefined;
  folder: string | undefined;
}

const EMPTY: ActiveTicketInfo = { phase: undefined, type: undefined, folder: undefined };

/**
 * Look up a specific ticket's phase by ID (e.g., "038").
 * Used for session-scoped phase access — only checks the ticket THIS session owns.
 */
export function getTicketPhase(projectDirectory: string, ticketId: string): string | undefined {
  const ticketsDirectory = nodePath.join(projectDirectory, '.safeword-project', 'tickets');
  if (!existsSync(ticketsDirectory)) return undefined;

  try {
    const folders = readdirSync(ticketsDirectory);
    const match = folders.find(f => f.startsWith(`${ticketId}-`));
    if (!match) return undefined;

    const content = readFileSync(nodePath.join(ticketsDirectory, match, 'ticket.md'), 'utf8');
    return content.match(/^phase:\s*(\S+)/m)?.[1];
  } catch {
    return undefined;
  }
}

export function getActiveTicket(projectDirectory: string): ActiveTicketInfo {
  const ticketsDirectory = nodePath.join(projectDirectory, '.safeword-project', 'tickets');
  if (!existsSync(ticketsDirectory)) return EMPTY;

  try {
    const folders = readdirSync(ticketsDirectory).filter(f => {
      if (f === 'completed' || f === 'tmp') return false;
      return existsSync(nodePath.join(ticketsDirectory, f, 'ticket.md'));
    });

    let latestFolder = '';
    let latestContent = '';
    let latestMtime = 0;

    for (const folder of folders) {
      const content = readFileSync(nodePath.join(ticketsDirectory, folder, 'ticket.md'), 'utf8');
      if (content.match(/^status:\s*(\S+)/m)?.[1] !== 'in_progress') continue;
      if (content.match(/^type:\s*(\S+)/m)?.[1] === 'epic') continue;

      const mtime = new Date(content.match(/last_modified:\s*(.+)/m)?.[1] ?? '0').getTime();
      if (mtime > latestMtime) {
        latestMtime = mtime;
        latestFolder = folder;
        latestContent = content;
      }
    }

    if (!latestFolder) return EMPTY;

    return {
      phase: latestContent.match(/^phase:\s*(\S+)/m)?.[1],
      type: latestContent.match(/^type:\s*(\S+)/m)?.[1],
      folder: latestFolder,
    };
  } catch {
    return EMPTY;
  }
}
