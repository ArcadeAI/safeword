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
 *      bound by a runtime's pre-shell hook (the Codex PreToolUse / Cursor
 *      beforeShellExecution cache bridge), and degrades gracefully (exit 0,
 *      nothing recorded) when none is — so a runtime never silently mis-binds.
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
  repoRoot,
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

function runFallbackShell(
  projectDirectory: string,
  command: string,
): { exitCode: number; output: string } {
  const result = spawnSync('bash', ['-c', command], {
    cwd: projectDirectory,
    env: fallbackEnvironment(projectDirectory),
    encoding: 'utf8',
  });
  return { exitCode: result.status ?? 0, output: `${result.stdout}${result.stderr}` };
}

function logContents(projectDirectory: string): string {
  const logPath = nodePath.join(projectDirectory, '.project', 'skill-invocations.log');
  return existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
}

// Drive the real Codex PreToolUse hook with the upcoming record-skill command,
// exactly as Codex would right before running it. The hook binds session_id into
// the short-lived cache the fallback then reads — no env var, no explicit arg.
function bindCodexSession(projectDirectory: string, skill: string, sessionId: string): void {
  const command = `bun "${projectDirectory}/.safeword/hooks/record-skill-invocation.ts" "${projectDirectory}" ${skill}`;
  bindCodexSessionForCommand(projectDirectory, command, sessionId);
}

function bindCodexSessionForCommand(
  projectDirectory: string,
  command: string,
  sessionId: string,
): void {
  const result = spawnSync(
    process.execPath,
    [nodePath.join(repoRoot, 'packages/cli/dist/cli.js'), 'hook', 'codex', 'pre-tool-use'],
    {
      cwd: projectDirectory,
      input: JSON.stringify({
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: { command },
      }),
      env: fallbackEnvironment(projectDirectory),
      encoding: 'utf8',
    },
  );
  expect(result.status ?? 0).toBe(0);
}

