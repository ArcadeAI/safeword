/**
 * Unit tests for the Crockford Base32 ID minter (ticket 158, slice 1).
 *
 * IDs are 6 characters, uppercase, drawn from the Crockford Base32 alphabet
 * (no I/L/O/U). The `cryptoIdMinter()` is the production default; tests use
 * `seededIdMinter()` to get a deterministic sequence without flakes.
 */

import { describe, expect, it } from 'vitest';

import { CROCKFORD_ALPHABET, cryptoIdMinter, seededIdMinter } from './id-minter.js';

describe('cryptoIdMinter', () => {
  it('produces IDs that are exactly 6 characters', () => {
    const minter = cryptoIdMinter();
    for (let index = 0; index < 50; index++) {
      expect(minter.mint()).toHaveLength(6);
    }
  });

  it('produces IDs whose every character is in the Crockford alphabet', () => {
    const minter = cryptoIdMinter();
    const alphabet = new Set(CROCKFORD_ALPHABET);
    for (let index = 0; index < 200; index++) {
      for (const char of minter.mint()) {
        expect(alphabet.has(char)).toBe(true);
      }
    }
  });

  it('never produces an ID containing the forbidden letters I, L, O, or U', () => {
    const minter = cryptoIdMinter();
    for (let index = 0; index < 500; index++) {
      expect(minter.mint()).not.toMatch(/[ILOU]/);
    }
  });

  it('produces uppercase IDs only', () => {
    const minter = cryptoIdMinter();
    for (let index = 0; index < 100; index++) {
      const id = minter.mint();
      expect(id).toBe(id.toUpperCase());
    }
  });
});

describe('seededIdMinter (deterministic)', () => {
  it('produces 1000 distinct IDs from a deterministic seed (RNG non-degenerate)', () => {
    const minter = seededIdMinter(42);
    const seen = new Set<string>();
    for (let index = 0; index < 1000; index++) {
      seen.add(minter.mint());
    }
    expect(seen.size).toBe(1000);
  });

  it('produces the same sequence given the same seed (reproducible)', () => {
    const a = seededIdMinter(123);
    const b = seededIdMinter(123);
    const sequenceA = Array.from({ length: 10 }, () => a.mint());
    const sequenceB = Array.from({ length: 10 }, () => b.mint());
    expect(sequenceA).toEqual(sequenceB);
  });
});
