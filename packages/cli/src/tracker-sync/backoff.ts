/**
 * Rate-limit backoff for tracker writes (JS5K5G AC13). Retries only on a
 * RateLimitError, with exponential delay driven by an injected `sleep` so tests
 * (and callers wanting determinism) never block on real time.
 */

/** Thrown by a writer when the tracker reports a rate limit (e.g. HTTP 429). */
export class RateLimitError extends Error {
  constructor(message = 'rate limited') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export interface BackoffOptions {
  sleep: (ms: number) => Promise<void>;
  maxRetries: number;
  baseMs: number;
}

/**
 * Run `operation`, retrying on RateLimitError up to `maxRetries` times with
 * exponential backoff (`baseMs * 2^attempt`). Non-rate-limit errors propagate
 * immediately; the last RateLimitError rethrows once retries are exhausted.
 */
export async function withBackoff<T>(
  operation: () => Promise<T>,
  options: BackoffOptions,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof RateLimitError) || attempt >= options.maxRetries) throw error;
      await options.sleep(options.baseMs * 2 ** attempt);
    }
  }
}
