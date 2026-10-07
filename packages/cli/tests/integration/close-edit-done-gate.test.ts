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

// Each test starts from the setup commit: no tickets, commits, or edits leak
// between tests. The ignored counter file survives; tests read it relative to
// a baseline.
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

/** A task ticket (no test-definitions.md) with valid verify.md, not committed. */
function writeTaskTicket(
  directory: string,
  ticketId: string,
  status: string,
  phase = 'implement',
): string {
  const folder = `.project/tickets/${ticketId}`;
  writeTestFile(directory, `${folder}/ticket.md`, ticketMarkdown(ticketId, status, phase));
  writeTestFile(
    directory,
    `${folder}/verify.md`,
    '# Verify\n\n**PR Scope:** ✅ Diff matches ticket scope\n',
  );
  return nodePath.join(directory, folder, 'ticket.md');
}

function commitTaskTicket(directory: string, ticketId: string, status: string): string {
  const ticketFile = writeTaskTicket(directory, ticketId, status);
  git(directory, `add "${nodePath.dirname(ticketFile)}"`);
  git(directory, `commit -q --no-verify -m "ticket ${ticketId}"`);
  return ticketFile;
}

/** Report a tool call on ticket.md to the real PostToolUse hook. */
function runPostToolUse(
  directory: string,
  sessionId: string,
  toolName: 'Edit' | 'MultiEdit' | 'Write',
  toolInput: Record<string, unknown>,
): void {
  const result = spawnSync('bun', ['.safeword/hooks/post-tool-quality.ts'], {
    input: JSON.stringify({
      session_id: sessionId,
      cwd: directory,
      tool_name: toolName,
      tool_input: toolInput,
    }),
    cwd: directory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
    encoding: 'utf8',
  });
  expect(result.status, result.stderr).toBe(0);
}

/** Apply MultiEdit replacements in order to ticket.md, then report them. */
function multiEditTicketThroughPostToolUse(
  directory: string,
  sessionId: string,
  ticketFile: string,
  edits: { old_string: string; new_string: string }[],
): void {
  let content = readFileSync(ticketFile, 'utf8');
  for (const edit of edits) {
    expect(content).toContain(edit.old_string);
    content = content.replace(edit.old_string, () => edit.new_string);
  }
  writeFileSync(ticketFile, content);
  runPostToolUse(directory, sessionId, 'MultiEdit', { file_path: ticketFile, edits });
}

/** Apply one Edit replacement to ticket.md, then report it. */
function replaceInTicketThroughPostToolUse(
  directory: string,
  sessionId: string,
  ticketFile: string,
  oldString: string,
  newString: string,
): void {
  const before = readFileSync(ticketFile, 'utf8');
  expect(before).toContain(oldString);
  writeFileSync(
    ticketFile,
    before.replace(oldString, () => newString),
  );
  runPostToolUse(directory, sessionId, 'Edit', {
    file_path: ticketFile,
    old_string: oldString,
    new_string: newString,
  });
}

/** Replace the whole of ticket.md with one Edit, then report it. */
function editTicketThroughPostToolUse(
  directory: string,
  sessionId: string,
  ticketFile: string,
  replacement: string,
): void {
  const before = readFileSync(ticketFile, 'utf8');
  replaceInTicketThroughPostToolUse(directory, sessionId, ticketFile, before, replacement);
}

