/**
 * Session-level hooks follow the session pointer (#5467). The real
 * PostToolUse hook records the enrolled repository B that an edit landed in;
 * each session-level hook then runs from launch checkout A — its host cwd and
 * CLAUDE_PROJECT_DIR — and must act on B. A is deliberately unenrolled, so a
 * hook that resolved from its cwd instead of the pointer would visibly do
 * nothing.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { recordSignal } from '../../templates/hooks/lib/self-report.js';
import { createTemporaryDirectory, removeTemporaryDirectory, TIMEOUT_QUICK } from '../helpers';

const HOOKS = nodePath.resolve(import.meta.dirname, '../../templates/hooks');

function enrolledRepo(directory: string): string {
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(directory, '.git'), 'gitdir: elsewhere\n');
  writeFileSync(nodePath.join(directory, '.safeword', 'SAFEWORD.md'), '# enrolled\n');
  mkdirSync(nodePath.join(directory, '.project'), { recursive: true });
  return directory;
}

function runHook(hook: string, launch: string, input: Record<string, unknown>) {
  return spawnSync('bun', [nodePath.join(HOOKS, hook)], {
    input: JSON.stringify(input),
    cwd: launch,
    env: { ...process.env, CLAUDE_PROJECT_DIR: launch },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

describe('session-level hooks follow the session pointer (#5467)', () => {
  let root: string;
  let launch: string;
  let repoB: string;
  let sessionId: string;
  let counter = 0;

  beforeEach(() => {
    root = createTemporaryDirectory();
    launch = nodePath.join(root, 'launch');
    mkdirSync(launch);
    writeFileSync(nodePath.join(launch, '.git'), 'gitdir: elsewhere\n');
    repoB = enrolledRepo(nodePath.join(root, 'repo-b'));
    counter += 1;
    sessionId = `pointer-hooks-${process.pid}-${counter}`;

    // The real PostToolUse hook records where this session's edit landed.
    mkdirSync(nodePath.join(repoB, 'src'));
    const edited = nodePath.join(repoB, 'src/a.ts');
    writeFileSync(edited, 'export const a = 1;\n');
    const recorded = runHook('post-tool-quality.ts', launch, {
      session_id: sessionId,
      hook_event_name: 'PostToolUse',
      cwd: launch,
      tool_name: 'Edit',
      tool_input: { file_path: edited, old_string: 'a = 0', new_string: 'a = 1' },
    });
    expect(recorded.status, recorded.stderr).toBe(0);
  });

  afterEach(() => {
    rmSync(nodePath.join(tmpdir(), `safeword-session-project-${sessionId}`), { force: true });
    removeTemporaryDirectory(root);
  });

  it('prompt-questions injects its guidance for the repository the session edited', () => {
    const result = runHook('prompt-questions.ts', launch, {
      session_id: sessionId,
      cwd: launch,
      prompt: 'continue',
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).not.toBe('');
  });

  it('session-compact-context restores the edited repository learnings pointer', () => {
    mkdirSync(nodePath.join(repoB, '.project/learnings'), { recursive: true });
    writeFileSync(nodePath.join(repoB, '.project/learnings/INDEX.md'), '# Learnings\n');

    const result = runHook('session-compact-context.ts', launch, {
      session_id: sessionId,
      cwd: launch,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Project learnings');
  });

  it('session-cleanup-quality cleans the edited repository stale state', () => {
    const stale = nodePath.join(repoB, '.project/quality-state-old-session.json');
    writeFileSync(stale, '{}');
    const eightDaysAgo = (Date.now() - 8 * 24 * 60 * 60 * 1000) / 1000;
    utimesSync(stale, eightDaysAgo, eightDaysAgo);

    const result = runHook('session-cleanup-quality.ts', launch, {
      session_id: sessionId,
      cwd: launch,
    });

    expect(result.status).toBe(0);
    expect(existsSync(stale)).toBe(false);
  });

  it('stop-self-report surfaces the edited repository signals', () => {
    recordSignal(
      repoB,
      sessionId,
      { source: 'post-tool-quality', errorClass: 'TypeError' },
      '1.0.0',
    );

    const result = runHook('stop-self-report.ts', launch, { session_id: sessionId, cwd: launch });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('TypeError@post-tool-quality');
  });

  it('a SessionStart hook reports the edited repository after the session returns', () => {
    writeFileSync(nodePath.join(repoB, '.safeword', 'version'), '9.9.9-edited\n');

    const result = runHook('session-version.ts', launch, {
      session_id: sessionId,
      hook_event_name: 'SessionStart',
      cwd: launch,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('v9.9.9-edited');
  });
});
