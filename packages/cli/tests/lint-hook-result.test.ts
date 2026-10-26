/**
 * Contract tests for rejecting lint-hook infrastructure failures.
 */

import type { SpawnSyncReturns } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { assertLintHookSucceeded } from './helpers';

function hookResult(
  output: string,
  overrides: Partial<SpawnSyncReturns<string>> = {},
): SpawnSyncReturns<string> {
  return {
    pid: 1,
    output: [undefined, output, ''],
    stdout: output,
    stderr: '',
    status: 0,
    signal: undefined,
    ...overrides,
  } as unknown as SpawnSyncReturns<string>;
}

describe('assertLintHookSucceeded', () => {
  it.each(['bunx failed: executable unavailable', 'ruff failed: invalid configuration'])(
    'rejects an infrastructure warning: %s',
    warning => {
      expect(() => assertLintHookSucceeded(hookResult(warning))).toThrow(
        'Lint hook reported an infrastructure failure',
      );
    },
  );

  it('rejects a hook spawn error', () => {
    expect(() =>
      assertLintHookSucceeded(hookResult('', { error: new Error('spawn failed') })),
    ).toThrow('Lint hook failed to start');
  });

  it.each([
    {
      failure: 'timeout',
      result: {
        error: Object.assign(new Error('spawnSync bash ETIMEDOUT'), { code: 'ETIMEDOUT' }),
        // eslint-disable-next-line unicorn/no-null -- Node reports null status on timeout.
        status: null,
        signal: 'SIGKILL' as const,
      },
      reason: 'Lint hook timed out: spawnSync bash ETIMEDOUT',
    },
    {
      failure: 'startup error',
      result: {
        error: Object.assign(new Error('startup message mentions ETIMEDOUT'), {
          code: 'ENOENT',
        }),
      },
      reason: 'Lint hook failed to start: startup message mentions ETIMEDOUT',
    },
    {
      failure: 'unsuccessful exit',
      result: { status: 2 },
      reason: 'Lint hook exited with status 2',
    },
  ])('preserves captured output on $failure', ({ result, reason }) => {
    const failedHook = hookResult('completed ESLint fix', {
      ...result,
      stderr: 'checking remaining errors',
    });

    expect(() => assertLintHookSucceeded(failedHook)).toThrow(
      expect.objectContaining({
        message: `${reason}\nstdout: completed ESLint fix\nstderr: checking remaining errors`,
      }),
    );
  });

  it.each([2, undefined])('rejects an unsuccessful hook status: %s', status => {
    expect(() => assertLintHookSucceeded(hookResult('', { status }))).toThrow(
      'Lint hook exited with status',
    );
  });

  it('returns clean hook output', () => {
    expect(assertLintHookSucceeded(hookResult('lint output'))).toBe('lint output');
  });
});
