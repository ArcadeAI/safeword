/**
 * Find the most recently modified in_progress non-epic ticket.
 * Used by pre-tool-quality.ts (phase access control) and stop-quality.ts (phase-aware review).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import nodePath from 'node:path';

export interface ActiveTicketInfo {
  phase: string | undefined;
  type: string | undefined;
  folder: string | undefined;
}

const EMPTY: ActiveTicketInfo = { phase: undefined, type: undefined, folder: undefined };

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
      const content = readFileSync(nodePath.join(ticketsDirectory, folder, 'ticket.md'), 'utf-8');
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
