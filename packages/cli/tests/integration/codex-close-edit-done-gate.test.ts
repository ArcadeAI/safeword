/**
 * Integration: on Codex, closing a ticket by edit still owes the Stop done gate (#5633)
 *
 * Drives the real `safeword hook codex post-tool-use` with an Edit that flips a
 * task ticket to `status: done`, then the real `safeword hook codex stop`.
 * PostToolUse records the close under the Codex run identity; Codex Stop must
 * run the done gate for it under that same identity — whether the identity
 * comes from the payload's session_id or, when Codex omits it, CODEX_THREAD_ID.
 *
 * The fixture's test script appends a line to a counter file on every run, so
 * the counter proves exactly how many times the done gate ran its tests.
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  initGitRepo,
  INSTALL_DEPENDENCIES_ENV,
  removeTemporaryDirectory,
  setupOrThrow,
  testCliPath,
  writeTestFile,
} from '../helpers.js';

const fixture: { projectDirectory: string; setupCommit: string } = {
  projectDirectory: '',
  setupCommit: '',
};

const COUNTER_FILE = 'test-runs.txt';
const EXIT_CODE_FILE = 'test-exit-code.txt';

beforeAll(async () => {
  fixture.projectDirectory = createTemporaryDirectory();
  createTypeScriptPackageJson(fixture.projectDirectory, {
    scripts: { test: 'sh ./count-test-run.sh' },
  });
  writeTestFile(
    fixture.projectDirectory,
    'count-test-run.sh',
    `echo run >> ${COUNTER_FILE}\nexit "$(cat ${EXIT_CODE_FILE})"\n`,
  );
  writeTestFile(fixture.projectDirectory, '.gitignore', `${COUNTER_FILE}\n${EXIT_CODE_FILE}\n`);
  initGitRepo(fixture.projectDirectory);
  git(fixture.projectDirectory, 'config gc.auto 0');
  git(fixture.projectDirectory, 'config maintenance.auto false');
  await setupOrThrow(fixture.projectDirectory, ['setup', '--yes'], {
    env: INSTALL_DEPENDENCIES_ENV,
  });
  git(fixture.projectDirectory, 'add -A');
  git(fixture.projectDirectory, 'commit -q --no-verify -m setup');
  fixture.setupCommit = execSync('git rev-parse HEAD', {
    cwd: fixture.projectDirectory,
    encoding: 'utf8',
  }).trim();
});

afterEach(() => {
  git(fixture.projectDirectory, `reset -q --hard ${fixture.setupCommit}`);
  git(fixture.projectDirectory, 'clean -q -fd');
});

afterAll(() => {
  if (fixture.projectDirectory) removeTemporaryDirectory(fixture.projectDirectory);
});

function git(directory: string, arguments_: string): void {
  execSync(`git ${arguments_}`, { cwd: directory, stdio: 'pipe' });
}

function setTestExitCode(directory: string, code: number): void {
  writeFileSync(nodePath.join(directory, EXIT_CODE_FILE), `${code}\n`);
}

function testRunCount(directory: string): number {
  const counter = nodePath.join(directory, COUNTER_FILE);
  if (!existsSync(counter)) return 0;
  return readFileSync(counter, 'utf8').split('\n').filter(Boolean).length;
}

function ticketMarkdown(ticketId: string, status: string, phase: string): string {
  return `---\nid: ${ticketId}\ntype: task\nphase: ${phase}\nstatus: ${status}\nlast_modified: 2026-01-06T10:00:00Z\n---\n# Task ${ticketId}\n`;
}

/** Commit an in_progress task ticket with a valid verify.md. */
function commitTaskTicket(directory: string, ticketId: string): string {
  const folder = `.project/tickets/${ticketId}`;
  writeTestFile(
    directory,
    `${folder}/ticket.md`,
    ticketMarkdown(ticketId, 'in_progress', 'implement'),
  );
  writeTestFile(
    directory,
    `${folder}/verify.md`,
    '# Verify\n\n**PR Scope:** ✅ Diff matches ticket scope\n',
  );
  git(directory, `add "${folder}"`);
  git(directory, `commit -q --no-verify -m "ticket ${ticketId}"`);
  return nodePath.join(directory, folder, 'ticket.md');
}

