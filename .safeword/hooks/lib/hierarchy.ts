/**
 * Hierarchy Navigation Library (Ticket #025)
 *
 * Pure functions for walking ticket parent/child relationships.
 * Used by stop-quality.ts to navigate to the next ticket after completion.
 *
 * All functions use standard Node.js APIs (no Bun-specific code)
 * so they can be unit tested with vitest directly.
 */

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
// Functions (stubs — RED phase)
// ---------------------------------------------------------------------------

/**
 * Parse ticket.md frontmatter, coerce all IDs to strings.
 * Handles: quoted strings ('013'), unquoted numbers (001),
 * null parent, missing fields.
 */
export function readTicketFrontmatter(_ticketDirectory: string): TicketFrontmatter {
  throw new Error('Not implemented');
}

/**
 * Resolve a ticket ID to its directory path.
 * Scans ticketsDirectory for directories matching `{id}-*`.
 * Returns null if not found or ambiguous (multiple matches).
 */
export function resolveTicketDirectory(
  _ticketId: string,
  _ticketsDirectory: string,
): string | null {
  throw new Error('Not implemented');
}

/**
 * Update a ticket's status, phase, and last_modified in its ticket.md.
 */
export function updateTicketStatus(
  _ticketDirectory: string,
  _newStatus: string,
  _newPhase: string,
): void {
  throw new Error('Not implemented');
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
export function findNextWork(_ticketDirectory: string, _ticketsDirectory: string): NextAction {
  throw new Error('Not implemented');
}
