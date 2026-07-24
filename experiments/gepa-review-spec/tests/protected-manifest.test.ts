import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadFixtures } from '../src/dataset';
import type { FixtureScore } from '../src/evaluator';
import { loadProtectedSet, protectedMisses, seedKey } from '../src/protected';
import { defectFamily, type ExpectedDefect } from '../src/types';

// Real collaborators: the SHIPPED manifest + the real corpus, not injected Maps.
// This is the only test that proves the floor works against the file GEPA loads.
const MANIFEST = join(import.meta.dirname, '..', 'baseline-protected.json');
const raw = readFileSync(MANIFEST, 'utf8');
const protectedSet = loadProtectedSet(() => raw);
const fixtures = loadFixtures();

/** A FixtureScore whose only content is one missed seed (for floor assertions). */
function missOf(name: string, e: ExpectedDefect): FixtureScore {
  return {
    name,
    certifiedClean: true,
    truePositives: [],
    caughtSeeds: [],
    falseNegatives: [e],
    falseAlarms: [],
    unlabeled: [],
    recall: 0,
  };
}

function fixture(name: string): (typeof fixtures)[number] {
  const fx = fixtures.find(f => f.name === name);
  if (fx === undefined) throw new Error(`fixture ${name} not in corpus`);
  return fx;
}

describe('baseline-protected.json — real-manifest wiring + staleness guards', () => {
  it('loads the shipped manifest (non-null — the floor is actually active)', () => {
    expect(protectedSet).not.toBeNull();
  });

  it('determinism-order is UNPROTECTED — a systematic miss does not breach the floor', () => {
    const fx = fixture('resolver-determinism-order');
    const seed = fx.expected.find(e => e.defectType === 'determinism-order');
    if (seed === undefined) throw new Error('resolver-determinism-order has no det-order seed');
    expect(protectedMisses(missOf(fx.name, seed), protectedSet)).toHaveLength(0);
  });

  it('the two-defect held-out fixture protects BOTH seeds (the anti-gaming guard)', () => {
    const fx = fixture('pmgrade-two-defects');
    expect(fx.expected).toHaveLength(2);
    // Missing EITHER seeded must-fix breaches — this is what defeats the
    // "be skeptical of a second defect" gaming vector on the held-out split.
    for (const seed of fx.expected) {
      expect(protectedMisses(missOf(fx.name, seed), protectedSet)).toHaveLength(1);
    }
  });

  it('every manifest key resolves to a live corpus seed (catches a stale key after a rename)', () => {
    const live = new Set<string>();
    for (const f of fixtures) for (const e of f.expected) live.add(`${f.name}::${seedKey(e)}`);
    const manifest = (JSON.parse(raw) as { protected: Record<string, string[]> }).protected;
    const dead: string[] = [];
    for (const [name, keys] of Object.entries(manifest)) {
      for (const k of keys) if (!live.has(`${name}::${k}`)) dead.push(`${name}::${k}`);
    }
    expect(dead).toEqual([]);
  });

  it('no fixture seeds two subtypes of one family (keeps family-key protection unambiguous)', () => {
    const clashes: string[] = [];
    for (const f of fixtures) {
      const counts = new Map<string, number>();
      for (const e of f.expected) {
        const k = `${e.scenarioId ?? '*'}::${defectFamily(e.defectType)}`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      for (const [k, n] of counts) if (n > 1) clashes.push(`${f.name} ${k}`);
    }
    expect(clashes).toEqual([]);
  });
});