/**
 * How Codex identifies the run: in the payload's session_id, or — when Codex
 * Desktop omits it — only through CODEX_THREAD_ID in the hook environment.
 */
interface CodexRun {
  payload: { session_id?: string };
  env: Record<string, string>;
}

const RUNS: Record<string, (id: string) => CodexRun> = {
  'payload session_id': id => ({ payload: { session_id: id }, env: {} }),
  'CODEX_THREAD_ID only': id => ({ payload: {}, env: { CODEX_THREAD_ID: id } }),
};

// Only the run under test may supply an identity: an ambient Claude or Codex id
// leaking in from the harness would mask the missing-session_id case.
function codexEnvironment(directory: string, run: CodexRun): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env, CLAUDE_PROJECT_DIR: directory };
  delete environment.CLAUDE_SESSION_ID;
  delete environment.CLAUDE_CODE_SESSION_ID;
  delete environment.CODEX_THREAD_ID;
  delete environment.SAFEWORD_AGENT_RUNTIME;
  return Object.assign(environment, run.env);
}

function runCodexHook(
  directory: string,
  run: CodexRun,
  event: 'post-tool-use' | 'stop',
  payload: Record<string, unknown>,
): string {
  const result = spawnSync(process.execPath, [testCliPath, 'hook', 'codex', event], {
    cwd: directory,
    input: JSON.stringify({ ...run.payload, cwd: directory, ...payload }),
    env: codexEnvironment(directory, run),
    encoding: 'utf8',
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}

/** Close the ticket with one Edit, reported through Codex PostToolUse. */
function closeThroughCodexPostToolUse(directory: string, run: CodexRun, ticketFile: string): void {
  const before = readFileSync(ticketFile, 'utf8');
  writeFileSync(ticketFile, before.replace('status: in_progress', 'status: done'));
  runCodexHook(directory, run, 'post-tool-use', {
    tool_name: 'Edit',
    tool_input: {
      file_path: ticketFile,
      old_string: 'status: in_progress',
      new_string: 'status: done',
    },
  });
}

function runCodexStop(directory: string, run: CodexRun): { decision?: string; reason?: string } {
  const stdout = runCodexHook(directory, run, 'stop', { stop_hook_active: false });
  return JSON.parse(stdout.trim()) as { decision?: string; reason?: string };
}

describe.each(Object.entries(RUNS))(
  'Codex Stop runs the done gate owed by a close-by-edit (%s)',
  (_label, makeRun) => {
    it('blocks the Stop after the close when tests fail', () => {
      const directory = fixture.projectDirectory;
      const run = makeRun('thread-block');
      const ticketFile = commitTaskTicket(directory, '5633');
      setTestExitCode(directory, 1);
      const baseline = testRunCount(directory);

      closeThroughCodexPostToolUse(directory, run, ticketFile);
      const result = runCodexStop(directory, run);

      expect(result.decision).toBe('block');
      expect(result.reason).toContain('Tests failed');
      expect(testRunCount(directory)).toBe(baseline + 1);
    });

    it('keeps the gate owed until every check passes, then settles it', () => {
      const directory = fixture.projectDirectory;
      const run = makeRun('thread-retry');
      const ticketFile = commitTaskTicket(directory, '5634');
      const verifyFile = nodePath.join(nodePath.dirname(ticketFile), 'verify.md');
      const verifyContent = readFileSync(verifyFile, 'utf8');
      setTestExitCode(directory, 1);
      const baseline = testRunCount(directory);

      closeThroughCodexPostToolUse(directory, run, ticketFile);
      expect(runCodexStop(directory, run).reason).toContain('Tests failed');
      expect(runCodexStop(directory, run).reason).toContain('Tests failed');
      expect(testRunCount(directory)).toBe(baseline + 2);

      setTestExitCode(directory, 0);
      rmSync(verifyFile);
      expect(runCodexStop(directory, run).reason).toContain('verify.md');
      expect(testRunCount(directory)).toBe(baseline + 3);

      writeFileSync(verifyFile, verifyContent);
      expect(runCodexStop(directory, run).reason ?? '').not.toMatch(/Tests failed|verify\.md/);
      expect(testRunCount(directory)).toBe(baseline + 4);

      setTestExitCode(directory, 1);
      runCodexStop(directory, run);
      expect(testRunCount(directory)).toBe(baseline + 4);
    });
  },
);
