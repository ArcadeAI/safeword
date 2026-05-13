/**
 * Test Suite: update-cache release-age gate
 *
 * Pure-function helper extracted from session-auto-upgrade.ts during PR #81's
 * second refactor pass. Pins the supply-chain cooldown behavior so future
 * changes can't silently weaken the 24h window.
 */

import { describe, expect, it } from 'vitest';

import {
  RELEASE_AGE_COOLDOWN_MS,
  releaseAgeStatus,
} from '../../templates/hooks/lib/update-cache.ts';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

describe('releaseAgeStatus()', () => {
  describe('unknown branch (fail-closed)', () => {
    it('returns unknown when publishedAt is undefined', () => {
      expect(releaseAgeStatus(undefined, Date.now())).toEqual({ state: 'unknown' });
    });
  });

  describe('cooling branch', () => {
    it('returns cooling when age < cooldown', () => {
      const now = 1_000_000_000_000;
      const publishedAt = now - HOUR_MS; // 1h old, well under default 24h
      expect(releaseAgeStatus(publishedAt, now)).toEqual({
        state: 'cooling',
        remainingHours: 23,
      });
    });

    it('rounds remainingHours up (always pessimistic)', () => {
      const now = 1_000_000_000_000;
      const publishedAt = now - (DAY_MS - 30 * 60 * 1000); // 30 min remaining
      const result = releaseAgeStatus(publishedAt, now);
      expect(result).toEqual({ state: 'cooling', remainingHours: 1 });
    });

    it('reports remainingHours = 24 when age is 0 (just published)', () => {
      const now = 1_000_000_000_000;
      expect(releaseAgeStatus(now, now)).toEqual({
        state: 'cooling',
        remainingHours: 24,
      });
    });

    it('handles future publishedAt (clock skew) as cooling with > 24h remaining', () => {
      const now = 1_000_000_000_000;
      const publishedAt = now + HOUR_MS; // 1h in the future
      const result = releaseAgeStatus(publishedAt, now);
      expect(result.state).toBe('cooling');
      if (result.state === 'cooling') {
        expect(result.remainingHours).toBe(25);
      }
    });
  });

  describe('ready branch', () => {
    it('returns ready when age == cooldown (boundary inclusive)', () => {
      const now = 1_000_000_000_000;
      const publishedAt = now - DAY_MS;
      expect(releaseAgeStatus(publishedAt, now)).toEqual({ state: 'ready' });
    });

    it('returns ready when age > cooldown', () => {
      const now = 1_000_000_000_000;
      const publishedAt = now - 2 * DAY_MS;
      expect(releaseAgeStatus(publishedAt, now)).toEqual({ state: 'ready' });
    });
  });

  describe('custom cooldown', () => {
    it('respects an overridden cooldown window', () => {
      const now = 1_000_000_000_000;
      const publishedAt = now - HOUR_MS;
      // 30-minute cooldown — 1h age is well past it
      expect(releaseAgeStatus(publishedAt, now, 30 * 60 * 1000)).toEqual({ state: 'ready' });
    });
  });

  it('exports the documented default cooldown of 24 hours', () => {
    expect(RELEASE_AGE_COOLDOWN_MS).toBe(DAY_MS);
  });
});
