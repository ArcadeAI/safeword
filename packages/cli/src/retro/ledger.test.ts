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

describe('recordEncounter provenance (G19QG7)', () => {
  // Back-compat contract: the live fleet of upstream ledgers predates
  // provenance; a bump must never corrupt their counts and must record the
  // new encounter's code state.
  it('bumping a pre-provenance ledger preserves counts and gains provenance', () => {
    const preProvenance = `${LEDGER_MARKER}\n<!-- retro-data: {"total":2,"harness":{"claude":2},"sessions":["s1","s2"],"manifestations":["m1"]} -->`;
    const state = parseLedger(preProvenance);

    const next = recordEncounter(state, {
      sessionId: 's3',
      harness: 'claude',
      manifestation: 'm1',
      provenance: { sha: 'abc1234', at: '2026-07-07T00:00:00.000Z' },
    });

    expect(next.state.total).toBe(3);
    expect(next.state.sessions).toEqual(['s1', 's2', 's3']);
    expect(next.state.harness.claude).toBe(3);
    expect(next.state.provenance).toEqual({
      dogfood: { sha: 'abc1234', at: '2026-07-07T00:00:00.000Z' },
    });
  });
});

describe('recordEncounter provenance — newest wins across the bump cycle', () => {
  // A real bump goes render -> parse -> record -> render; provenance must
  // survive the round-trip and the newest encounter must replace the old.
  it('surfaces the newest encounter provenance through a render/parse bump', () => {
    const older = recordEncounter(emptyLedger(), {
      sessionId: 's1',
      harness: 'claude',
      manifestation: 'm1',
      provenance: { version: '0.66.0', at: '2026-07-01T00:00:00.000Z' },
    });

    const reparsed = parseLedger(renderLedger(older.state));
    expect(reparsed.provenance).toEqual({
      install: { version: '0.66.0', at: '2026-07-01T00:00:00.000Z' },
    });

    const next = recordEncounter(reparsed, {
      sessionId: 's2',
      harness: 'claude',
      manifestation: 'm1',
      provenance: { sha: 'abc1234', at: '2026-07-07T00:00:00.000Z' },
    });
    expect(next.state.provenance).toEqual({
      install: { version: '0.66.0', at: '2026-07-01T00:00:00.000Z' },
      dogfood: { sha: 'abc1234', at: '2026-07-07T00:00:00.000Z' },
    });
  });
});

describe('provenance coercion under attacker-shaped input', () => {
  // The ledger comment is publicly editable; provenance strings must re-enter a
  // rendered public comment only as bounded token shapes — never as free text.
  it('drops non-token-shaped provenance fields instead of echoing them', () => {
    const crafted = 'sk-live [click here](https://evil.example) <script>';
    const poisoned = `${LEDGER_MARKER}\n<!-- retro-data: {"total":1,"harness":{"claude":1},"sessions":["s1"],"manifestations":["m1"],"provenance":{"dogfood":{"sha":"${crafted}","at":"not-a-timestamp"},"install":{"version":"${'v'.repeat(200)}","at":"not-a-timestamp"}}} -->`;

    const state = parseLedger(poisoned);
    expect(state.provenance).toBeUndefined();

    const rendered = renderLedger(
      recordEncounter(state, { sessionId: 's2', harness: 'claude', manifestation: 'm1' }).state,
    );
    expect(rendered).not.toContain('evil.example');
    expect(rendered).not.toContain('<script>');
  });

  it('keeps valid token-shaped fields while dropping invalid siblings', () => {
    const poisoned = `${LEDGER_MARKER}\n<!-- retro-data: {"total":1,"harness":{"claude":1},"sessions":["s1"],"manifestations":["m1"],"provenance":{"dogfood":{"sha":"abc1234","at":"2026-07-07T00:00:00.000Z"},"install":{"version":"../../etc/passwd","at":"2026-07-07T00:00:00.000Z"}}} -->`;

    const state = parseLedger(poisoned);
    expect(state.provenance).toEqual({
      dogfood: { sha: 'abc1234', at: '2026-07-07T00:00:00.000Z' },
    });
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
