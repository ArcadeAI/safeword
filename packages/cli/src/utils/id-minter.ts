/**
 * Crockford Base32 ticket ID minter (ticket 158).
 *
 * Mints uppercase 6-char IDs from the Crockford alphabet
 * `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (no I/L/O/U). 32^6 ≈ 10⁹ ID space.
 *
 * Two implementations:
 *  - cryptoIdMinter() — production default, uses crypto.randomInt
 *  - seededIdMinter(seed) — deterministic, for tests that need reproducibility
 */

import { randomInt } from 'node:crypto';

export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ID_LENGTH = 6;

export interface IdMinter {
  mint(): string;
}

export function cryptoIdMinter(): IdMinter {
  return {
    mint(): string {
      const chars: string[] = [];
      for (let index = 0; index < ID_LENGTH; index++) {
        chars.push(CROCKFORD_ALPHABET.charAt(randomInt(CROCKFORD_ALPHABET.length)));
      }
      return chars.join('');
    },
  };
}

/**
 * Seeded PRNG (mulberry32) for deterministic test sequences.
 * Not cryptographically secure — production must use cryptoIdMinter.
 */
export function seededIdMinter(seed: number): IdMinter {
  let state = seed >>> 0;
  function nextUint32(): number {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }
  return {
    mint(): string {
      const chars: string[] = [];
      for (let index = 0; index < ID_LENGTH; index++) {
        chars.push(CROCKFORD_ALPHABET.charAt(nextUint32() % CROCKFORD_ALPHABET.length));
      }
      return chars.join('');
    },
  };
}
