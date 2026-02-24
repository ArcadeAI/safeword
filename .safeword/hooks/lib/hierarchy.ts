/**
 * Hierarchy Navigation Library (Ticket #025)
 *
 * Pure functions for walking ticket parent/child relationships.
 * Used by stop-quality.ts to navigate to the next ticket after completion.
 *
 * All functions use standard Node.js APIs (no Bun-specific code)
 * so they can be unit tested with vitest directly.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parse as parseYaml } from 'yaml';

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

export interface NextAction {
  type: 'navigate' | 'cascade-done' | 'all-done';
  ticketId?: string;
  ticketDirectory?: string;
  parentId?: string;
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

  // Use failsafe schema so `001` stays as string '001' (not integer 1).
  // Without this, YAML parses leading-zero numbers as integers, losing the
  // original text needed to match ticket directory names like `001-epic/`.
  const parsed = parseYaml(frontmatterMatch[1], { schema: 'failsafe' }) as Record<string, string>;

  // With failsafe schema, null becomes the string 'null'
  const isNull = (value: string | undefined): boolean =>
    value === undefined || value === 'null' || value === '';

  return {
    parent: isNull(parsed.parent) ? null : parsed.parent,
    children: Array.isArray(parsed.children) ? parsed.children.map(String) : [],
    status: isNull(parsed.status) ? null : parsed.status,
    phase: isNull(parsed.phase) ? null : parsed.phase,
    type: isNull(parsed.type) ? null : parsed.type,
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
  writeFileSync(ticketPath, content);
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