/** Overwrite ticket.md with a Write, then report it. */
function writeTicketThroughPostToolUse(
  directory: string,
  sessionId: string,
  ticketFile: string,
  content: string,
): void {
  writeFileSync(ticketFile, content);
  runPostToolUse(directory, sessionId, 'Write', { file_path: ticketFile, content });
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
  /** Commit an in_progress task, then close it through the real PostToolUse hook. */
  function closeCommittedTicket(ticketId: string, sessionId: string): string {
    const ticketFile = commitTaskTicket(fixture.projectDirectory, ticketId, 'in_progress');
    editTicketThroughPostToolUse(
      fixture.projectDirectory,
      sessionId,
      ticketFile,
      ticketMarkdown(ticketId, 'done', 'done'),
    );
    return ticketFile;
  }

  it('blocks the Stop after the close when tests fail', () => {
    const directory = fixture.projectDirectory;
    setTestExitCode(directory, 1);
    const baseline = testRunCount(directory);

    closeCommittedTicket('5546', 'session-block');
    const result = runStopHook(directory, 'session-block');

    expect(result.decision).toBe('block');
    expect(result.reason).toContain('Tests failed');
    expect(recentFailurePatterns(directory, 'session-block')).toContain('done-gate-tests-failed');
    expect(testRunCount(directory)).toBe(baseline + 1);
  });

  it('allows the Stop once tests pass and does not rerun the gate on a later Stop', () => {
    const directory = fixture.projectDirectory;
    closeCommittedTicket('5547', 'session-pass');
    setTestExitCode(directory, 0);
    const baseline = testRunCount(directory);

    const allowed = runStopHook(directory, 'session-pass');
    expect(allowed.decision).toBeUndefined();
    expect(testRunCount(directory)).toBe(baseline + 1);

    setTestExitCode(directory, 1);
    runStopHook(directory, 'session-pass');
    expect(testRunCount(directory)).toBe(baseline + 1);
  });

  it('does not rerun the gate when the closed ticket is edited after a later commit', () => {
    const directory = fixture.projectDirectory;
    const ticketFile = closeCommittedTicket('5548', 'session-commit');
    setTestExitCode(directory, 0);
    runStopHook(directory, 'session-commit');
    git(directory, 'add -A');
    git(directory, 'commit -q --no-verify -m "close 5548"');
    setTestExitCode(directory, 1);
    const baseline = testRunCount(directory);

    editTicketThroughPostToolUse(
      directory,
      'session-commit',
      ticketFile,
      `${ticketMarkdown('5548', 'done', 'done')}\nTypo fix.\n`,
    );
    runStopHook(directory, 'session-commit');

    expect(testRunCount(directory)).toBe(baseline);
  });

  it('does not run the gate when editing a ticket that was already done at HEAD', () => {
    const directory = fixture.projectDirectory;
    const ticketFile = commitTaskTicket(directory, '5549', 'done');
    setTestExitCode(directory, 1);
    const baseline = testRunCount(directory);

    editTicketThroughPostToolUse(
      directory,
      'session-archived',
      ticketFile,
      `${ticketMarkdown('5549', 'done', 'implement')}\nTypo fix.\n`,
    );
    runStopHook(directory, 'session-archived');

    expect(testRunCount(directory)).toBe(baseline);
  });

  it('cancels the owed gate when the closed ticket is reopened before Stop', () => {
    const directory = fixture.projectDirectory;
    const ticketFile = closeCommittedTicket('5550', 'session-reopen');
    setTestExitCode(directory, 1);
    const baseline = testRunCount(directory);

    editTicketThroughPostToolUse(
      directory,
      'session-reopen',
      ticketFile,
      ticketMarkdown('5550', 'in_progress', 'implement'),
    );
    runStopHook(directory, 'session-reopen');

    expect(testRunCount(directory)).toBe(baseline);
  });

  it('gates an uncommitted ticket closed by the session that was working it', () => {
    const directory = fixture.projectDirectory;
    const ticketFile = writeTaskTicket(directory, '5551', 'in_progress');
    editTicketThroughPostToolUse(
      directory,
      'session-new',
      ticketFile,
      `${ticketMarkdown('5551', 'in_progress', 'implement')}\nStarted.\n`,
    );
    setTestExitCode(directory, 1);
    const baseline = testRunCount(directory);

    editTicketThroughPostToolUse(
      directory,
      'session-new',
      ticketFile,
      ticketMarkdown('5551', 'done', 'done'),
    );
    const result = runStopHook(directory, 'session-new');

    expect(result.decision).toBe('block');
    expect(result.reason).toContain('Tests failed');
    expect(testRunCount(directory)).toBe(baseline + 1);
  });

  it('does not rerun the gate when the passed ticket is edited again before any commit', () => {
    const directory = fixture.projectDirectory;
    const ticketFile = closeCommittedTicket('5552', 'session-reedit');
    setTestExitCode(directory, 0);
    runStopHook(directory, 'session-reedit');
    setTestExitCode(directory, 1);
    const baseline = testRunCount(directory);

    editTicketThroughPostToolUse(
      directory,
      'session-reedit',
      ticketFile,
      `${ticketMarkdown('5552', 'done', 'done')}\nTypo fix.\n`,
    );
    runStopHook(directory, 'session-reedit');

    expect(testRunCount(directory)).toBe(baseline);
  });

  it('gates every ticket closed before a single Stop', () => {
    const directory = fixture.projectDirectory;
    closeCommittedTicket('5553', 'session-two');
    const secondTicket = closeCommittedTicket('5554', 'session-two');
    rmSync(nodePath.join(nodePath.dirname(secondTicket), 'verify.md'));
    setTestExitCode(directory, 0);
    const baseline = testRunCount(directory);

    const first = runStopHook(directory, 'session-two');
    expect(testRunCount(directory)).toBe(baseline + 1);
    expect(first.decision).toBe('block');
    expect(first.reason).toContain('5554');

    const second = runStopHook(directory, 'session-two');
    expect(testRunCount(directory)).toBe(baseline + 2);
    expect(second.decision).toBe('block');
    expect(second.reason).toContain('verify.md');
  });

  it('gates a ticket done at HEAD that this session reopened and closed again', () => {
    const directory = fixture.projectDirectory;
    const ticketFile = commitTaskTicket(directory, '5555', 'done');
    editTicketThroughPostToolUse(
      directory,
      'session-reclose',
      ticketFile,
      ticketMarkdown('5555', 'in_progress', 'implement'),
    );
    setTestExitCode(directory, 1);
    const baseline = testRunCount(directory);

    editTicketThroughPostToolUse(
      directory,
      'session-reclose',
      ticketFile,
      ticketMarkdown('5555', 'done', 'done'),
    );
    const result = runStopHook(directory, 'session-reclose');

    expect(result.decision).toBe('block');
    expect(result.reason).toContain('Tests failed');
    expect(testRunCount(directory)).toBe(baseline + 1);
  });

  it('gates an uncommitted ticket whose closing edit is the first one this session sees', () => {
    const directory = fixture.projectDirectory;
    const ticketFile = writeTaskTicket(directory, '5558', 'in_progress');
    setTestExitCode(directory, 1);
    const baseline = testRunCount(directory);

    editTicketThroughPostToolUse(
      directory,
      'session-resumed',
      ticketFile,
      ticketMarkdown('5558', 'done', 'done'),
    );
    const result = runStopHook(directory, 'session-resumed');

    expect(result.decision).toBe('block');
    expect(result.reason).toContain('Tests failed');
    expect(testRunCount(directory)).toBe(baseline + 1);
  });

  it('gates an uncommitted ticket closed by a partial status edit seen first this session', () => {
    const directory = fixture.projectDirectory;
    const ticketFile = writeTaskTicket(directory, '5559', 'in_progress');
    setTestExitCode(directory, 1);
    const baseline = testRunCount(directory);

    replaceInTicketThroughPostToolUse(
      directory,
      'session-partial',
      ticketFile,
      'status: in_progress',
      'status: done',
    );
    const result = runStopHook(directory, 'session-partial');

    expect(result.decision).toBe('block');
    expect(result.reason).toContain('Tests failed');
    expect(testRunCount(directory)).toBe(baseline + 1);
  });

  it('does not owe the gate for an edit after Stop itself completed the ticket', () => {
    const directory = fixture.projectDirectory;
    const ticketFile = commitTaskTicket(directory, '5560', 'in_progress');
    replaceInTicketThroughPostToolUse(
      directory,
      'session-stop-completes',
      ticketFile,
      'phase: implement',
      'phase: done',
    );
    setTestExitCode(directory, 0);
    runStopHook(directory, 'session-stop-completes');
    expect(readFileSync(ticketFile, 'utf8')).toContain('status: done');
    setTestExitCode(directory, 1);
    const baseline = testRunCount(directory);

    replaceInTicketThroughPostToolUse(
      directory,
      'session-stop-completes',
      ticketFile,
      '# Task 5560',
      '# Task 5560 (typo fixed)',
    );
    runStopHook(directory, 'session-stop-completes');

    expect(testRunCount(directory)).toBe(baseline);
  });

  it('gates a first-seen close whose replaced text appears twice in the ticket', () => {
    const directory = fixture.projectDirectory;
    const ticketFile = writeTaskTicket(directory, '5561', 'in_progress', 'done');
    setTestExitCode(directory, 1);
    const baseline = testRunCount(directory);

    replaceInTicketThroughPostToolUse(
      directory,
      'session-ambiguous',
      ticketFile,
      'in_progress',
      'done',
    );
    const result = runStopHook(directory, 'session-ambiguous');

    expect(result.decision).toBe('block');
    expect(result.reason).toContain('Tests failed');
    expect(testRunCount(directory)).toBe(baseline + 1);
  });

  it('gates a close edit after the ticket was reopened outside an edit', () => {
    const directory = fixture.projectDirectory;
    const ticketFile = closeCommittedTicket('5562', 'session-shell-reopen');
    setTestExitCode(directory, 0);
    runStopHook(directory, 'session-shell-reopen');
    git(directory, 'add -A');
    git(directory, 'commit -q --no-verify -m "close 5562"');
    writeFileSync(ticketFile, ticketMarkdown('5562', 'in_progress', 'implement'));
    setTestExitCode(directory, 1);
    const baseline = testRunCount(directory);

    replaceInTicketThroughPostToolUse(
      directory,
      'session-shell-reopen',
      ticketFile,
      'status: in_progress',
      'status: done',
    );
    const result = runStopHook(directory, 'session-shell-reopen');

    expect(result.decision).toBe('block');
    expect(result.reason).toContain('Tests failed');
    expect(testRunCount(directory)).toBe(baseline + 1);
  });

  it('gates an ambiguous close edit after the ticket was reopened outside an edit', () => {
    const directory = fixture.projectDirectory;
    const ticketFile = closeCommittedTicket('5563', 'session-stale');
    setTestExitCode(directory, 0);
    runStopHook(directory, 'session-stale');
    writeFileSync(ticketFile, ticketMarkdown('5563', 'in_progress', 'done'));
    setTestExitCode(directory, 1);
    const baseline = testRunCount(directory);

    replaceInTicketThroughPostToolUse(
      directory,
      'session-stale',
      ticketFile,
      'in_progress',
      'done',
    );
    const result = runStopHook(directory, 'session-stale');

    expect(result.decision).toBe('block');
    expect(result.reason).toContain('Tests failed');
    expect(testRunCount(directory)).toBe(baseline + 1);
  });

  it('gates an uncommitted ticket closed by a Write seen first this session', () => {
    const directory = fixture.projectDirectory;
    const ticketFile = writeTaskTicket(directory, '5564', 'in_progress');
    setTestExitCode(directory, 1);
    const baseline = testRunCount(directory);

    writeTicketThroughPostToolUse(
      directory,
      'session-write',
      ticketFile,
      ticketMarkdown('5564', 'done', 'done'),
    );
    const result = runStopHook(directory, 'session-write');

    expect(result.decision).toBe('block');
    expect(result.reason).toContain('Tests failed');
    expect(testRunCount(directory)).toBe(baseline + 1);
  });

  it('gates a Write close after the ticket was reopened outside an edit', () => {
    const directory = fixture.projectDirectory;
    const ticketFile = closeCommittedTicket('5566', 'session-write-reopen');
    setTestExitCode(directory, 0);
    runStopHook(directory, 'session-write-reopen');
    writeFileSync(ticketFile, ticketMarkdown('5566', 'in_progress', 'implement'));
    setTestExitCode(directory, 1);
    const baseline = testRunCount(directory);

    writeTicketThroughPostToolUse(
      directory,
      'session-write-reopen',
      ticketFile,
      ticketMarkdown('5566', 'done', 'done'),
    );
    const result = runStopHook(directory, 'session-write-reopen');

    expect(result.decision).toBe('block');
    expect(result.reason).toContain('Tests failed');
    expect(testRunCount(directory)).toBe(baseline + 1);
  });

  it('gates a close assembled from partial MultiEdit replacements', () => {
    const directory = fixture.projectDirectory;
    const ticketFile = writeTaskTicket(directory, '5565', 'wontfix');
    setTestExitCode(directory, 1);
    const baseline = testRunCount(directory);

    multiEditTicketThroughPostToolUse(directory, 'session-multiedit', ticketFile, [
      { old_string: 'wont', new_string: 'don' },
      { old_string: 'fix', new_string: 'e' },
    ]);
    const result = runStopHook(directory, 'session-multiedit');

    expect(readFileSync(ticketFile, 'utf8')).toContain('status: done');
    expect(result.decision).toBe('block');
    expect(result.reason).toContain('Tests failed');
    expect(testRunCount(directory)).toBe(baseline + 1);
  });
});
