import { describe, expect, it } from 'vitest';

import type { FixtureScore } from '../src/evaluator';
import {
  computeProtectedSet,
  loadProtectedSet,
  protectedMisses,
  seedKey,
  serializeProtectedSet,
} from '../src/protected';
import type { ExpectedDefect } from '../src/types';

function scoreWithMisses(name: string, falseNegatives: ExpectedDefect[]): FixtureScore {
  return {
    name,
    certifiedClean: true,
    truePositives: [],
    caughtSeeds: [],
    falseNegatives,
    falseAlarms: [],
    unlabeled: [],
    recall: 0,
  };
}

describe('relative recall floor — protectedMisses', () => {
  it('null protectedSet is strict: every miss breaches the floor', () => {
    const s = scoreWithMisses('fx', [
      { scenarioId: 'A', defectType: 'vacuous-non-claim', severity: 'must-fix' },
    ]);
    expect(protectedMisses(s, null)).toHaveLength(1);
  });

  it('a PROTECTED miss breaches; an UNPROTECTED miss does not', () => {
    const protectedSet = new Map([['fx', new Set(['A::vacuous'])]]);
    const s = scoreWithMisses('fx', [
      { scenarioId: 'A', defectType: 'vacuous-non-claim', severity: 'must-fix' }, // protected → breaches
      { scenarioId: 'B', defectType: 'determinism-order', severity: 'must-fix' }, // unprotected → does not
    ]);
    const misses = protectedMisses(s, protectedSet);
    expect(misses).toHaveLength(1);
    expect(misses[0]?.scenarioId).toBe('A');
  });

  it('an unknown fixture (absent from the manifest) stays strict', () => {
    const protectedSet = new Map([['other', new Set<string>()]]);
    const s = scoreWithMisses('fx', [
      { scenarioId: 'A', defectType: 'vacuous-non-claim', severity: 'must-fix' },
    ]);
    expect(protectedMisses(s, protectedSet)).toHaveLength(1);
  });
});

describe('computeProtectedSet — majority vote with margin', () => {
  it('protects only seeds caught in at least ceil(2k/3) runs', () => {
    // 3 runs → threshold ceil(6/3)=2. A caught 3/3, B caught 1/3.
    const p = computeProtectedSet([
      [{ name: 'fx', caughtKeys: ['A::vacuous', 'B::vacuous'] }],
      [{ name: 'fx', caughtKeys: ['A::vacuous'] }],
      [{ name: 'fx', caughtKeys: ['A::vacuous'] }],
    ]);
    expect(p.get('fx')?.has('A::vacuous')).toBe(true);
    expect(p.get('fx')?.has('B::vacuous')).toBe(false);
  });
});

describe('manifest round-trip', () => {
  it('serialize then load reproduces the set', () => {
    const manifest = serializeProtectedSet(new Map([['fx', new Set(['A::vacuous'])]]));
    const loaded = loadProtectedSet(() => JSON.stringify(manifest));
    expect(loaded?.get('fx')?.has('A::vacuous')).toBe(true);
  });

  it('returns null when the manifest is absent', () => {
    expect(loadProtectedSet(() => null)).toBeNull();
  });
});

describe('seedKey', () => {
  it('keys by scenario + defect family; fixture-scope uses *', () => {
    expect(seedKey({ scenarioId: 'A', defectType: 'vacuous-non-claim' })).toBe('A::vacuous');
    expect(seedKey({ defectType: 'determinism-order' })).toBe('*::determinism');
  });
});
