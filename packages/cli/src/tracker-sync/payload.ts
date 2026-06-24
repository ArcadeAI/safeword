/**
 * The payload builder — maps a neutral TicketInput to a provider-neutral
 * IssuePayload (JS5K5G AC3) with a fail-safe minimal body by default (AC10).
 * Pure function: no fs, no network, no frontmatter parsing.
 */

import type { BodyMode, IssuePayload, TicketInput } from './types.js';

/** Statuses that mean the work is finished → the issue is `closed`. */
const TERMINAL_STATUSES = new Set(['done', 'cancelled', 'superseded', 'wontfix']);

/**
 * The body banner — names the repo as the source of truth and cedes status /
 * assignee to the human in the tracker (identity / field-ownership decisions).
 */
function banner(ticket: TicketInput): string {
  return (
    `🔁 Mirror of safeword ticket ${ticket.id}. Source of truth is the repo. ` +
    `Status & assignee are yours to set here; title & labels sync from the repo and overwrite edits.`
  );
}

/** Build the projected issue body. Minimal (default) is banner + back-link only. */
function buildBody(ticket: TicketInput, bodyMode: BodyMode): string {
  const head = `${banner(ticket)}\n\nsafeword ticket ${ticket.id} → ${ticket.ticketUrl}`;
  if (bodyMode === 'full' && ticket.bodyMarkdown !== undefined) {
    return `${head}\n\n---\n\n${ticket.bodyMarkdown}`;
  }
  return head;
}

/** Map a ticket to a flat IssuePayload. */
export function buildPayload(ticket: TicketInput, options: { bodyMode: BodyMode }): IssuePayload {
  const labels = [`type:${ticket.type}`];
  if (ticket.epic !== undefined && ticket.epic.length > 0) {
    labels.unshift(`epic:${ticket.epic}`);
  }
  return {
    title: ticket.title,
    body: buildBody(ticket, options.bodyMode),
    labels,
    state: TERMINAL_STATUSES.has(ticket.status) ? 'closed' : 'open',
  };
}
