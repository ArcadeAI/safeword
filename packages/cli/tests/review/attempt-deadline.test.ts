import { afterEach, describe, expect, it } from 'vitest';

import { attemptDeadlineMs } from '../../src/review/runtime.js';

const original = process.env.SAFEWORD_REVIEW_TIMEOUT_MS;

afterEach(() => {
  if (original === undefined) delete process.env.SAFEWORD_REVIEW_TIMEOUT_MS;
  else process.env.SAFEWORD_REVIEW_TIMEOUT_MS = original;
});

function withConfigured(value: string | undefined): number {
  if (value === undefined) delete process.env.SAFEWORD_REVIEW_TIMEOUT_MS;
  else process.env.SAFEWORD_REVIEW_TIMEOUT_MS = value;
  return attemptDeadlineMs();
}

describe('attempt deadline', () => {
  it('gives every attempt the same default, well above the slowest observed review', () => {
    // 91 real runs: 47s median, 75s slowest success. 300s is four times that.
    expect(withConfigured(undefined)).toBe(300_000);
  });

  it('honours an explicitly configured deadline', () => {
    expect(withConfigured('120000')).toBe(120_000);
    expect(withConfigured('450000')).toBe(450_000);
  });

  it('never lets a configured deadline exceed the run bound', () => {
    // Every caller invokes the command through a tool capped at 600s, so a
    // longer deadline would be killed mid-flight rather than honoured.
    expect(withConfigured('540000')).toBe(540_000);
    expect(withConfigured('600000')).toBe(540_000);
    expect(withConfigured('99999999')).toBe(540_000);
  });

  it.each([
    ['zero', '0'],
    ['a negative time', '-5000'],
    ['not a number', 'soon'],
    ['an infinite time', 'Infinity'],
    ['a blank value', ' '.repeat(3)],
    ['a unit-bearing string', '90s'],
  ])('ignores a meaningless configured deadline: %s', (_label, value) => {
    expect(withConfigured(value)).toBe(300_000);
  });
});
