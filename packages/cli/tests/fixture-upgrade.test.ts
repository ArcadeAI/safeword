/**
 * Contract tests for fixture upgrades that reuse the repository toolchain.
 */

import { describe, expect, it } from 'vitest';

import { runFixtureUpgradeWithoutInstall } from './helpers';

describe('runFixtureUpgradeWithoutInstall boundary', () => {
  it('runs only upgrade with package and skill installation disabled', async () => {
    const calls: {
      args: string[];
      options?: { cwd?: string; env?: Record<string, string> };
    }[] = [];
    const runner = ((args, options) => {
      calls.push({ args, options });
      return Promise.resolve({ stdout: '', stderr: '', exitCode: 0, timedOut: false });
    }) as Parameters<typeof runFixtureUpgradeWithoutInstall>[1];

    await runFixtureUpgradeWithoutInstall('/fake/project', runner);

    expect(calls).toEqual([
      {
        args: ['upgrade', '--agents', 'cursor'],
        options: {
          cwd: '/fake/project',
          env: { SAFEWORD_SKIP_INSTALL: '1' },
        },
      },
    ]);
  });

  it('rejects a failed upgrade instead of allowing an unchanged fixture to false-green', async () => {
    const runner = (() =>
      Promise.resolve({
        stdout: '',
        stderr: 'upgrade failed',
        exitCode: 23,
        timedOut: false,
      })) as Parameters<typeof runFixtureUpgradeWithoutInstall>[1];

    await expect(runFixtureUpgradeWithoutInstall('/fake/project', runner)).rejects.toThrow(
      'Fixture upgrade failed (exit 23)',
    );
  });
});
