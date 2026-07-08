import { execFileSync, spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  decideStaleBranchWarning,
  parseCheckoutTarget,
} from '../../templates/hooks/lib/branch-staleness.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const STALE_MAIN_HOOK = nodePath.resolve(
  import.meta.dirname,
  '../../templates/hooks/pre-tool-stale-main.ts',
);

describe('parseCheckoutTarget', () => {
  it.each([
    ['git checkout main', 'main'],
    ['git switch main', 'main'],
    ['git checkout feature/x', 'feature/x'],
    ['git switch develop', 'develop'],
    // Shared-tokenizer parsing (EDDABK follow-up): per-segment, prefix-aware.
    ['git fetch && git checkout main', 'main'],
    ['cd repo; git switch develop', 'develop'],
    ['sudo git checkout main', 'main'],
    ['GIT_PAGER=cat git checkout main', 'main'],
    // Flags in a NEIGHBORING segment must not null out the parse — the old
    // flat-token scan read `git branch -d`'s flag as create/detach.
    ['git checkout main && git branch -d old', 'main'],
  ])('%s → %s', (command, expected) => {
    expect(parseCheckoutTarget(command)).toBe(expected);
  });

  it.each([
    ['git checkout -b new-branch', 'creates a branch'],
    ['git switch -c new-branch', 'creates a branch'],
    ['git checkout --detach abc123', 'detaches HEAD'],
    ['git checkout -- file.ts', 'path checkout'],
    ['git status', 'not a checkout'],
    ['git commit -m main', 'not a checkout'],
    // Quoted prose is one word under the shared tokenizer — the old
    // whitespace split probed a bogus branch here.
    ['echo "use git checkout main"', 'prose, not a command'],
    // The old flat-token scan returned `&&` as the target here.
    ['git checkout -q && echo hi', 'no positional target'],
  ])('%s → null (%s)', command => {
    expect(parseCheckoutTarget(command)).toBeNull();
  });
});

describe('decideStaleBranchWarning', () => {
  const base = { branch: 'main', upstream: 'origin/main' };

  it('is silent when up to date', () => {
    expect(decideStaleBranchWarning({ ...base, ahead: 0, behind: 0 })).toBeNull();
  });

  it('is silent when ahead only', () => {
    expect(decideStaleBranchWarning({ ...base, ahead: 3, behind: 0 })).toBeNull();
  });

  it('warns (behind) when strictly behind', () => {
    const warning = decideStaleBranchWarning({ ...base, ahead: 0, behind: 4 });
    expect(warning).toContain('4 commit(s) behind origin/main');
    expect(warning).not.toContain('diverged');
  });

  it('warns (diverged) when both ahead and behind', () => {
    const warning = decideStaleBranchWarning({ ...base, ahead: 5, behind: 4 });
    expect(warning).toContain('diverged');
    expect(warning).toContain('5 ahead, 4 behind');
  });
});

// Wiring test: real git repo + upstream → the hook the agent's checkout triggers
// (#366, #363). Mocks nothing — the contract IS what git's refs report.
describe('pre-tool-stale-main hook (real git)', () => {
  let workdir: string;
  let remote: string;

  function git(cwd: string, ...args: string[]): string {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  }

  function commit(cwd: string, file: string, body: string, message: string): void {
    const absolute = nodePath.join(cwd, file);
    mkdirSync(nodePath.dirname(absolute), { recursive: true });
    writeFileSync(absolute, body);
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-m', message);
  }

  function runHook(cwd: string, command: string): SpawnSyncReturns<string> {
    return spawnSync('bun', [STALE_MAIN_HOOK], {
      cwd,
      env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
      encoding: 'utf8',
    });
  }

  beforeEach(() => {
    remote = createTemporaryDirectory();
    workdir = createTemporaryDirectory();
    git(remote, 'init', '--bare');
    git(workdir, 'init');
    git(workdir, 'config', 'user.email', 'test@example.com');
    git(workdir, 'config', 'user.name', 'Test');
    git(workdir, 'checkout', '-b', 'main');
    mkdirSync(nodePath.join(workdir, '.safeword'), { recursive: true });
    commit(workdir, 'README.md', 'v1\n', 'initial');
    git(workdir, 'remote', 'add', 'origin', remote);
    git(workdir, 'push', '-u', 'origin', 'main');
    // The bare repo's HEAD defaults to `master`; point it at `main` so a clone
    // checks out `main` as a tracking branch.
    git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  });

  afterEach(() => {
    removeTemporaryDirectory(workdir);
    removeTemporaryDirectory(remote);
  });

  it('stays silent when local main matches origin/main', () => {
    const result = runHook(workdir, 'git checkout main');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('warns when local main is behind origin/main', () => {
    // Advance origin/main from a second clone, then fetch so the local ref is behind.
    const other = createTemporaryDirectory();
    try {
      git(other, 'clone', remote, '.');
      git(other, 'config', 'user.email', 'o@example.com');
      git(other, 'config', 'user.name', 'Other');
      commit(other, 'README.md', 'v2\n', 'upstream advance');
      git(other, 'push', 'origin', 'main');

      git(workdir, 'fetch', 'origin');
      const result = runHook(workdir, 'git checkout main');

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('behind origin/main');
    } finally {
      removeTemporaryDirectory(other);
    }
  });

  it('stays silent for a non-checkout command', () => {
    const result = runHook(workdir, 'git status');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});
