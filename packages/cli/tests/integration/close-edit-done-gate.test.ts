/**
 * Integration: closing a ticket by edit still owes the Stop done gate (#5546)
 *
 * Drives the REAL PostToolUse hook with an Edit that flips a task ticket to
 * `status: done`, then the real Stop hook. PostToolUse clears the session's
 * activeTicket on close, so Stop must still run the done gate for the ticket
 * that was just closed — once, until every check passes.
 *
 * The fixture's test script appends a line to a counter file on every run, so
 * the counter proves exactly how many times the done gate ran its tests.
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  initGitRepo,
  INSTALL_DEPENDENCIES_ENV,
  removeTemporaryDirectory,
  setupOrThrow,
  writeTestFile,
} from '../helpers.js';

const fixture: { projectDirectory: string } = { projectDirectory: '' };

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
  await setupOrThrow(fixture.projectDirectory, ['setup', '--yes'], {
    env: INSTALL_DEPENDENCIES_ENV,
  });
  git(fixture.projectDirectory, 'add -A');
  git(fixture.projectDirectory, 'commit -q --no-verify -m setup');
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

/** A committed task ticket (no test-definitions.md) with valid verify.md. */
function commitTaskTicket(directory: string, ticketId: string, status: string): string {
  const folder = `.project/tickets/${ticketId}`;
  writeTestFile(directory, `${folder}/ticket.md`, ticketMarkdown(ticketId, status, 'implement'));
  writeTestFile(
    directory,
    `${folder}/verify.md`,
    '# Verify\n\n**PR Scope:** ✅ Diff matches ticket scope\n',
  );
  git(directory, `add "${folder}"`);
  git(directory, `commit -q --no-verify -m "ticket ${ticketId}"`);
  return nodePath.join(directory, folder, 'ticket.md');
}

/** Rewrite ticket.md on disk, then report the Edit to the real PostToolUse hook. */
function editTicketThroughPostToolUse(
  directory: string,
  sessionId: string,
  ticketFile: string,
  replacement: string,
): void {
  const before = readFileSync(ticketFile, 'utf8');
  writeFileSync(ticketFile, replacement);
  const result = spawnSync('bun', ['.safeword/hooks/post-tool-quality.ts'], {
    input: JSON.stringify({
      session_id: sessionId,
      cwd: directory,
      tool_name: 'Edit',
      tool_input: { file_path: ticketFile, old_string: before, new_string: replacement },
    }),
    cwd: directory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
    encoding: 'utf8',
  });
  expect(result.status, result.stderr).toBe(0);
}

function runStopHook(directory: string, sessionId: string): { decision?: string; reason: string } {
  const transcriptPath = nodePath.join(directory, 'transcript.jsonl');
  writeFileSync(
    transcriptPath,
    `${JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Closed the ticket.' },
          { type: 'tool_use', name: 'Edit' },
        ],
      },
    })}\n`,
  );
  const result = spawnSync('bun', ['.safeword/hooks/stop-quality.ts'], {
    input: JSON.stringify({ transcript_path: transcriptPath, session_id: sessionId }),
    cwd: directory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
    encoding: 'utf8',
  });
  const stdout = result.stdout.trim();
  if (stdout === '') return { reason: '' };
  const parsed = JSON.parse(stdout) as { decision?: string; reason?: string };
  return { decision: parsed.decision, reason: parsed.reason ?? '' };
}

function recentFailurePatterns(directory: string, sessionId: string): string[] {
  const state = JSON.parse(
    readFileSync(nodePath.join(directory, '.project', `quality-state-${sessionId}.json`), 'utf8'),
  ) as { recentFailures?: { pattern: string }[] };
  return (state.recentFailures ?? []).map(failure => failure.pattern);
}

describe('closing a ticket by edit owes the Stop done gate (#5546)', () => {
  it('blocks on failing tests, allows once they pass, and does not rerun', () => {
    const directory = fixture.projectDirectory;
    const sessionId = 'session-close-5546';
    const ticketFile = commitTaskTicket(directory, '5546', 'in_progress');
    setTestExitCode(directory, 1);
    const baseline = testRunCount(directory);

    editTicketThroughPostToolUse(
      directory,
      sessionId,
      ticketFile,
      ticketMarkdown('5546', 'done', 'done'),
    );

    const blocked = runStopHook(directory, sessionId);
    expect(blocked.decision).toBe('block');
    expect(blocked.reason).toContain('Tests failed');
    expect(recentFailurePatterns(directory, sessionId)).toContain('done-gate-tests-failed');
    expect(testRunCount(directory)).toBe(baseline + 1);

    setTestExitCode(directory, 0);
    const allowed = runStopHook(directory, sessionId);
    expect(allowed.decision).toBeUndefined();
    expect(testRunCount(directory)).toBe(baseline + 2);

    runStopHook(directory, sessionId);
    expect(testRunCount(directory)).toBe(baseline + 2);

    // A later commit of the close, then another edit of the now-done ticket,
    // must not re-arm the gate.
    git(directory, 'add -A');
    git(directory, 'commit -q --no-verify -m "close 5546"');
    editTicketThroughPostToolUse(
      directory,
      sessionId,
      ticketFile,
      `${ticketMarkdown('5546', 'done', 'done')}\nTypo fix.\n`,
    );
    runStopHook(directory, sessionId);
    expect(testRunCount(directory)).toBe(baseline + 2);
  });

  it('does not run the gate when editing a ticket that was already done at HEAD', () => {
    const directory = fixture.projectDirectory;
    const sessionId = 'session-archived-5546';
    const ticketFile = commitTaskTicket(directory, '5547', 'done');
    setTestExitCode(directory, 1);
    const baseline = testRunCount(directory);

    editTicketThroughPostToolUse(
      directory,
      sessionId,
      ticketFile,
      `${ticketMarkdown('5547', 'done', 'implement')}\nTypo fix.\n`,
    );

    const result = runStopHook(directory, sessionId);
    expect(result.reason).not.toContain('Tests failed');
    expect(testRunCount(directory)).toBe(baseline);
  });
});
