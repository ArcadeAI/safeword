/**
 * Hierarchy Navigation Library (Ticket #025)
 *
 * Pure functions for walking ticket parent/child relationships.
 * Used by stop-quality.ts to navigate to the next ticket after completion.
 *
 * All functions use standard Node.js APIs (no Bun-specific code)
 * so they can be unit tested with vitest directly.
 */

import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TicketFrontmatter {
  parent: string | null;
  children: string[];
  status: string | null;
  phase: string | null;
  type: string | null;
}

export type NextAction =
  | { type: 'navigate'; ticketId: string; ticketDirectory: string }
  | { type: 'cascade-done'; parentId: string; ticketDirectory: string }
  | { type: 'all-done' };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Minimal YAML frontmatter parser — no external dependencies.
 * Handles simple key: value pairs and block sequences (- item).
 * All scalar values are returned as raw strings (failsafe mode) so
 * leading-zero IDs like `001` are preserved as '001', not integer 1.
 */
function parseFrontmatter(yaml: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const lines = yaml.split('\n');
  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  for (const line of lines) {
    // Block sequence item (e.g. "  - 013")
    const listMatch = line.match(/^[ \t]+-[ \t]+(.*)$/);
    if (listMatch) {
      currentList?.push(stripQuotes(listMatch[1].trim()));
      continue;
    }

    // Flush pending list before next key
    if (currentList !== null && currentKey !== null) {
      result[currentKey] = currentList;
      currentList = null;
      currentKey = null;
    }

    // Key: value pair
    const pairMatch = line.match(/^(\w+):\s*(.*)$/);
    if (pairMatch) {
      const key = pairMatch[1];
      const raw = pairMatch[2].trim();
      if (raw === '') {
        // Start of block sequence
        currentKey = key;
        currentList = [];
      } else if (raw.startsWith('[') && raw.endsWith(']')) {
        // Flow-style array: [item1, item2] or ['013a', '013b']
        const inner = raw.slice(1, -1).trim();
        result[key] = inner === '' ? [] : inner.split(',').map(s => stripQuotes(s.trim()));
      } else {
        result[key] = stripQuotes(raw);
      }
    }
  }

  // Flush trailing list
  if (currentList !== null && currentKey !== null) {
    result[currentKey] = currentList;
  }

  return result;
}

function stripQuotes(value: string): string {
  return value.replace(/^(['"])(.*)\1$/, '$2');
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Parse ticket.md frontmatter, coerce all IDs to strings.
 * Handles: quoted strings ('013'), unquoted numbers (001),
 * null parent, missing fields.
 */
export function readTicketFrontmatter(ticketDirectory: string): TicketFrontmatter {
  const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
  const content = readFileSync(ticketPath, 'utf8');

  // Extract YAML frontmatter between --- markers
  const frontmatterMatch = content.match(/^---\n([\S\s]*?)\n---/);
  if (!frontmatterMatch) {
    return { parent: null, children: [], status: null, phase: null, type: null };
  }

  // parseFrontmatter returns all scalars as strings (failsafe-equivalent),
  // so '001' stays '001' and 'null' stays the string 'null'.
  const parsed = parseFrontmatter(frontmatterMatch[1]);

  const str = (key: string): string | undefined => {
    const v = parsed[key];
    return Array.isArray(v) ? undefined : v;
  };

  const isNull = (value: string | undefined): boolean =>
    value === undefined || value === 'null' || value === '';

  return {
    parent: isNull(str('parent')) ? null : str('parent')!,
    children: Array.isArray(parsed.children) ? parsed.children.map(String) : [],
    status: isNull(str('status')) ? null : str('status')!,
    phase: isNull(str('phase')) ? null : str('phase')!,
    type: isNull(str('type')) ? null : str('type')!,
  };
}

/**
 * Resolve a ticket ID to its directory path.
 * Scans ticketsDirectory for directories matching `{id}-*`.
 * Returns null if not found or ambiguous (multiple matches).
 */
export function resolveTicketDirectory(ticketId: string, ticketsDirectory: string): string | null {
  if (!existsSync(ticketsDirectory)) return null;

  const matches = readdirSync(ticketsDirectory).filter(directory =>
    directory.startsWith(`${ticketId}-`),
  );

  if (matches.length === 1) {
    return nodePath.join(ticketsDirectory, matches[0]);
  }

  return null;
}

/**
 * Update a ticket's status, phase, and last_modified in its ticket.md.
 */
export function updateTicketStatus(
  ticketDirectory: string,
  newStatus: string,
  newPhase: string,
): void {
  const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
  let content = readFileSync(ticketPath, 'utf8');
  content = content.replace(/^status:\s*\S+/m, `status: ${newStatus}`);
  content = content.replace(/^phase:\s*\S+/m, `phase: ${newPhase}`);
  content = content.replace(/^last_modified:\s*.+/m, `last_modified: ${new Date().toISOString()}`);
  // Write-then-rename for atomicity: prevents partial writes on process kill
  const tmpPath = `${ticketPath}.tmp`;
  writeFileSync(tmpPath, content);
  renameSync(tmpPath, ticketPath);
}

/**
 * Walk the ticket hierarchy to determine what work comes next.
 *
 * - 'navigate': next undone sibling found, go work on it
 * - 'cascade-done': all siblings done, parent should be marked done
 * - 'all-done': no parent or tree exhausted, nothing left to do
 *
 * IMPORTANT: The current ticket must be marked done BEFORE calling this,
 * otherwise it will be found as an undone sibling and navigated back to.
 */
export function findNextWork(ticketDirectory: string, ticketsDirectory: string): NextAction {
  const ticket = readTicketFrontmatter(ticketDirectory);

  // No parent → standalone ticket, nothing to navigate to
  if (!ticket.parent) {
    return { type: 'all-done' };
  }

  // Find parent ticket directory
  const parentDirectory = resolveTicketDirectory(ticket.parent, ticketsDirectory);
  if (!parentDirectory) {
    return { type: 'all-done' };
  }

  const parent = readTicketFrontmatter(parentDirectory);
  const { children } = parent;

  // No children listed → broken/incomplete hierarchy
  if (children.length === 0) {
    return { type: 'all-done' };
  }

  // Find next undone sibling (in children array order)
  for (const childId of children) {
    const childDirectory = resolveTicketDirectory(childId, ticketsDirectory);
    if (!childDirectory) continue;

    const child = readTicketFrontmatter(childDirectory);
    if (child.status !== 'done' && child.status !== 'complete') {
      return { type: 'navigate', ticketId: childId, ticketDirectory: childDirectory };
    }
  }

  // All siblings done → cascade: mark parent done, recurse
  return { type: 'cascade-done', parentId: ticket.parent, ticketDirectory: parentDirectory };
}
