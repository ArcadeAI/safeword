/**
 * applyResults + parseResults — folding an executor's SyncResults back into the
 * tracker-map (CBTDK8). Pure over the map + a corpus id set; proves idempotent
 * recording, the update/close ack no-op, and malformed rejection (incl. the
 * internal-id url-tail guard) without a live tracker (#363).
 */

import { describe, expect, it } from 'vitest';

import { applyResults } from '../../src/tracker-sync/apply-results.js';
import { parseResults, PLAN_CONTRACT_VERSION } from '../../src/tracker-sync/contract.js';
import { computePlan } from '../../src/tracker-sync/plan.js';
import { TrackerMap } from '../../src/tracker-sync/tracker-map.js';
import type { TicketInput } from '../../src/tracker-sync/types.js';

const CTX = { provider: 'github' as const, ticketIds: new Set(['T1']) };

function results(...rows: { ticketId: string; number: string; url: string }[]) {
  return { version: PLAN_CONTRACT_VERSION, results: rows };
}

describe('applyResults (portable-tracker-transport.TB1.AC2 / SM1.AC1)', () => {
  it('records a create result with the bare number and url as recorded', () => {
    const map = new TrackerMap();
    const outcome = applyResults(
      map,
      results({ ticketId: 'T1', number: '549', url: 'https://github.com/o/r/issues/549' }),
      CTX,
    );

    expect(outcome).toEqual({ ok: true });
    expect(map.lookup('T1')).toEqual({
      ref: { provider: 'github', id: '549', url: 'https://github.com/o/r/issues/549' },
      status: 'recorded',
    });
  });

  it('is idempotent — re-applying the same results changes nothing', () => {
    const map = new TrackerMap();
    const r = results({ ticketId: 'T1', number: '549', url: 'https://github.com/o/r/issues/549' });
    applyResults(map, r, CTX);
    const before = JSON.stringify(map.serialize());
    applyResults(map, r, CTX);
    expect(JSON.stringify(map.serialize())).toBe(before);
  });

  it('leaves an already-recorded ref unchanged for an update/close ack', () => {
    const map = new TrackerMap();
    const ref = {
      provider: 'github' as const,
      id: '549',
      url: 'https://github.com/o/r/issues/549',
    };
    map.record('T1', ref);
    const before = JSON.stringify(map.serialize());

    const outcome = applyResults(
      map,
      results({ ticketId: 'T1', number: '549', url: 'https://github.com/o/r/issues/549' }),
      CTX,
    );

    expect(outcome).toEqual({ ok: true });
    expect(JSON.stringify(map.serialize())).toBe(before);
  });

  it('rejects a result whose url tail does not match its number, leaving the map untouched', () => {
    const map = new TrackerMap();
    const outcome = applyResults(
      map,
      // The internal database id (4764539863) in `number`, url points at issue 549.
      results({ ticketId: 'T1', number: '4764539863', url: 'https://github.com/o/r/issues/549' }),
      CTX,
    );

    expect(outcome.ok).toBe(false);
    expect(map.lookup('T1')).toBeUndefined();
  });

  it('rejects a result naming a ticket absent from the corpus, leaving the map untouched', () => {
    const map = new TrackerMap();
    const outcome = applyResults(
      map,
      results({ ticketId: 'GHOST', number: '549', url: 'https://github.com/o/r/issues/549' }),
      CTX,
    );

    expect(outcome.ok).toBe(false);
    expect(map.lookup('GHOST')).toBeUndefined();
  });

  it('validates all rows before mutating: a valid row is NOT recorded when a later row is rejected', () => {
    const map = new TrackerMap();
    const outcome = applyResults(
      map,
      results(
        { ticketId: 'T1', number: '549', url: 'https://github.com/o/r/issues/549' },
        { ticketId: 'GHOST', number: '550', url: 'https://github.com/o/r/issues/550' },
      ),
      CTX,
    );

    expect(outcome.ok).toBe(false);
    // The valid T1 row must NOT have been recorded — the map is left untouched.
    expect(map.lookup('T1')).toBeUndefined();
  });

  it('accepts a github url carrying a query string (tail still matches number)', () => {
    const map = new TrackerMap();
    const outcome = applyResults(
      map,
      results({ ticketId: 'T1', number: '549', url: 'https://github.com/o/r/issues/549?utm=x' }),
      CTX,
    );

    expect(outcome).toEqual({ ok: true });
    expect(map.lookup('T1')?.ref.id).toBe('549');
  });

  // Separate from the query-string case: with only that one, dropping `#` from the
  // urlTail split would leave the suite green.
  it('accepts a github url carrying a fragment (tail still matches number)', () => {
    const map = new TrackerMap();
    const outcome = applyResults(
      map,
      results({
        ticketId: 'T1',
        number: '549',
        url: 'https://github.com/o/r/issues/549#issuecomment-1',
      }),
      CTX,
    );

    expect(outcome).toEqual({ ok: true });
    expect(map.lookup('T1')?.ref.id).toBe('549');
  });

  // The provider-neutral floor: non-github providers skip the url-tail/numeric guard,
  // but must still reject a blank number or a non-http url — without the floor a
  // linear row like { number: ' ', url: 'banana' } was recorded verbatim.
  it('rejects a blank issue number for a non-github provider, leaving the map untouched', () => {
    const map = new TrackerMap();
    const linear = { provider: 'linear' as const, ticketIds: new Set(['T1']) };
    const outcome = applyResults(
      map,
      results({ ticketId: 'T1', number: ' ', url: 'https://linear.app/acme/issue/ENG-45' }),
      linear,
    );

    expect(outcome.ok).toBe(false);
    expect(map.lookup('T1')).toBeUndefined();
  });

  it('rejects a non-http url for a non-github provider, leaving the map untouched', () => {
    const map = new TrackerMap();
    const linear = { provider: 'linear' as const, ticketIds: new Set(['T1']) };
    const outcome = applyResults(
      map,
      results({ ticketId: 'T1', number: 'ENG-45', url: 'banana' }),
      linear,
    );

    expect(outcome.ok).toBe(false);
    expect(map.lookup('T1')).toBeUndefined();
  });

  it('records a well-formed non-github result (the floor accepts a slug id)', () => {
    const map = new TrackerMap();
    const linear = { provider: 'linear' as const, ticketIds: new Set(['T1']) };
    const outcome = applyResults(
      map,
      results({ ticketId: 'T1', number: 'ENG-45', url: 'https://linear.app/acme/issue/ENG-45' }),
      linear,
    );

    expect(outcome).toEqual({ ok: true });
    expect(map.lookup('T1')).toEqual({
      ref: { provider: 'linear', id: 'ENG-45', url: 'https://linear.app/acme/issue/ENG-45' },
      status: 'recorded',
    });
  });

  it('rejects a github result whose number is not purely numeric, leaving the map untouched', () => {
    const map = new TrackerMap();
    const outcome = applyResults(
      map,
      results({ ticketId: 'T1', number: '549x', url: 'https://github.com/o/r/issues/549x' }),
      CTX,
    );

    expect(outcome.ok).toBe(false);
    expect(map.lookup('T1')).toBeUndefined();
  });
});

