/**
 * Release gate: PreToolUse Bash hook resets `core.bare = false`.
 *
 * Why this matters: Claude Code's parallel-worktree creation has an upstream
 * race that flips the parent repo's `.git/config` `core.bare = true` mid-flight
 * (anthropics/claude-code#58345). Every git op in any sibling worktree then
 * fails with `fatal: this operation must be run in a work tree`.
 *
 * Our `.husky/pre-commit` already resets it inside `git commit`. This hook
 * extends the defense to ad-hoc git reads (`git status`, `git mv`, `git push`,
 * etc.) by running before every Bash tool call whose command starts with `git`.
 *
 * This test fixtures the failure: creates a temp repo, deliberately flips
 * `core.bare = true`, invokes the hook script, asserts the flag was reset.
 *
 * Excluded from `bun run test` (release-gate only).
 * Run with: bun run test:release
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../..');
const HOOK_PATH = nodePath.join(REPO_ROOT, 'packages/cli/templates/hooks/pre-tool-git-bare-fix.sh');

function gitConfigGet(directory: string, key: string): string {
  const result = spawnSync('git', ['config', '--get', key], {
    cwd: directory,
    encoding: 'utf8',
  });
  return result.stdout.trim();
}

describe('pre-tool-git-bare-fix hook', () => {
  let temporaryRepo: string;

  beforeEach(() => {
    temporaryRepo = mkdtempSync(nodePath.join(tmpdir(), 'safeword-bare-fix-'));
    spawnSync('git', ['init', '--initial-branch=main'], { cwd: temporaryRepo });
    // Deliberately flip the race condition we're defending against
    spawnSync('git', ['config', 'core.bare', 'true'], { cwd: temporaryRepo });
    expect(gitConfigGet(temporaryRepo, 'core.bare')).toBe('true');
  });

  afterEach(() => {
    rmSync(temporaryRepo, { recursive: true, force: true });
  });

  it('resets core.bare to false when invoked from a worktree with bare=true', () => {
    // Hook reads JSON tool_input from stdin (PreToolUse contract).
    // Body is the Claude Code hook payload for a Bash call running `git status`.
    const payload = JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'git status' },
    });

    const result = spawnSync(HOOK_PATH, [], {
      cwd: temporaryRepo,
      input: payload,
      encoding: 'utf8',
    });

    expect(
      result.status,
      `hook exited ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    ).toBe(0);
    expect(gitConfigGet(temporaryRepo, 'core.bare')).toBe('false');
  });

  it('is idempotent — running on already-false config does not error', () => {
    spawnSync('git', ['config', 'core.bare', 'false'], { cwd: temporaryRepo });
    expect(gitConfigGet(temporaryRepo, 'core.bare')).toBe('false');

    const payload = JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'git log' },
    });

    const result = spawnSync(HOOK_PATH, [], {
      cwd: temporaryRepo,
      input: payload,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(gitConfigGet(temporaryRepo, 'core.bare')).toBe('false');
  });

  it('exits cleanly when not inside a git repository', () => {
    // Use a non-git temp directory
    const nonGitDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-non-git-'));
    try {
      const payload = JSON.stringify({
        tool_name: 'Bash',
        tool_input: { command: 'git status' },
      });

      const result = spawnSync(HOOK_PATH, [], {
        cwd: nonGitDirectory,
        input: payload,
        encoding: 'utf8',
      });

      // Hook must not block Claude Code if there's no git repo to fix
      expect(result.status).toBe(0);
    } finally {
      rmSync(nonGitDirectory, { recursive: true, force: true });
    }
  });
});
