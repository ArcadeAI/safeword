import { describe, expect, it } from 'vitest';

import {
  consensusFloorBreaches,
  type BaselineRunCatches,
  type ProtectedSet,
} from '../src/protected';

/** One protected fixture with two seeds of distinct families. */
const MANIFEST: ProtectedSet = new Map([['fx', new Set(['S1::vacuous', 'S2::determinism'])]]);

/** Build N runs from a per-run list of caught keys for the single fixture `fx`. */
function runs(...perRun: string[][]): BaselineRunCatches[][] {
  return perRun.map(caughtKeys => [{ name: 'fx', caughtKeys }]);
}

describe('consensusFloorBreaches — multi-run accept gate floor', () => {
  it('a protected seed caught in ≥⌈2N/3⌉ runs is NOT a breach (N=3, caught 2/3)', () => {
    // S1 missed in run 3 only → caught 2/3 = the ⌈2*3/3⌉=2 threshold.
    const r = runs(
      ['S1::vacuous', 'S2::determinism'],
      ['S1::vacuous', 'S2::determinism'],
      ['S2::determinism'],
    );
    expect(consensusFloorBreaches(r, MANIFEST, ['fx'])).toHaveLength(0);
  });

  it('a protected seed caught in <⌈2N/3⌉ runs IS a breach (N=3, caught 1/3)', () => {
    const r = runs(['S1::vacuous', 'S2::determinism'], ['S2::determinism'], ['S2::determinism']);
    expect(consensusFloorBreaches(r, MANIFEST, ['fx'])).toEqual([
      { fixture: 'fx', key: 'S1::vacuous', caughtRuns: 1, runs: 3 },
    ]);
  });

  it('two seeds each missed in a DIFFERENT single run are BOTH consensus-caught (no breach)', () => {
    // The multi-seed correctness case: S2 missed run 2, S1 missed run 3 — each 2/3.
    // A per-FIXTURE breach count would wrongly flag this fixture as 2/3-breached;
    // per-SEED keys correctly clear it.
    const r = runs(['S1::vacuous', 'S2::determinism'], ['S1::vacuous'], ['S2::determinism']);
    expect(consensusFloorBreaches(r, MANIFEST, ['fx'])).toHaveLength(0);
  });

  it('reports each consensus-missed protected seed once, with its catch count', () => {
    // Both seeds caught only 1/3 → both breach.
    const r = runs(['S1::vacuous', 'S2::determinism'], [], []);
    const b = consensusFloorBreaches(r, MANIFEST, ['fx']).map(
      x => `${x.key}:${x.caughtRuns}/${x.runs}`,
    );
    expect(b.sort()).toEqual(['S1::vacuous:1/3', 'S2::determinism:1/3']);
  });

  it('only manifest-protected keys gate — an unprotected systematic miss never breaches', () => {
    // Candidate never catches a determinism-order key, but it is NOT in the manifest.
    const manifest: ProtectedSet = new Map([['fx', new Set(['S1::vacuous'])]]);
    const r = runs(['S1::vacuous', 'X::determinism-order'], ['S1::vacuous'], ['S1::vacuous']);
    expect(consensusFloorBreaches(r, manifest, ['fx'])).toHaveLength(0);
  });

  it('a fixture absent from the candidate runs breaches every protected seed (nothing caught)', () => {
    // Guards the silent-undercount worry: if a fixture never scored, its protected
    // seeds are caught 0 times → breach, never a false pass.
    expect(consensusFloorBreaches(runs([], [], []), MANIFEST, ['fx'])).toHaveLength(2);
  });

  it('the N=5 threshold is ⌈2*5/3⌉=4 — caught 3/5 breaches, 4/5 holds', () => {
    const caught3 = runs(['S1::vacuous'], ['S1::vacuous'], ['S1::vacuous'], [], []);
    const caught4 = runs(['S1::vacuous'], ['S1::vacuous'], ['S1::vacuous'], ['S1::vacuous'], []);
    const only = new Map([['fx', new Set(['S1::vacuous'])]]);
    expect(consensusFloorBreaches(caught3, only, ['fx'])).toHaveLength(1);
    expect(consensusFloorBreaches(caught4, only, ['fx'])).toHaveLength(0);
  });
});
