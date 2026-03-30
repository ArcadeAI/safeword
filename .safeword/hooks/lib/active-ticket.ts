/**
 * Ticket lookup utilities for quality hooks.
 *
 * getTicketInfo() — look up a specific ticket by ID (used by pre-tool and stop hook for session-scoped access)
 * getActiveTicket() — find most recent in_progress ticket globally (used by stop hook for hierarchy navigation)
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import nodePath from 'node:path';

export interface ActiveTicketInfo {
  phase: string | undefined;
  type: string | undefined;
  folder: string | undefined;
}

const EMPTY: ActiveTicketInfo = { phase: undefined, type: undefined, folder: undefined };

export interface TicketDetails {
  phase: string | undefined;
  status: string | undefined;
  type: string | undefined;
  folder: string | undefined;
}

const EMPTY_DETAILS: TicketDetails = {
  phase: undefined,
  status: undefined,
  type: undefined,
  folder: undefined,
};

/**
 * Look up a specific ticket's phase and status by ID (e.g., "038").
 * Re-reads the ticket file each time for stateless re-evaluation.
 */
export function getTicketInfo(projectDirectory: string, ticketId: string): TicketDetails {
  const ticketsDirectory = nodePath.join(projectDirectory, '.safeword-project', 'tickets');
  if (!existsSync(ticketsDirectory)) return EMPTY_DETAILS;

  try {
    const folders = readdirSync(ticketsDirectory);
    const match = folders.find(f => f.startsWith(`${ticketId}-`));
    if (!match) return EMPTY_DETAILS;

    const content = readFileSync(nodePath.join(ticketsDirectory, match, 'ticket.md'), 'utf8');
    return {
      phase: content.match(/^phase:\s*(\S+)/m)?.[1],
      status: content.match(/^status:\s*(\S+)/m)?.[1],
      type: content.match(/^type:\s*(\S+)/m)?.[1],
      folder: match,
    };
  } catch {
    return EMPTY_DETAILS;
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