describe('parseResults (portable-tracker-transport.SM1.AC1)', () => {
  const good = JSON.stringify({
    version: PLAN_CONTRACT_VERSION,
    results: [{ ticketId: 'T1', number: '549', url: 'https://github.com/o/r/issues/549' }],
  });

  it('parses a well-formed results document', () => {
    const parsed = parseResults(good);
    expect(parsed.ok).toBe(true);
  });

  it('rejects invalid JSON', () => {
    expect(parseResults('{ not json').ok).toBe(false);
  });

  it('rejects an unsupported contract version', () => {
    const bad = JSON.stringify({ version: 999, results: [] });
    expect(parseResults(bad).ok).toBe(false);
  });

  it('rejects a create result missing its number', () => {
    const bad = JSON.stringify({
      version: PLAN_CONTRACT_VERSION,
      results: [{ ticketId: 'T1', url: 'https://github.com/o/r/issues/549' }],
    });
    expect(parseResults(bad).ok).toBe(false);
  });

  it('rejects a create result missing its url', () => {
    const bad = JSON.stringify({
      version: PLAN_CONTRACT_VERSION,
      results: [{ ticketId: 'T1', number: '549' }],
    });
    expect(parseResults(bad).ok).toBe(false);
  });
});

describe('plan → results → map round-trip (portable-tracker-transport.SM1.AC1)', () => {
  it('a planned create, executed and applied, records the ticket in the map', () => {
    const ticket: TicketInput = {
      id: 'T1',
      title: 'Login bug',
      status: 'in_progress',
      type: 'task',
      epic: undefined,
      ticketUrl: 'https://github.com/o/r/tree/main/.project/tickets/T1-login',
    };
    const map = new TrackerMap();

    // Plan a create for a never-synced ticket.
    const plan = computePlan({ tickets: [ticket], map, bodyMode: 'minimal' });
    expect(plan.intents[0]?.kind).toBe('create');

    // The executor creates the issue and reports the result; apply folds it back.
    const raw = JSON.stringify({
      version: PLAN_CONTRACT_VERSION,
      results: [
        {
          ticketId: 'T1',
          number: '549',
          url: 'https://github.com/o/r/issues/549',
          status: 'created',
        },
      ],
    });
    const parsed = parseResults(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const outcome = applyResults(map, parsed.value, {
      provider: 'github',
      ticketIds: new Set(['T1']),
    });

    expect(outcome).toEqual({ ok: true });
    expect(map.lookup('T1')).toEqual({
      ref: { provider: 'github', id: '549', url: 'https://github.com/o/r/issues/549' },
      status: 'recorded',
    });
  });
});
