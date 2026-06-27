import { describe, expect, it } from 'vitest';

import {
  type AutoUpgradeOutcome,
  rollbackSafewordManagedFiles,
  toClaudeAutoUpgradeResponse,
  toCodexSessionStartResponse,
} from '../../templates/hooks/lib/auto-upgrade.js';

describe('auto-upgrade hook response mapping', () => {
  it('keeps Claude major-version notices on the asyncRewake exit-2 path', () => {
    const outcome: AutoUpgradeOutcome = {
      kind: 'notify',
      message: 'v2.0.0 available (major) - run `bunx safeword@2.0.0 upgrade` to update',
    };

    expect(toClaudeAutoUpgradeResponse(outcome)).toEqual({
      exitCode: 2,
      stderr: `${outcome.message}\n`,
    });
  });

  it('keeps Codex major-version notices successful and visible in SessionStart output', () => {
    const outcome: AutoUpgradeOutcome = {
      kind: 'notify',
      message: 'v2.0.0 available (major) - run `bunx safeword@2.0.0 upgrade` to update',
    };

    const response = toCodexSessionStartResponse({
      outcome,
      additionalContext: 'SAFEWORD.md standing instructions',
    });

    expect(response.exitCode).toBe(0);
    expect(response.stderr).toBeUndefined();

    const output = JSON.parse(response.stdout ?? '{}') as {
      systemMessage?: string;
      hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
    };
    expect(output.systemMessage).toBe(outcome.message);
    expect(output.hookSpecificOutput).toEqual({
      hookEventName: 'SessionStart',
      additionalContext: 'SAFEWORD.md standing instructions',
    });
  });
});

describe('rollbackSafewordManagedFiles()', () => {
  it('rolls back only safeword-managed tracked and untracked files', () => {
    const calls: { command: string; args: readonly string[] }[] = [];

    const rolledBack = rollbackSafewordManagedFiles({
      projectDir: '/repo',
      changedFiles: ['.safeword/SAFEWORD.md', 'src/app.ts'],
      stagedFiles: ['.safeword/hooks/staged-new.ts'],
      untrackedFiles: ['.safeword/hooks/new.ts', 'notes.txt'],
      filterSafewordFiles: (changedFiles, untrackedFiles) =>
        [...changedFiles, ...untrackedFiles].filter(file => file.startsWith('.safeword/')),
      execFileSync: (command, args) => {
        calls.push({ command, args });
        return '';
      },
    });

    expect(rolledBack).toEqual([
      '.safeword/SAFEWORD.md',
      '.safeword/hooks/staged-new.ts',
      '.safeword/hooks/new.ts',
    ]);
    expect(calls).toEqual([
      {
        command: 'git',
        args: ['reset', '--', '.safeword/SAFEWORD.md', '.safeword/hooks/staged-new.ts'],
      },
      { command: 'git', args: ['checkout', '--', '.safeword/SAFEWORD.md'] },
      { command: 'git', args: ['checkout', '--', '.safeword/hooks/staged-new.ts'] },
      {
        command: 'git',
        args: ['clean', '-f', '--', '.safeword/hooks/staged-new.ts', '.safeword/hooks/new.ts'],
      },
    ]);
  });
});
