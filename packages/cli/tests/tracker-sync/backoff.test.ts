import { describe, expect, it, vi } from 'vitest';

import { isRateLimit, RateLimitError, withBackoff } from '../../src/tracker-sync/backoff.js';

describe('isRateLimit signal detection (sync-tracker.TB1.AC13)', () => {
  it.each([
    'API rate limit exceeded for user',
    'You have exceeded a secondary rate limit',
    'request failed with HTTP 429',
  ])('treats %j as a rate-limit signal', message => {
    expect(isRateLimit(message)).toBe(true);
  });

  it.each(['could not add label: not found', 'authentication required', 'no issues found'])(
    'does not treat %j as a rate-limit signal',
    message => {
      expect(isRateLimit(message)).toBe(false);
    },
  );
});

/**
 * Rate-limited writes are retried with backoff (JS5K5G AC13). The sleep is
 * injected so the test asserts the retry count and end-state without any real
 * delay elapsing (testing iron law: no arbitrary timeouts).
 */
describe('sync-tracker backoff (sync-tracker.TB1.AC13)', () => {
  it('retries a rate-limited call and ultimately succeeds', async () => {
    const sleep = vi.fn(() => Promise.resolve());
    let calls = 0;
    const operation = vi.fn((): Promise<string> => {
      calls += 1;
      return calls === 1 ? Promise.reject(new RateLimitError('429')) : Promise.resolve('projected');
    });

    const result = await withBackoff(operation, { sleep, maxRetries: 3, baseMs: 10 });

    expect(operation).toHaveBeenCalledTimes(2);
    expect(result).toBe('projected');
    expect(sleep).toHaveBeenCalledTimes(1); // one backoff between the two attempts
  });

  it('does not retry a non-rate-limit error', async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const operation = vi.fn((): Promise<string> => Promise.reject(new Error('boom')));

    await expect(withBackoff(operation, { sleep, maxRetries: 3, baseMs: 10 })).rejects.toThrow(
      'boom',
    );
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('gives up after maxRetries rate-limit errors', async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const operation = vi.fn((): Promise<string> => Promise.reject(new RateLimitError('429')));

    await expect(withBackoff(operation, { sleep, maxRetries: 2, baseMs: 10 })).rejects.toThrow(
      RateLimitError,
    );
    expect(operation).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});
