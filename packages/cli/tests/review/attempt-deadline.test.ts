import { afterEach, describe, expect, it } from 'vitest';

import { attemptDeadlineMs, minimumRouteMs, runBoundMs } from '../../src/review/runtime.js';

const original = process.env.SAFEWORD_REVIEW_TIMEOUT_MS;

const originalBound = process.env.SAFEWORD_REVIEW_RUN_BOUND_MS;

afterEach(() => {
  if (original === undefined) delete process.env.SAFEWORD_REVIEW_TIMEOUT_MS;
  else process.env.SAFEWORD_REVIEW_TIMEOUT_MS = original;
  if (originalBound === undefined) delete process.env.SAFEWORD_REVIEW_RUN_BOUND_MS;
  else process.env.SAFEWORD_REVIEW_RUN_BOUND_MS = originalBound;
});

function withConfiguredBound(value: string | undefined): number {
  if (value === undefined) delete process.env.SAFEWORD_REVIEW_RUN_BOUND_MS;
  else process.env.SAFEWORD_REVIEW_RUN_BOUND_MS = value;
  return runBoundMs();
}

function withConfigured(value: string | undefined): number {
  if (value === undefined) delete process.env.SAFEWORD_REVIEW_TIMEOUT_MS;
  else process.env.SAFEWORD_REVIEW_TIMEOUT_MS = value;
  return attemptDeadlineMs();
}

describe('attempt deadline', () => {
  it('gives every attempt the same default, well above the slowest observed review', () => {
    // 91 real runs: 47s median, 75s slowest success. 120s preserves headroom.
    expect(withConfigured(undefined)).toBe(120_000);
  });

  it('honours an explicitly configured deadline', () => {
    expect(withConfigured('120000')).toBe(120_000);
    expect(withConfigured('240000')).toBe(210_000);
  });

  it('never lets a configured deadline exceed the run bound', () => {
    expect(withConfigured('270000')).toBe(210_000);
    expect(withConfigured('600000')).toBe(210_000);
    expect(withConfigured('99999999')).toBe(210_000);
  });

  it.each([
    ['zero', '0'],
    ['a negative time', '-5000'],
    ['not a number', 'soon'],
    ['an infinite time', 'Infinity'],
    ['a blank value', ' '.repeat(3)],
    ['a unit-bearing string', '90s'],
  ])('ignores a meaningless configured deadline: %s', (_label, value) => {
    expect(withConfigured(value)).toBe(120_000);
  });
});

describe('run bound', () => {
  it('derives the run and minimum-route budgets from one environment snapshot', () => {
    const env = {
      SAFEWORD_REVIEW_RUN_BOUND_MS: '90000',
      SAFEWORD_REVIEW_TIMEOUT_MS: '45000',
    };

    expect(runBoundMs(env)).toBe(90_000);
    expect(minimumRouteMs(env)).toBe(45_000);
  });

  it('defaults to the documented ceiling', () => {
    expect(withConfiguredBound(undefined)).toBe(270_000);
    expect(withConfiguredBound(undefined)).toBeLessThan(300_000);
  });

  it('reserves enough default time to fund a route after one full attempt', () => {
    const remainingAfterTimeout = withConfiguredBound(undefined) - withConfigured(undefined);

    expect(minimumRouteMs()).toBe(60_000);
    expect(remainingAfterTimeout).toBe(150_000);
    expect(remainingAfterTimeout).toBeGreaterThanOrEqual(minimumRouteMs());
  });

  it('honours a shorter configured bound', () => {
    expect(withConfiguredBound('2000')).toBe(2000);
  });

  it('never exceeds the ceiling, however it is configured', () => {
    // A run that outlived the tool invoking it would be killed mid-flight with
    // nothing to show, so the ceiling is a guarantee, not a default.
    expect(withConfiguredBound('270000')).toBe(270_000);
    expect(withConfiguredBound('600000')).toBe(270_000);
    expect(withConfiguredBound('3600000')).toBe(270_000);
  });
});