// Cursor invokes its installed beforeShellExecution adapter directly. Feed it
// the same pre-execution command and then run the real fallback shell command
// so this exercises the adapter → queue → helper handoff, rather than writing
// a receipt or cache file in the test.
function bindCursorConversationForCommand(
  projectDirectory: string,
  command: string,
  conversationId: string,
): void {
  const result = spawnSync('bun', ['.safeword/hooks/cursor/before-shell-execution.ts'], {
    cwd: projectDirectory,
    input: JSON.stringify({
      conversation_id: conversationId,
      command,
      workspace_roots: [projectDirectory],
    }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  expect(result.status ?? 0, `${result.stdout}${result.stderr}`).toBe(0);
  expect(result.stdout).toContain('"permission":"allow"');
}

type RuntimeBridge = {
  name: 'Codex' | 'Cursor';
  bind: (projectDirectory: string, command: string, sessionId: string) => void;
};

const RUNTIME_BRIDGES: RuntimeBridge[] = [
  { name: 'Codex', bind: bindCodexSessionForCommand },
  { name: 'Cursor', bind: bindCursorConversationForCommand },
];
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
      expect(output.toLowerCase()).toContain('no run identity');
      // Nothing recorded — no silent mis-binding to an empty/ambient session.
      expect(logContents(projectDirectory)).toBe(before);
    });
  }

  it('feature done PASSES when verify+audit are recorded via the Codex PreToolUse bridge', () => {
    writeFeatureTicketAtDone(projectDirectory, '950');
    const sessionId = 'codex-session-950';

    // Each skill: the PreToolUse hook binds session_id, then the fallback runs
    // with no explicit id and no env var — reading the bound id from the cache.
    for (const skill of ['verify', 'audit'] as const) {
      bindCodexSession(projectDirectory, skill, sessionId);
      runFallback(projectDirectory, skill, '');
    }

    const result = runDoneGate(projectDirectory, sessionId);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain('Required skill invocation');
  });

  for (const runtime of RUNTIME_BRIDGES) {
    it(`records the complete documented automatic skill line through ${runtime.name}`, () => {
      const sessionId = `${runtime.name.toLowerCase()}-automatic-line`;
      const command = [
        'PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"',
        'bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" audit "${CLAUDE_SESSION_ID:-}"',
      ].join(' && ');
      const automaticLine = `${command} || echo "[skill-invocation-log] FAILED - no current-run proof logged"`;

      runtime.bind(projectDirectory, automaticLine, sessionId);
      const result = runFallbackShell(projectDirectory, automaticLine);

      expect(result.exitCode, result.output).toBe(0);
      expect(result.output).toContain('audit ✓');
      expect(logContents(projectDirectory)).toContain(`${sessionId} audit`);
    });

    it(`records a documented relative helper through ${runtime.name}`, () => {
      const sessionId = `${runtime.name.toLowerCase()}-relative-single`;
      const command = `bun .safeword/hooks/record-skill-invocation.ts "${projectDirectory}" verify`;

      runtime.bind(projectDirectory, command, sessionId);
      const result = runFallbackShell(projectDirectory, command);

      expect(result.exitCode, result.output).toBe(0);
      expect(result.output).toContain('verify ✓');
      expect(logContents(projectDirectory)).toContain(`${sessionId} verify`);
    });

    it(`records the installed absolute helper through ${runtime.name}`, () => {
      const sessionId = `${runtime.name.toLowerCase()}-absolute-single`;
      const helper = nodePath.join(
        projectDirectory,
        '.safeword',
        'hooks',
        'record-skill-invocation.ts',
      );
      const command = `bun "${helper}" "${projectDirectory}" audit`;

      runtime.bind(projectDirectory, command, sessionId);
      const result = runFallbackShell(projectDirectory, command);

      expect(result.exitCode, result.output).toBe(0);
      expect(result.output).toContain('audit ✓');
      expect(logContents(projectDirectory)).toContain(`${sessionId} audit`);
    });

    it(`records each documented relative-path helper in an ordered ${runtime.name} shell chain`, () => {
      const sessionId = `${runtime.name.toLowerCase()}-relative-chain`;
      const helper = '.safeword/hooks/record-skill-invocation.ts';
      const command = `bun ${helper} "${projectDirectory}" verify && bun ${helper} "${projectDirectory}" audit`;

      // The runtime observes the entire upcoming shell command once; the two
      // real helper processes must each consume only their own receipt.
      runtime.bind(projectDirectory, command, sessionId);
      const result = runFallbackShell(projectDirectory, command);

      expect(result.exitCode, result.output).toBe(0);
      expect(result.output).toContain('verify ✓');
      expect(result.output).toContain('audit ✓');
      const log = logContents(projectDirectory);
      const verifyIndex = log.indexOf(`${sessionId} verify`);
      expect(verifyIndex).toBeGreaterThanOrEqual(0);
      expect(log.indexOf(`${sessionId} audit`)).toBeGreaterThan(verifyIndex);
    });

    it(`records each repeated helper through ${runtime.name}`, () => {
      const sessionId = `${runtime.name.toLowerCase()}-repeated-chain`;
      const helper = '.safeword/hooks/record-skill-invocation.ts';
      const command = `bun ${helper} "${projectDirectory}" verify && bun ${helper} "${projectDirectory}" verify`;

      runtime.bind(projectDirectory, command, sessionId);
      const result = runFallbackShell(projectDirectory, command);

      expect(result.exitCode, result.output).toBe(0);
      const records = logContents(projectDirectory)
        .split('\n')
        .filter(line => line.includes(`${sessionId} verify`));
      expect(records).toHaveLength(2);
    });

    it(`does not arm a short-circuited ${runtime.name} chain tail`, () => {
      const sessionId = `${runtime.name.toLowerCase()}-short-circuit`;
      const helper = '.safeword/hooks/record-skill-invocation.ts';
      const command = `bun ${helper} "${projectDirectory}" verify && false && bun ${helper} "${projectDirectory}" audit`;

      runtime.bind(projectDirectory, command, sessionId);
      const chained = runFallbackShell(projectDirectory, command);
      expect(chained.exitCode).toBe(1);
      expect(logContents(projectDirectory)).toContain(`${sessionId} verify`);

      const audit = runFallback(projectDirectory, 'audit', '');
      expect(audit.output.toLowerCase()).toContain('no run identity');
      expect(logContents(projectDirectory)).not.toContain(`${sessionId} audit`);
    });

    it(`does not arm ${runtime.name} from a foreign-root helper path`, () => {
      const sessionId = `${runtime.name.toLowerCase()}-foreign-root`;
      const foreignCommand = `bun /other/.safeword/hooks/record-skill-invocation.ts "${projectDirectory}" audit`;
      const realCommand = `bun .safeword/hooks/record-skill-invocation.ts "${projectDirectory}" audit`;

      runtime.bind(projectDirectory, foreignCommand, sessionId);
      const audit = runFallbackShell(projectDirectory, realCommand);

      expect(audit.output.toLowerCase()).toContain('no run identity');
      expect(logContents(projectDirectory)).not.toContain(`${sessionId} audit`);
    });

    it(`does not arm ${runtime.name} from a lookalike helper path`, () => {
      const sessionId = `${runtime.name.toLowerCase()}-lookalike`;
      const lookalikeCommand = `bun .safeword/hooks/record-skill-invocation.ts.bak "${projectDirectory}" audit`;
      const realCommand = `bun .safeword/hooks/record-skill-invocation.ts "${projectDirectory}" audit`;

      runtime.bind(projectDirectory, lookalikeCommand, sessionId);
      const audit = runFallbackShell(projectDirectory, realCommand);

      expect(audit.output.toLowerCase()).toContain('no run identity');
      expect(logContents(projectDirectory)).not.toContain(`${sessionId} audit`);
    });

    it(`does not record a ${runtime.name} helper without a session identity`, () => {
      const command = `bun .safeword/hooks/record-skill-invocation.ts "${projectDirectory}" verify`;

      runtime.bind(projectDirectory, command, '');
      const result = runFallbackShell(projectDirectory, command);

      expect(result.output.toLowerCase()).toContain('no run identity');
    });
  }

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
