/**
 * computePlan — the network-free `sync-tracker --plan` computation (CBTDK8). It
 * diffs the local corpus against the tracker-map and emits create/update/close
 * intents, reusing `planTicketSync` (the create/update/reconcile decision) and
 * `buildPayload` (the minimal issue payload). No network, no credential — pure
 * over the corpus + map, so it runs anywhere and is unit-tested without a live
 * tracker.
 */

import { type Intent, PLAN_CONTRACT_VERSION, type SyncPlan } from './contract.js';
import { buildPayload } from './payload.js';
import { planTicketSync, type TrackerMap } from './tracker-map.js';
import type { BodyMode, TicketInput } from './types.js';

export interface ComputePlanInput {
  tickets: TicketInput[];
  map: TrackerMap;
  bodyMode: BodyMode;
}

export function computePlan(input: ComputePlanInput): SyncPlan {
  const intents: Intent[] = [];
  for (const ticket of input.tickets) {
    const payload = buildPayload(ticket, { bodyMode: input.bodyMode });
    const action = planTicketSync(input.map, ticket.id);
    if (action.kind === 'create') {
      intents.push({ kind: 'create', ticketId: ticket.id, payload });
    }
    // update/close/reconcile fold and plan-side graph edges land in later slices.
  }
  return { version: PLAN_CONTRACT_VERSION, intents };
}
