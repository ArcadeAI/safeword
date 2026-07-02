import { describe, expect, it } from 'vitest';

import {
  emptyLedger,
  LEDGER_MARKER,
  type LedgerState,
  parseLedger,
  recordEncounter,
  renderLedger,
} from './ledger.js';

describe('ledger render/parse round-trip', () => {
  it('renders with the hidden marker and round-trips state', () => {
    const state: LedgerState = {
      total: 3,
      harness: { claude: 2, cursor: 1 },
      sessions: ['sess-a', 'sess-b'],
      manifestations: ['m1', 'm2'],
    };
    const body = renderLedger(state);
    expect(body).toContain(LEDGER_MARKER);
    expect(parseLedger(body)).toEqual(state);
  });

  it('parses a body without a ledger marker as the empty ledger', () => {
    expect(parseLedger('just a normal issue comment')).toEqual(emptyLedger());
  });

  // C3 (review): an attacker who can comment on the upstream issue must not be
  // able to poison the ledger into wrong types that crash recordEncounter.
  it('coerces malicious wrong-typed ledger data to safe defaults', () => {
    const poisoned = `${LEDGER_MARKER}\n<!-- retro-data: {"total":"x","manifestations":99,"sessions":"oops","harness":[1,2]} -->`;
    const state = parseLedger(poisoned);
    expect(Array.isArray(state.manifestations)).toBe(true);
    expect(Array.isArray(state.sessions)).toBe(true);
    expect(state.manifestations).toEqual([]);
    expect(state.sessions).toEqual([]);
    // recordEncounter must not throw on the coerced state
    expect(() =>
      recordEncounter(state, { sessionId: 's', harness: 'claude', manifestation: 'm' }),
    ).not.toThrow();
  });

  it('drops non-string array members', () => {
    const poisoned = `${LEDGER_MARKER}\n<!-- retro-data: {"sessions":["ok",5,null],"manifestations":["m",{}]} -->`;
    const state = parseLedger(poisoned);
    expect(state.sessions).toEqual(['ok']);
    expect(state.manifestations).toEqual(['m']);
  });
});

describe('recordEncounter (idempotency + novelty)', () => {
  const base: LedgerState = {
    total: 1,
    harness: { claude: 1 },
    sessions: ['sess-a'],
    manifestations: ['m1'],
  };

  it('bumps once for a new session', () => {
    const next = recordEncounter(base, {
      sessionId: 'sess-b',
      harness: 'claude',
      manifestation: 'm1',
    });
    expect(next.changed).toBe(true);
    expect(next.state.total).toBe(2);
    expect(next.state.sessions).toContain('sess-b');
    expect(next.state.harness.claude).toBe(2);
  });

  it('does not double-count a session already recorded', () => {
    const next = recordEncounter(base, {
      sessionId: 'sess-a',
      harness: 'claude',
      manifestation: 'm1',
    });
    expect(next.changed).toBe(false);
    expect(next.state).toEqual(base);
  });

  it('flags a novel manifestation and records it', () => {
    const next = recordEncounter(base, {
      sessionId: 'sess-b',
      harness: 'claude',
      manifestation: 'm-new',
    });
    expect(next.novel).toBe(true);
    expect(next.state.manifestations).toContain('m-new');
  });

  it('does not flag a manifestation already documented', () => {
    const next = recordEncounter(base, {
      sessionId: 'sess-b',
      harness: 'claude',
      manifestation: 'm1',
    });
    expect(next.novel).toBe(false);
  });
});
