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
    // The fold: planTicketSync decides create / update / reconcile; close is derived
    // from the payload's terminal state. reconcile (a pending entry, only the gh path
    // writes it) folds to update carrying the existing ref. The close intent carries
    // the full payload + graph — the gh path has no field-less close.
    if (action.kind === 'create') {
      intents.push({ kind: 'create', ticketId: ticket.id, payload });
    } else if (payload.state === 'closed') {
      intents.push({ kind: 'close', ticketId: ticket.id, ref: action.ref, payload });
    } else {
      intents.push({ kind: 'update', ticketId: ticket.id, ref: action.ref, payload });
    }
    // Plan-side graph edges land in the next slice.
  }
  return { version: PLAN_CONTRACT_VERSION, intents };
}
