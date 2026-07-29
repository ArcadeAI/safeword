import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { selfHeal } from '../../src/utils/architecture-document.js';
import {
  createTemporaryDirectory,
  initGitRepo,
  removeTemporaryDirectory,
  runCli,
} from '../helpers.js';

const REPOSITORY_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const HOOK_PATH = nodePath.join(
  REPOSITORY_ROOT,
  'packages/cli/templates/hooks/pre-tool-architecture-stage.ts',
);

describe('pre-tool architecture staging hook', () => {
  let directory: string;

  function git(...args: string[]): string {
    return execFileSync('git', args, { cwd: directory, encoding: 'utf8' });
  }

  function runHook(command: string): ReturnType<typeof spawnSync> {
    symlinkSync(
      nodePath.join(REPOSITORY_ROOT, 'packages'),
      nodePath.join(directory, 'packages'),
      'dir',
    );
    return spawnSync('bun', [HOOK_PATH], {
      cwd: directory,
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
      input: JSON.stringify({
        tool_name: 'Bash',
        tool_input: { command },
      }),
    });
  }

  beforeEach(() => {
    directory = createTemporaryDirectory();
    initGitRepo(directory);
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(directory, 'src', 'auth'), { recursive: true });
    mkdirSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });
    writeFileSync(nodePath.join(directory, 'package.json'), JSON.stringify({ name: 'fixture' }));
    writeFileSync(
      nodePath.join(directory, 'src', 'auth', 'index.ts'),
      'export const auth = true;\n',
    );
    writeFileSync(
      nodePath.join(directory, 'src', 'billing', 'index.ts'),
      'export const billing = true;\n',
    );
    selfHeal(directory);
    git('add', '-A');
    git('commit', '-m', 'initial fixture');
  });

  afterEach(() => {
    removeTemporaryDirectory(directory);
  });

  it('keeps a git commit -a snapshot fresh in a clean checkout', async () => {
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });

    const hook = runHook('git commit -am "remove billing"');
    expect(hook.status).toBe(0);

    git('commit', '-am', 'remove billing');
    const cleanCheckout = createTemporaryDirectory();
    try {
      git('clone', '--quiet', '--no-local', directory, cleanCheckout);

      const check = await runCli(['architecture', '--check'], { cwd: cleanCheckout });

      expect(check.exitCode).toBe(0);
    } finally {
      removeTemporaryDirectory(cleanCheckout);
    }
  });

  it.each([
    ['git -C . commit -am "remove billing"', ['-C', '.', 'commit', '-am', 'remove billing']],
    [
      'git -c core.abbrev=7 commit -am "remove billing"',
      ['-c', 'core.abbrev=7', 'commit', '-am', 'remove billing'],
    ],
  ])('keeps a global-option %s commit fresh in a clean checkout', async (command, gitArguments) => {
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });

    const hook = runHook(command);
    expect(hook.status).toBe(0);

    git(...gitArguments);
    const cleanCheckout = createTemporaryDirectory();
    try {
      git('clone', '--quiet', '--no-local', directory, cleanCheckout);

      const check = await runCli(['architecture', '--check'], { cwd: cleanCheckout });

      expect(check.exitCode).toBe(0);
    } finally {
      removeTemporaryDirectory(cleanCheckout);
    }
  });

  it('does not stage tracked worktree changes when git commit -a aborts', () => {
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });
    const preCommitHook = nodePath.join(directory, '.git', 'hooks', 'pre-commit');
    writeFileSync(preCommitHook, '#!/bin/sh\nexit 1\n');
    chmodSync(preCommitHook, 0o755);

    const hook = runHook('git commit -am "remove billing"');
    expect(hook.status).toBe(0);
    expect(git('diff', '--cached', '--name-only')).not.toContain('src/billing/index.ts');

    const commit = spawnSync('git', ['commit', '-am', 'remove billing'], {
      cwd: directory,
      encoding: 'utf8',
    });

    expect(commit.status).not.toBe(0);
    expect(git('diff', '--cached', '--name-only')).not.toContain('src/billing/index.ts');
    expect(git('diff', '--name-only')).toContain('src/billing/index.ts');
  });

  it.each([
    'git commit -ma',
    'git commit -m "document -a behavior"',
    'git commit --message="-a"',
    'git commit -uall -m status',
    'git commit -Salpha -m signed',
    'echo "git commit -a"',
    'git commit -a --dry-run',
    'git commit -a --short',
    'git commit -a --porcelain',
    'git commit -a --long',
    'git commit -a -z',
    'git commit -a --null',
    'git commit -a --dry',
    'git commit -a --sho',
    'git commit -a --porc',
    'git commit -a --lon',
    'git commit -a --nul',
    'git commit -a -h',
    'git commit -a --help',
    'git commit --mess -a',
  ])('does not broaden a non-all commit: %s', command => {
    rmSync(nodePath.join(directory, 'src', 'billing'), { recursive: true });

    const hook = runHook(command);

    expect(hook.status).toBe(0);
    expect(git('diff', '--cached', '--name-only')).not.toContain('src/billing/index.ts');
    expect(git('diff', '--cached', '--name-only')).not.toContain(
      '.project/architecture.generated.md',
    );
  });
});
