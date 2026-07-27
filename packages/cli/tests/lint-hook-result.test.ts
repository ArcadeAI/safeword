/**
 * Contract tests for rejecting lint-hook infrastructure failures.
 */

import type { SpawnSyncReturns } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { assertLintHookSucceeded } from './helpers';

function successfulHookWith(output: string): SpawnSyncReturns<string> {
  return {
    pid: 1,
    output: [undefined, output, ''],
    stdout: output,
    stderr: '',
    status: 0,
    signal: undefined,
  } as unknown as SpawnSyncReturns<string>;
}

describe('assertLintHookSucceeded', () => {
  it.each(['bunx failed: executable unavailable', 'ruff failed: invalid configuration'])(
    'rejects an infrastructure warning: %s',
    warning => {
      expect(() => assertLintHookSucceeded(successfulHookWith(warning))).toThrow(
        'Lint hook reported an infrastructure failure',
      );
    },
  );
});
