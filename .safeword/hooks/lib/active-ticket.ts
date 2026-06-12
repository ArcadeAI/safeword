/**
 * Ticket lookup utilities for quality hooks.
 *
 * getTicketInfo() — look up a specific ticket by ID (used by pre-tool and stop hook for session-scoped access)
 * getActiveTicket() — find most recent in_progress ticket globally (used by stop hook for hierarchy navigation)
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';
import { resolveNamespaceRoot } from './namespace-root.js';

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
  slug?: string;
}

const EMPTY_DETAILS: TicketDetails = {
  phase: undefined,
  status: undefined,
  type: undefined,
  folder: undefined,
  slug: undefined,
};

/**
 * Look up a specific ticket's phase and status by ID.
 *
 * Resolves two folder layouts:
 *   - `{id}-{slug}/` — folder name starts with `${id}-` (e.g. `080-foo`,
 *     `G2E72G-yolo-mode`). Canonical going forward; case-sensitive on the prefix
 *     since Base32 IDs are minted uppercase and legacy numeric IDs have no case.
 *   - `{id}/` — folder name equals the ID exactly. Historical shape used by
 *     opaque Base32 tickets minted before the slug suffix was added; lookup is
 *     case-insensitive on input.
 *
 * If two folders both resolve to the input ID (manual mistake or copy-paste),
 * lookup writes a warning to stderr and returns empty details rather than
 * silently picking one — the duplicate-ID guard (slice 5) is the loud-failure
 * mechanism; lookup just refuses to guess.
 */
export function getTicketInfo(projectDirectory: string, ticketId: string): TicketDetails {
  const ticketsDirectory = nodePath.join(resolveNamespaceRoot(projectDirectory), 'tickets');
  if (!existsSync(ticketsDirectory)) return EMPTY_DETAILS;

  try {
    const folders = readdirSync(ticketsDirectory);
    const matches = findTicketFolderMatches(folders, ticketId);
    if (matches.length === 0) return EMPTY_DETAILS;
    if (matches.length > 1) {
      process.stderr.write(`Ambiguous ticket ID "${ticketId}": ${matches.join(', ')}\n`);
      return EMPTY_DETAILS;
    }

    const [match] = matches;
    if (match === undefined) return EMPTY_DETAILS;
    const content = readFileSync(nodePath.join(ticketsDirectory, match, 'ticket.md'), 'utf8');
    const slug =
      content.match(/^slug:\s*(\S+)/m)?.[1] ??
      (match.startsWith(`${ticketId}-`) ? match.slice(ticketId.length + 1) : undefined);
    return {
      phase: content.match(/^phase:\s*(\S+)/m)?.[1],
      status: content.match(/^status:\s*(\S+)/m)?.[1],
      type: content.match(/^type:\s*(\S+)/m)?.[1],
      folder: match,
      slug,
    };
  } catch {
    return EMPTY_DETAILS;
  }
}

function findTicketFolderMatches(folders: string[], ticketId: string): string[] {
  const upperId = ticketId.toUpperCase();
  const legacyPrefix = `${ticketId}-`;
  return folders.filter(f => f.toUpperCase() === upperId || f.startsWith(legacyPrefix));
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

    // Count sub-checkboxes (RED/GREEN/REFACTOR). Word boundary after the step
    // keyword tolerates annotated lines (`- [x] RED abc1234`, `- [x] REFACTOR
    // skip: ...`) introduced by ticket J7VBGJ — annotation is irrelevant to
    // step derivation; step comes from which positions are filled.
    const checkboxMatch = line.match(/^- \[([ x])\] (RED|GREEN|REFACTOR)\b/i);
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
    resolveNamespaceRoot(projectDirectory),
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

/**
 * Resolve the effective Stop-hook phase context for a session's bound ticket,
 * closing the status/phase done-gate sidestep (ticket 2JMQMX).
 *
 * Normally only `in_progress` tickets carry phase context, so a ticket flipped
 * to `status: done` without passing through `phase: done` would drop out of
 * context entirely and bypass the done-gate (tests, verify.md, /verify+/audit).
 * This surfaces such a close as `phase: 'done'` so the existing gate runs:
 *   - build tickets (task/feature WITH a test-definitions.md) → full gate
 *     (tests + scenarios + verify.md + skills, via the gate's isFeature branch);
 *   - epics → proportionate gate (tests + verify.md; epics aren't isFeature, so
 *     scenarios/skills are not demanded).
 * Everything else is exempt — in_progress passes its real phase through, an
 * already-done ticket (phase already `done`) is not re-gated (no loop), and
 * non-build closes (patches, typeless, or task/feature with no scenarios yet)
 * keep the deliberate status escape hatch.
 *
 * Pure: the caller supplies `hasTestDefinitions` (filesystem check) so this
 * stays unit-testable.
 */
export function resolveStopPhase(
  details: TicketDetails,
  hasTestDefinitions: boolean,
): ActiveTicketInfo {
  // in_progress: normal flow — pass the ticket's real phase through unchanged.
  if (details.status === 'in_progress') {
    return { phase: details.phase, type: details.type, folder: details.folder };
  }

  // A status:done close that never reached phase:done is the sidestep. Route it
  // into the done-gate (surface phase:'done'), but only for tickets that have
  // something to verify: build tickets (task/feature WITH scenarios) and epics.
  // `phase !== 'done'` skips an already-gated ticket so the gate can't loop.
  if (details.status === 'done' && details.phase !== 'done') {
    const isBuildTicket =
      (details.type === 'task' || details.type === 'feature') && hasTestDefinitions;
    const isEpic = details.type === 'epic';
    if (isBuildTicket || isEpic) {
      return { phase: 'done', type: details.type, folder: details.folder };
    }
  }

  // Everything else (patches, typeless, scenario-less, non-done statuses) keeps
  // the deliberate status escape hatch — no phase context.
  return EMPTY;
}

/**
 * Every in_progress, non-epic ticket folder — the build tickets a session could
 * be working. The stamp-earning step (NMSD94) uses this to resolve which ticket
 * to stamp and to fail loudly when more than one is active, rather than silently
 * guessing a ticket that may differ from the one the gate is checking.
 */
export function getInProgressTicketFolders(projectDirectory: string): string[] {
  const ticketsDirectory = nodePath.join(resolveNamespaceRoot(projectDirectory), 'tickets');
  if (!existsSync(ticketsDirectory)) return [];

  try {
    return readdirSync(ticketsDirectory).filter(folder => {
      if (folder === 'completed' || folder === 'tmp') return false;
      const ticketFile = nodePath.join(ticketsDirectory, folder, 'ticket.md');
      if (!existsSync(ticketFile)) return false;
      const content = readFileSync(ticketFile, 'utf8');
      return (
        content.match(/^status:\s*(\S+)/m)?.[1] === 'in_progress' &&
        content.match(/^type:\s*(\S+)/m)?.[1] !== 'epic'
      );
    });
  } catch {
    return [];
  }
}

export function getActiveTicket(projectDirectory: string): ActiveTicketInfo {
  const ticketsDirectory = nodePath.join(resolveNamespaceRoot(projectDirectory), 'tickets');
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
