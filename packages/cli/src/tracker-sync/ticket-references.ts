/**
 * Ticket-reference resolution shared by the sync-tracker orchestrator (the `gh`
 * path) and `computePlan` (the portable `--plan` path, CBTDK8). A ticket may
 * name a parent/dependency by id, slug, or folder; these map any such alias back
 * to the canonical ticket id — but only for tickets **present in the corpus**
 * (the alias map is built from the corpus alone), so an out-of-corpus reference
 * resolves to `undefined` and is dropped. Pure; no fs, no frontmatter parsing.
 */

import type { TicketInput } from './types.js';

function isString(value: string | undefined): value is string {
  return value !== undefined;
}

function ticketAliases(ticket: TicketInput): string[] {
  return [ticket.id, ticket.slug, ticket.folder].filter(isString);
}

/** Build alias → canonical-ticket-id over the corpus (id, slug, and folder each alias). */
export function aliasMap(tickets: TicketInput[]): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const ticket of tickets) {
    for (const alias of ticketAliases(ticket)) aliases.set(alias, ticket.id);
  }
  return aliases;
}

/** Resolve a raw reference to a canonical corpus ticket id, or `undefined` if not in the corpus. */
export function resolveTicketReference(
  raw: string | undefined,
  aliases: Map<string, string>,
): string | undefined {
  if (raw === undefined || raw.length === 0) return undefined;
  return aliases.get(raw);
}
