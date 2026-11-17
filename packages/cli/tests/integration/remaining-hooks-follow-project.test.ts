/**
 * The remaining per-tool and SessionStart hooks act on the project the call
 * resolves to, not the launch checkout (#5467 part 2b). Each hook runs with
 * CLAUDE_PROJECT_DIR and its process cwd at launch checkout A, which is not
 * enrolled, while the call targets enrolled worktree B. A hook that still
 * picked its project from CLAUDE_PROJECT_DIR would see no Safeword at A and
 * stay silent, so each assertion fails unless the hook resolved B.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory, TIMEOUT_QUICK } from '../helpers';

const HOOKS = nodePath.resolve(import.meta.dirname, '../../templates/hooks');

function runHook(hook: string, launch: string, input: Record<string, unknown>) {
  return spawnSync('bun', [nodePath.join(HOOKS, hook)], {
    input: JSON.stringify(input),
    cwd: launch,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: launch,
      CLAUDE_PLUGIN_ROOT: '',
      SAFEWORD_PLUGIN_CLI: '',
    },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

describe('remaining hooks act on the resolved project (#5467)', () => {
  let root: string;
  let launch: string;
  let worktree: string;

  beforeEach(() => {
    root = createTemporaryDirectory();
    launch = nodePath.join(root, 'launch');
    mkdirSync(launch);
    writeFileSync(nodePath.join(launch, '.git'), 'gitdir: elsewhere\n');
    worktree = nodePath.join(root, 'worktree');
    mkdirSync(nodePath.join(worktree, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(worktree, '.git'), 'gitdir: elsewhere\n');
    writeFileSync(nodePath.join(worktree, '.safeword', 'SAFEWORD.md'), '# enrolled\n');
    writeFileSync(nodePath.join(worktree, '.safeword', 'version'), '9.9.9-worktree\n');
    mkdirSync(nodePath.join(worktree, 'src'));
  });

  afterEach(() => {
    removeTemporaryDirectory(root);
  });

  it('session-version reports the version of the worktree the session starts in', () => {
    const result = runHook('session-version.ts', launch, {
      session_id: `version-${process.pid}`,
      hook_event_name: 'SessionStart',
      cwd: worktree,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('v9.9.9-worktree');
  });

  it('session-lint-check checks the lint setup of the worktree the session starts in', () => {
    const result = runHook('session-lint-check.ts', launch, {
      session_id: `lint-check-${process.pid}`,
      hook_event_name: 'SessionStart',
      cwd: worktree,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ESLint config not found');
  });

  it('post-tool-bypass-warn warns about a bypass added in the worktree', () => {
    const file = nodePath.join(worktree, 'src/a.ts');
    writeFileSync(file, '// eslint-disable-next-line\nexport const a = 1;\n');

    const result = runHook('post-tool-bypass-warn.ts', launch, {
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      cwd: launch,
      tool_input: { file_path: file, new_string: '// eslint-disable-next-line' },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('eslint-disable');
  });

  it("pre-tool-config-guard asks before an edit to the worktree's CI config", () => {
    const file = nodePath.join(worktree, '.gitlab-ci.yml');

    const result = runHook('pre-tool-config-guard.ts', launch, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      cwd: launch,
      tool_input: { file_path: file, old_string: 'a', new_string: 'b' },
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('ask');
  });

  it("post-tool-sync-learnings warns about a stamp in the worktree's learnings", () => {
    const learning = nodePath.join(worktree, '.project/learnings/astro.md');
    mkdirSync(nodePath.dirname(learning), { recursive: true });
    writeFileSync(learning, '# Astro\n\nCovers: content config\n\n✅ Verified by build\n');

    const result = runHook('post-tool-sync-learnings.ts', launch, {
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      cwd: launch,
      tool_input: { file_path: learning },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Verification stamp detected in .project/learnings/astro.md');
  });

  it("post-tool-lint lints a worktree file with the worktree's Safeword configs", () => {
    // Only the launch checkout carries a Ruff config: linting with the launch
    // checkout's configs would find it and stay quiet about it.
    mkdirSync(nodePath.join(launch, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(launch, '.safeword', 'ruff.toml'), 'line-length = 100\n');
    const file = nodePath.join(worktree, 'src/app.py');
    writeFileSync(file, 'x = 1\n');

    const result = runHook('post-tool-lint.ts', launch, {
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      cwd: launch,
      tool_input: { file_path: file },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Python Safeword config is missing');
  });
});
