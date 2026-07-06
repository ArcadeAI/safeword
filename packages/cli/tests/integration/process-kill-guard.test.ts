/**
 * Integration tests for the broad-process-kill Bash gate (ticket K4STDR,
 * issue #773).
 *
 * Exercises pre-tool-quality.ts against Bash tool calls that kill processes
 * by bare runtime name (`killall node`, `pkill -9 node`) — which on a
 * multi-project machine kills every project's dev servers and test runners,
 * not just this one's. The gate denies and points to the project-scoped
 * alternatives from zombie-process-cleanup.md.
 */

import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';
import process from 'node:process';

import { afterEach, describe, it } from 'vitest';

import {
  createTemporaryDirectory,
  expectHookAllow,
  expectHookDeny,
  type HookResult,
  initGitRepo,
  removeTemporaryDirectory,
  TIMEOUT_QUICK,
} from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const PRE_TOOL_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/pre-tool-quality.ts');
const CODEX_PRE_TOOL_QUALITY = nodePath.join(
  SAFEWORD_ROOT,
  '.safeword/hooks/codex/pre-tool-quality.ts',
);

/** Invoke pre-tool-quality with a Bash payload. */
function runBashHook(cwd: string, command: string): HookResult {
  const result = spawnSync('bun', [PRE_TOOL_QUALITY], {
    input: JSON.stringify({
      session_id: 'test-session',
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command },
    }),
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** Invoke the Codex adapter with a Codex-shaped Bash payload. */
function runCodexHook(cwd: string, command: string): HookResult {
  const result = spawnSync('bun', [CODEX_PRE_TOOL_QUALITY], {
    input: JSON.stringify({
      session_id: 'test-session',
      tool_name: 'Bash',
      tool_input: { command },
    }),
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('Broad process-kill Bash gate', () => {
  let projectDirectory = '';

  afterEach(() => {
    if (!projectDirectory) {
      return;
    }

    removeTemporaryDirectory(projectDirectory);
    projectDirectory = '';
  });

  function setupProject(): string {
    projectDirectory = createTemporaryDirectory();
    initGitRepo(projectDirectory);
    return projectDirectory;
  }

  describe('Rule: bare-runtime kills are denied on the Bash channel', () => {
    it('Scenario: killall node is denied with the project-scoped alternatives', () => {
      const cwd = setupProject();
      const result = runBashHook(cwd, 'killall node');
      expectHookDeny(result, 'every');
      expectHookDeny(result, 'cleanup-zombies.sh');
    });

    it('Scenario: pkill -9 node is denied even inside a compound command', () => {
      const cwd = setupProject();
      expectHookDeny(runBashHook(cwd, 'cd packages/app && pkill -9 node'), 'pkill');
    });

    it('Scenario: the Codex adapter carries the same denial', () => {
      const cwd = setupProject();
      expectHookDeny(runCodexHook(cwd, 'killall node'), 'killall');
    });
  });

  describe('Rule: project-scoped kills stay allowed', () => {
    it('Scenario: the guide-sanctioned scoped patterns pass end to end', () => {
      const cwd = setupProject();
      expectHookAllow(runBashHook(cwd, 'pkill -f "playwright.*$(pwd)"'));
      expectHookAllow(runBashHook(cwd, 'lsof -ti:3000 | xargs kill -9'));
      expectHookAllow(runCodexHook(cwd, 'kill -9 12345'));
    });
  });
});
