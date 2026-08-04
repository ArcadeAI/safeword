/**
 * Ticket-reference resolution shared by the sync-tracker orchestrator (the `gh`
 * path) and `computePlan` (the portable `--plan` path, CBTDK8). A ticket may
 * name a parent/dependency by id, slug, or folder; these map any such alias back
 * to the canonical ticket id — but only for tickets **present in the corpus**
 * (the alias map is built from the corpus alone), so an out-of-corpus reference
 * resolves to `undefined` and is dropped. Pure; no fs, no frontmatter parsing.
 */

import type { TicketInput } from './types.js';

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
function resolveTicketReference(
  raw: string | undefined,
  aliases: Map<string, string>,
): string | undefined {
  if (raw === undefined || raw.length === 0) return undefined;
  return aliases.get(raw);
}

export interface ResolvedGraphTicketIds {
  parentTicketId?: string;
  blockedByTicketIds: string[];
}

/**
 * Resolve the canonical graph intent once for both live and portable
 * projection. Out-of-corpus and self-referential edges are omitted; blocker
 * aliases are deduplicated after resolution.
 */
export function resolveGraphTicketIds(
  ticket: TicketInput,
  aliases: Map<string, string>,
): ResolvedGraphTicketIds {
  const isExternalEdge = (id: string | undefined): id is string =>
    id !== undefined && id !== ticket.id;
  const parentCandidate =
    resolveTicketReference(ticket.parent, aliases) ?? resolveTicketReference(ticket.epic, aliases);
  const parentTicketId = isExternalEdge(parentCandidate) ? parentCandidate : undefined;
  const blockedByTicketIds = [
    ...new Set(
      [...(ticket.dependsOn ?? []), ...(ticket.blockedOn ?? [])]
        .map(reference => resolveTicketReference(reference, aliases))
        .filter(id => isExternalEdge(id)),
    ),
  ];
  return {
    ...(parentTicketId !== undefined && { parentTicketId }),
    blockedByTicketIds,
  };
}

function isString(value: string | undefined): value is string {
  return value !== undefined;
}

/** Every corpus ticket this one depends on (parent, epic, dependsOn, blockedOn). */
function prerequisiteIds(ticket: TicketInput, aliases: Map<string, string>): string[] {
  const prerequisites = [
    resolveTicketReference(ticket.parent, aliases),
    resolveTicketReference(ticket.epic, aliases),
    ...(ticket.dependsOn ?? []).map(id => resolveTicketReference(id, aliases)),
    ...(ticket.blockedOn ?? []).map(id => resolveTicketReference(id, aliases)),
  ];
  return [...new Set(prerequisites.filter(isString).filter(id => id !== ticket.id))];
}

/**
 * Dependency-first ordering: a ticket appears after every corpus ticket it depends
 * on. Shared by the live `gh` projection and `computePlan` so a plan's intent order
 * matches the order the live path acts in — an executor applying intents top to
 * bottom never references an issue that a later intent still has to create.
 */
export function orderTicketsForProjection(tickets: TicketInput[]): TicketInput[] {
  const aliases = aliasMap(tickets);
  const byId = new Map(tickets.map(ticket => [ticket.id, ticket]));
  const ordered: TicketInput[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(ticket: TicketInput): void {
    if (visited.has(ticket.id)) return;
    if (visiting.has(ticket.id)) return;
    visiting.add(ticket.id);
    for (const prerequisite of prerequisiteIds(ticket, aliases)) {
      const target = byId.get(prerequisite);
      if (target !== undefined) visit(target);
    }
    visiting.delete(ticket.id);
    visited.add(ticket.id);
    ordered.push(ticket);
  }

  for (const ticket of tickets) visit(ticket);
  return ordered;
}
