/**
 * Test Suite: update-cache release-age gate
 *
 * Pure-function helper extracted from session-auto-upgrade.ts during PR #81's
 * second refactor pass. Pins the supply-chain cooldown behavior so future
 * changes can't silently weaken the 24h window.
 */

import { describe, expect, it } from 'vitest';

import {
  clearUpgradeFailures,
  MAX_UPGRADE_ATTEMPTS,
  recordUpgradeFailure,
  RELEASE_AGE_COOLDOWN_MS,
  releaseAgeStatus,
  shouldAttemptUpgrade,
  type UpdateCache,
} from '../../templates/hooks/lib/update-cache.js';

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

describe('auto-upgrade strike counter', () => {
  it('exports a cap of 3 attempts', () => {
    expect(MAX_UPGRADE_ATTEMPTS).toBe(3);
  });

  describe('shouldAttemptUpgrade()', () => {
    it('attempts when there is no failure history', () => {
      expect(shouldAttemptUpgrade({}, '1.2.3')).toBe(true);
    });

    it('attempts while below the cap for the same version', () => {
      const cache: UpdateCache = { failedVersion: '1.2.3', failedAttempts: 2 };
      expect(shouldAttemptUpgrade(cache, '1.2.3')).toBe(true);
    });

    it('gives up at the cap for the same version', () => {
      const cache: UpdateCache = { failedVersion: '1.2.3', failedAttempts: 3 };
      expect(shouldAttemptUpgrade(cache, '1.2.3')).toBe(false);
    });

    it('attempts a newer version even when the prior one is capped', () => {
      const cache: UpdateCache = { failedVersion: '1.2.3', failedAttempts: 3 };
      expect(shouldAttemptUpgrade(cache, '1.3.0')).toBe(true);
    });

    it('honors a custom max', () => {
      const cache: UpdateCache = { failedVersion: '1.2.3', failedAttempts: 1 };
      expect(shouldAttemptUpgrade(cache, '1.2.3', 1)).toBe(false);
    });
  });

  describe('recordUpgradeFailure()', () => {
    it('starts the counter at 1 on first failure', () => {
      const result = recordUpgradeFailure({}, '1.2.3');
      expect(result.cache).toMatchObject({ failedVersion: '1.2.3', failedAttempts: 1 });
      expect(result.attempts).toBe(1);
      expect(result.reachedCap).toBe(false);
    });

    it('increments for repeated failures on the same version', () => {
      const cache: UpdateCache = { failedVersion: '1.2.3', failedAttempts: 1 };
      const result = recordUpgradeFailure(cache, '1.2.3');
      expect(result.attempts).toBe(2);
      expect(result.reachedCap).toBe(false);
    });

    it('flags reachedCap exactly when the count hits the cap', () => {
      const cache: UpdateCache = { failedVersion: '1.2.3', failedAttempts: 2 };
      const result = recordUpgradeFailure(cache, '1.2.3');
      expect(result.attempts).toBe(3);
      expect(result.reachedCap).toBe(true);
    });

    it('resets to 1 when the target version changed', () => {
      const cache: UpdateCache = { failedVersion: '1.2.3', failedAttempts: 2 };
      const result = recordUpgradeFailure(cache, '1.3.0');
      expect(result.cache).toMatchObject({ failedVersion: '1.3.0', failedAttempts: 1 });
      expect(result.attempts).toBe(1);
    });

    it('preserves unrelated cache fields', () => {
      const cache: UpdateCache = { latestVersion: '1.2.3', publishedAt: 123, checkedAt: 456 };
      const result = recordUpgradeFailure(cache, '1.2.3');
      expect(result.cache).toMatchObject({
        latestVersion: '1.2.3',
        publishedAt: 123,
        checkedAt: 456,
      });
    });
  });

  describe('clearUpgradeFailures()', () => {
    it('removes failure fields, keeping the rest', () => {
      const cache: UpdateCache = {
        latestVersion: '1.2.3',
        publishedAt: 123,
        failedVersion: '1.2.3',
        failedAttempts: 3,
      };
      expect(clearUpgradeFailures(cache)).toEqual({ latestVersion: '1.2.3', publishedAt: 123 });
    });

    it('is a no-op when there are no failures', () => {
      const cache: UpdateCache = { latestVersion: '1.2.3' };
      expect(clearUpgradeFailures(cache)).toEqual({ latestVersion: '1.2.3' });
    });
  });
});
