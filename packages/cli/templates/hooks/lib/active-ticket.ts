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

/**
 * Parse test-definitions.md sub-checkboxes to find current TDD step.
 * Looks for the first scenario with mixed checked/unchecked sub-items.
 * Returns the last completed step: 'red' (1 checked), 'green' (2 checked),
 * 'refactor' (3 checked). Returns null if no active scenario found.
 */
export function parseTddStep(content: string): string | null {
  const lines = content.split('\n');
  const steps = ['red', 'green', 'refactor'];
  let checkedCount = 0;
  let uncheckedCount = 0;
  let previousScenarioComplete = false;

  for (const line of lines) {
    // Detect scenario header — reset counters
    if (/^#{2,3}\s/.test(line)) {
      // Check previous scenario before resetting
      if (checkedCount > 0 && uncheckedCount > 0) {
        return steps[checkedCount - 1] ?? null;
      }
      // Track if previous scenario was fully complete
      previousScenarioComplete = checkedCount === 3 && uncheckedCount === 0;
      checkedCount = 0;
      uncheckedCount = 0;
      continue;
    }

    // Count sub-checkboxes (RED/GREEN/REFACTOR)
    const checkboxMatch = line.match(/^- \[([ x])\] (RED|GREEN|REFACTOR)\s*$/i);
    if (checkboxMatch) {
      if (checkboxMatch[1] === 'x') {
        checkedCount++;
      } else {
        uncheckedCount++;
      }
    }
  }

  // Check last scenario — mixed means active
  if (checkedCount > 0 && uncheckedCount > 0) {
    return steps[checkedCount - 1] ?? null;
  }

  // Last scenario fully complete — return 'refactor' (just finished)
  if (checkedCount === 3 && uncheckedCount === 0) {
    return 'refactor';
  }

  // Last scenario all unchecked but previous was complete — REFACTOR just done
  if (checkedCount === 0 && uncheckedCount > 0 && previousScenarioComplete) {
    return 'refactor';
  }

  return null;
}

/**
 * Derive TDD step from a ticket's test-definitions.md.
 * Returns null if file doesn't exist or no active scenario found.
 */
export function deriveTddStep(projectDirectory: string, ticketFolder: string): string | null {
  const testDefinitionsPath = nodePath.join(
    projectDirectory,
    '.safeword-project',
    'tickets',
    ticketFolder,
    'test-definitions.md',
  );
  if (!existsSync(testDefinitionsPath)) return null;
  try {
    const content = readFileSync(testDefinitionsPath, 'utf8');
    return parseTddStep(content);
  } catch {
    return null;
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
