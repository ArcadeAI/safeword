/**
 * computePlan — the network-free `sync-tracker --plan` computation (CBTDK8). It
 * diffs the local corpus against the tracker-map and emits create/update/close
 * intents, reusing `planTicketSync` (the create/update/reconcile decision) and
 * `buildPayload` (the minimal issue payload). No network, no credential — pure
 * over the corpus + map, so it runs anywhere and is unit-tested without a live
 * tracker.
 */

import { type GraphEdges, type Intent, PLAN_CONTRACT_VERSION, type SyncPlan } from './contract.js';
import { buildPayload } from './payload.js';
import { aliasMap, orderTicketsForProjection, resolveGraphTicketIds } from './ticket-references.js';
import { planTicketSync, type TrackerMap } from './tracker-map.js';
import type { BodyMode, TicketInput } from './types.js';

export interface ComputePlanInput {
  tickets: TicketInput[];
  map: TrackerMap;
  bodyMode: BodyMode;
}

/**
 * Plan-side graph edges, resolved by **corpus membership** (via the alias map),
 * not by tracker-map recordedness — a new issue's number isn't known pre-create,
 * so edges are expressed by ticket id and the executor resolves them create-then-
 * link. An edge to a ticket outside the corpus resolves to `undefined` and is
 * dropped; an intent with no resolvable edge carries no `graph` key at all.
 */
function buildGraphEdges(
  ticket: TicketInput,
  aliases: Map<string, string>,
): GraphEdges | undefined {
  const { parentTicketId, blockedByTicketIds } = resolveGraphTicketIds(ticket, aliases);

  const graph: GraphEdges = {};
  if (parentTicketId !== undefined) graph.parentTicketId = parentTicketId;
  if (blockedByTicketIds.length > 0) graph.blockedByTicketIds = blockedByTicketIds;
  return Object.keys(graph).length > 0 ? graph : undefined;
}

/** Diff the corpus against the tracker-map into a versioned, network-free `SyncPlan`. */
export function computePlan(input: ComputePlanInput): SyncPlan {
  const aliases = aliasMap(input.tickets);
  // Dependency-first, exactly like the live path: an intent's graph edges may name
  // tickets whose issues do not exist yet, so an executor applying the plan top to
  // bottom must meet the parent/blocker before the ticket that references it. Sharing
  // the live sort also keeps plan order == live order, which the parity suite asserts.
  const intents: Intent[] = [];
  for (const ticket of orderTicketsForProjection(input.tickets)) {
    const payload = buildPayload(ticket, { bodyMode: input.bodyMode });
    const action = planTicketSync(input.map, ticket.id);
    // The fold: planTicketSync decides create / update / reconcile; close is derived
    // from the payload's terminal state. reconcile (a pending entry, only the gh path
    // writes it) folds to update carrying the existing ref. The close intent carries
    // the full payload + graph — the gh path has no field-less close.
    let intent: Intent;
    if (action.kind === 'create') {
      intent = { kind: 'create', ticketId: ticket.id, payload };
    } else if (payload.state === 'closed') {
      intent = { kind: 'close', ticketId: ticket.id, ref: action.ref, payload };
    } else {
      intent = { kind: 'update', ticketId: ticket.id, ref: action.ref, payload };
    }
    const graph = buildGraphEdges(ticket, aliases);
    if (graph !== undefined) intent.graph = graph;
    intents.push(intent);
  }
  return { version: PLAN_CONTRACT_VERSION, intents };
}
