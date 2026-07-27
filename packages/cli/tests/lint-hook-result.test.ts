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

  it.each([2, undefined])('rejects an unsuccessful hook status: %s', status => {
    expect(() => assertLintHookSucceeded(hookResult('', { status }))).toThrow(
      'Lint hook exited with status',
    );
  });

  it('returns clean hook output', () => {
    expect(assertLintHookSucceeded(hookResult('lint output'))).toBe('lint output');
  });
});
