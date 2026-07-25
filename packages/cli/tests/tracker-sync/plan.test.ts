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
});
