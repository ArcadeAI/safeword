/**
 * computePlan — the network-free `--plan` computation (CBTDK8). Pure over the
 * corpus + tracker-map; proves the create/update/close/reconcile fold and the
 * plan-side graph edges without a live tracker (#363).
 */

import { describe, expect, it } from 'vitest';

import { buildPayload } from '../../src/tracker-sync/payload.js';
import { computePlan } from '../../src/tracker-sync/plan.js';
import { TrackerMap } from '../../src/tracker-sync/tracker-map.js';
import type { TicketInput } from '../../src/tracker-sync/types.js';

function ticket(overrides: Partial<TicketInput> = {}): TicketInput {
  return {
    id: 'T1',
    title: 'Login bug',
    status: 'in_progress',
    type: 'task',
    epic: undefined,
    ticketUrl: 'https://github.com/acme/repo/tree/main/.project/tickets/T1-login',
    ...overrides,
  };
}

describe('computePlan (portable-tracker-transport.TB1.AC1)', () => {
  it('emits a create intent with the minimal payload for a never-synced ticket', () => {
    const t = ticket();
    const plan = computePlan({
      tickets: [t],
      map: new TrackerMap(),
      bodyMode: 'minimal',
    });

    expect(plan.version).toBe(1);
    expect(plan.intents).toEqual([
      { kind: 'create', ticketId: 'T1', payload: buildPayload(t, { bodyMode: 'minimal' }) },
    ]);
  });

  it('emits an empty but versioned plan for an empty corpus', () => {
    const plan = computePlan({
      tickets: [],
      map: new TrackerMap(),
      bodyMode: 'minimal',
    });

    expect(plan).toEqual({ version: 1, intents: [] });
  });

  it('emits an update intent carrying the recorded ref for a recorded open ticket', () => {
    const t = ticket({ status: 'in_progress' });
    const map = new TrackerMap();
    const ref = { provider: 'github' as const, id: '549', url: 'https://x/issues/549' };
    map.record('T1', ref);

    const plan = computePlan({ tickets: [t], map, bodyMode: 'minimal' });

    expect(plan.intents).toEqual([
      { kind: 'update', ticketId: 'T1', ref, payload: buildPayload(t, { bodyMode: 'minimal' }) },
    ]);
  });

  it('emits a close intent with the ref and full (closed) payload for a recorded terminal ticket', () => {
    const t = ticket({ status: 'done' });
    const map = new TrackerMap();
    const ref = { provider: 'github' as const, id: '549', url: 'https://x/issues/549' };
    map.record('T1', ref);
    const payload = buildPayload(t, { bodyMode: 'minimal' });

    const plan = computePlan({ tickets: [t], map, bodyMode: 'minimal' });

    expect(payload.state).toBe('closed');
    expect(plan.intents).toEqual([{ kind: 'close', ticketId: 'T1', ref, payload }]);
  });

  it('folds a pending (reconcile) entry into an update intent carrying its ref', () => {
    const t = ticket({ status: 'in_progress' });
    const map = new TrackerMap();
    const ref = { provider: 'github' as const, id: '549', url: 'https://x/issues/549' };
    map.markPending('T1', ref);

    const plan = computePlan({ tickets: [t], map, bodyMode: 'minimal' });

    expect(plan.intents).toEqual([
      { kind: 'update', ticketId: 'T1', ref, payload: buildPayload(t, { bodyMode: 'minimal' }) },
    ]);
  });

  function intentFor(tickets: TicketInput[], ticketId: string) {
    const plan = computePlan({ tickets, map: new TrackerMap(), bodyMode: 'minimal' });
    return plan.intents.find(intent => intent.ticketId === ticketId);
  }

  it('carries a parent edge naming the parent ticket id', () => {
    const parent = ticket({ id: 'P1', slug: 'parent' });
    const child = ticket({ id: 'C1', parent: 'P1' });
    expect(intentFor([parent, child], 'C1')?.graph).toEqual({ parentTicketId: 'P1' });
  });

  it('carries blocked-by edges as an unordered set of ticket ids', () => {
    const a = ticket({ id: 'A1' });
    const b = ticket({ id: 'B1' });
    const t = ticket({ id: 'T1', dependsOn: ['A1', 'B1'] });
    const graph = intentFor([a, b, t], 'T1')?.graph;
    expect(graph?.blockedByTicketIds).toHaveLength(2);
    expect(new Set(graph?.blockedByTicketIds)).toEqual(new Set(['A1', 'B1']));
    expect(graph?.parentTicketId).toBeUndefined();
  });

  it('carries both a parent and a blocked-by edge', () => {
    const p = ticket({ id: 'P1' });
    const b = ticket({ id: 'B1' });
    const t = ticket({ id: 'T1', parent: 'P1', blockedOn: ['B1'] });
    expect(intentFor([p, b, t], 'T1')?.graph).toEqual({
      parentTicketId: 'P1',
      blockedByTicketIds: ['B1'],
    });
  });

  it('drops only the unresolvable edge, keeping resolvable ones', () => {
    const p = ticket({ id: 'P1' });
    const t = ticket({ id: 'T1', parent: 'P1', blockedOn: ['GHOST'] });
    // GHOST is not in the corpus → dropped; the resolvable parent edge remains.
    expect(intentFor([p, t], 'T1')?.graph).toEqual({ parentTicketId: 'P1' });
  });

  it('emits a create intent with a closed payload for a terminal never-synced ticket', () => {
    const t = ticket({ status: 'done' }); // terminal, absent from the map
    const plan = computePlan({ tickets: [t], map: new TrackerMap(), bodyMode: 'minimal' });
    const intent = plan.intents[0];
    expect(intent?.kind).toBe('create');
    expect(intent?.payload.state).toBe('closed');
  });

  it('prefers the parent over the epic for the parent edge', () => {
    const parent = ticket({ id: 'P1' });
    const epic = ticket({ id: 'E1' });
    const t = ticket({ id: 'T1', parent: 'P1', epic: 'E1' });
    expect(intentFor([parent, epic, t], 'T1')?.graph).toEqual({ parentTicketId: 'P1' });
  });
});
