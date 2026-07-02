/**
 * Unit tests for `setupOrThrow`'s bounded retry-on-timeout policy (issue #419
 * test-harness companion).
 *
 * The heavy `safeword setup`-in-`beforeAll` E2Es false-red when the machine is
 * saturated and setup outruns its wall-clock timeout. `setupOrThrow` now retries
 * ONCE, and ONLY on a timeout — never on a real non-zero exit, so a genuine setup
 * regression still fails fast and loud. These tests lock that invariant in place
 * by injecting a scripted runner (no real subprocess, no real timeout).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { setupOrThrow } from './helpers';

interface FakeResult {
  exitCode: number;
  timedOut: boolean;
  stdout?: string;
  stderr?: string;
}

/**
 * Build a fake `runCli` that returns the scripted results in order (clamping to
 * the last entry if called more times), and records how many times it was called.
 */
type SetupRunner = Parameters<typeof setupOrThrow>[3];

function scriptedRunner(results: FakeResult[]): {
  runner: SetupRunner;
  callCount: () => number;
} {
  let calls = 0;
  const runner = (() => {
    const result = results[Math.min(calls, results.length - 1)];
    calls++;
    if (!result) {
      throw new Error('scriptedRunner requires a non-empty results array');
    }
    return Promise.resolve({
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      exitCode: result.exitCode,
      timedOut: result.timedOut,
    });
  }) as SetupRunner;
  return { runner, callCount: () => calls };
}

const SUCCESS: FakeResult = { exitCode: 0, timedOut: false, stdout: 'setup complete' };
const TIMEOUT: FakeResult = { exitCode: 1, timedOut: true, stderr: 'killed after timeout' };
const REAL_FAILURE: FakeResult = { exitCode: 2, timedOut: false, stderr: 'dist/cli.js not found' };

describe('setupOrThrow retry policy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns on first-attempt success without retrying', async () => {
    const { runner, callCount } = scriptedRunner([SUCCESS]);

    const result = await setupOrThrow('/fake/project', ['setup'], {}, runner);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('setup complete');
    expect(callCount()).toBe(1);
  });

  it('retries once on a timeout, then returns the succeeding result', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const { runner, callCount } = scriptedRunner([TIMEOUT, SUCCESS]);

    const result = await setupOrThrow('/fake/project', ['setup'], {}, runner);

    expect(result.exitCode).toBe(0);
    expect(callCount()).toBe(2);
    // Recovered timeouts are visible, never silent.
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(stderrSpy.mock.calls[0]?.[0]).toContain('retrying once');
  });

  it('does NOT retry a real non-zero exit — fails fast and loud', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const { runner, callCount } = scriptedRunner([REAL_FAILURE, SUCCESS]);

    await expect(setupOrThrow('/fake/project', ['setup'], {}, runner)).rejects.toThrow(
      /failed \(exit 2\)/,
    );
    // A real failure is a genuine regression: exactly one attempt, no retry, no
    // "retrying" breadcrumb — the second scripted SUCCESS is never reached.
    expect(callCount()).toBe(1);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('throws a distinct timeout error (not the exit-code error) when both attempts time out', async () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const { runner, callCount } = scriptedRunner([TIMEOUT, TIMEOUT]);

    await expect(setupOrThrow('/fake/project', ['setup'], {}, runner)).rejects.toThrow(
      /timed out after 2 attempts/,
    );
    // Bounded: never more than 2 attempts even under a persistent timeout.
    expect(callCount()).toBe(2);
  });
});
