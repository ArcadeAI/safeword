/**
 * Integration: Codex/Cursor skill-invocation fallback → done-gate (E2E) (#295)
 *
 * `skill-gate-integration.test.ts` writes `skill-invocations.log` directly. This
 * test instead drives the *real* `record-skill-invocation.ts` fallback command
 * under a runtime that does not execute Claude's inline `!` line — the path
 * Codex/Cursor take when that line is rendered as Markdown. It confirms:
 *
 *   1. The fallback records gate-readable, session-bound proof for every gated
 *      skill when a session id is supplied explicitly (the HMZSCD arg path) or
 *      exposed through a compatible runtime identity such as CODEX_THREAD_ID,
 *      and degrades gracefully (exit 0, nothing recorded) when none is — so a
 *      runtime never silently mis-binds.
 *   2. End-to-end, a feature done-gate PASSES when verify+audit proof was
 *      recorded via the fallback, and FAILS CLOSED with a clear,
 *      `CLAUDE_SESSION_ID`-free message when the runtime could not bind one.
 *
 * Closes the cross-agent coverage gap: the recording mechanism is otherwise
 * only unit-tested, with nothing exercising it against the actual done-gate
 * under a non-Claude environment.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  initGitRepo,
  removeTemporaryDirectory,
  setupOrThrow,
} from '../helpers.js';
import { runDoneGate, writeFeatureTicketAtDone } from './done-gate-harness.js';

// The done-gate's gated skills. record-skill-invocation.ts is skill-name
// agnostic, so the fallback mechanism is exercised across all three.
const GATED_SKILLS = ['verify', 'audit', 'quality-review'] as const;

// Scrub ambient session vars so each test controls the binding source. Without
// this, a CLAUDE_SESSION_ID or CODEX_THREAD_ID leaking in from the harness would
// mask the very path being asserted.
function fallbackEnvironment(
  projectDirectory: string,
  sessionEnvironment: Partial<NodeJS.ProcessEnv> = {},
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory };
  delete environment.CLAUDE_SESSION_ID;
  delete environment.CLAUDE_CODE_SESSION_ID;
  delete environment.CODEX_THREAD_ID;
  Object.assign(environment, sessionEnvironment);
  return environment;
}

// Drive the documented fallback exactly as a Codex/Cursor skill body would:
// `bun record-skill-invocation.ts <projectDir> <skill> <sessionId>`.
function runFallback(
  projectDirectory: string,
  skill: string,
  sessionIdArgument: string,
  sessionEnvironment: Partial<NodeJS.ProcessEnv> = {},
): { exitCode: number; output: string } {
  const result = spawnSync(
    'bun',
    ['.safeword/hooks/record-skill-invocation.ts', projectDirectory, skill, sessionIdArgument],
    {
      cwd: projectDirectory,
      env: fallbackEnvironment(projectDirectory, sessionEnvironment),
      encoding: 'utf8',
    },
  );
  return { exitCode: result.status ?? 0, output: `${result.stdout}${result.stderr}` };
}

function logContents(projectDirectory: string): string {
  const logPath = nodePath.join(projectDirectory, '.project', 'skill-invocations.log');
  return existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
}

describe('Codex/Cursor skill-invocation fallback → done-gate E2E (#295)', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createTypeScriptPackageJson(projectDirectory);
    initGitRepo(projectDirectory);
    await setupOrThrow(projectDirectory);
  });

  afterAll(() => {
    if (projectDirectory) removeTemporaryDirectory(projectDirectory);
  });

  for (const skill of GATED_SKILLS) {
    it(`records ${skill} under a non-Claude runtime when a session id is supplied explicitly`, () => {
      const sessionId = `codex-${skill}-rec`;
      const { exitCode, output } = runFallback(projectDirectory, skill, sessionId);

      expect(exitCode).toBe(0);
      expect(output).toContain(`${skill} ✓`);
      // The recorded line is session-bound and in the gate-readable format.
      // Mirror the gate's parser (checkSkillInvocations): a gate-readable line
      // is `<timestamp> <session-id> <skill>`. Assert that exact 3-token shape,
      // not a substring, so producer/consumer format drift is caught.
      const recorded = logContents(projectDirectory)
        .split('\n')
        .map(line => line.trim().split(/\s+/))
        .some(tokens => tokens.length >= 3 && tokens[1] === sessionId && tokens[2] === skill);
      expect(recorded).toBe(true);
    });

    it(`degrades gracefully for ${skill} with no session binding (true Codex/Cursor case)`, () => {
      const before = logContents(projectDirectory);
      const { exitCode, output } = runFallback(projectDirectory, skill, '');

      expect(exitCode).toBe(0);
      expect(output.toLowerCase()).toContain('no session id');
      // Nothing recorded — no silent mis-binding to an empty/ambient session.
      expect(logContents(projectDirectory)).toBe(before);
    });
  }

  it('feature done PASSES when verify+audit are recorded from CODEX_THREAD_ID', () => {
    writeFeatureTicketAtDone(projectDirectory, '950');
    const sessionId = 'codex-thread-950';
    const codexEnvironment = { CODEX_THREAD_ID: sessionId };

    runFallback(projectDirectory, 'verify', '', codexEnvironment);
    runFallback(projectDirectory, 'audit', '', codexEnvironment);

    const result = runDoneGate(projectDirectory, sessionId);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain('Required skill invocation');
  });

  it('feature done PASSES the skill gate when verify+audit are recorded via the fallback (non-Claude runtime)', () => {
    writeFeatureTicketAtDone(projectDirectory, '951');
    const sessionId = 'codex-session-951';
    runFallback(projectDirectory, 'verify', sessionId);
    runFallback(projectDirectory, 'audit', sessionId);

    // The gate binds the session from stdin, not env, so the default env is fine
    // here — the non-Claude simulation lives in runFallback's recording.
    const result = runDoneGate(projectDirectory, sessionId);

    // Fallback-recorded proof satisfies the gate — no missing-invocation block.
    // Assert exit code + raw stdout (not `reason`): a hook crash yields an empty
    // reason that would satisfy a negative match vacuously.
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain('Required skill invocation');
  });

  it('feature done FAILS CLOSED with a clear, CLAUDE_SESSION_ID-free message when the fallback cannot bind a session', () => {
    writeFeatureTicketAtDone(projectDirectory, '952');
    // True no-binding: fallback runs but records nothing.
    runFallback(projectDirectory, 'verify', '');
    runFallback(projectDirectory, 'audit', '');

    const result = runDoneGate(projectDirectory, 'codex-session-952');

    expect(result.reason).toContain('/verify');
    expect(result.reason).toContain('/audit');
    expect(result.reason.toLowerCase()).toContain('missing');
    expect(result.reason).toContain('session-scoped proof');
    // HMZSCD: the message is runtime-agnostic, not CLAUDE_SESSION_ID-specific.
    expect(result.reason).not.toContain('CLAUDE_SESSION_ID');
  });
});
