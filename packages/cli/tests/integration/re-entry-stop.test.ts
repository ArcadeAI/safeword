/**
 * Integration test: stop-reentry hook writes a re-entry.md line.
 *
 * Ticket 645W8H. Slice 1 walking skeleton.
 *
 * Covers Rule 1 — Stop hook records intent when present, skips otherwise.
 * Scenario: assistant message ends with `**Next:** commit and PR` →
 *           <namespace-root>/re-entry.md gains one new line containing
 *           "Next: commit and PR" and the hook-injected session_id.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory, TIMEOUT_QUICK } from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const STOP_REENTRY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/stop-reentry.ts');

function makeTranscript(directory: string, lastAssistantMessage: string): string {
  const transcriptLine = JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: lastAssistantMessage }],
    },
  });
  const transcriptPath = nodePath.join(directory, 'transcript.jsonl');
  writeFileSync(transcriptPath, transcriptLine);
  return transcriptPath;
}

function runStopReentryHook(directory: string, transcriptPath: string, sessionId: string) {
  return spawnSync('bun', [STOP_REENTRY], {
    input: JSON.stringify({
      session_id: sessionId,
      transcript_path: transcriptPath,
      cwd: directory,
    }),
    cwd: directory,
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

describe('stop-reentry hook — Rule 1: records intent when present', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
    // Seed a .git marker so resolveProjectRoot anchors to projectDirectory.
    // Mirrors real-world conditions — safeword hooks run inside git repos.
    mkdirSync(nodePath.join(projectDirectory, '.git'), { recursive: true });
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('writes a re-entry.md line when assistant message ends with **Next:** imperative', () => {
    const transcriptPath = makeTranscript(
      projectDirectory,
      'Did some work.\n\n**Next:** commit and PR',
    );

    const result = runStopReentryHook(projectDirectory, transcriptPath, 'sess_test_abc');

    expect(result.status).toBe(0);

    const logPath = nodePath.join(projectDirectory, '.project', 're-entry.md');
    expect(existsSync(logPath)).toBe(true);

    const logContent = readFileSync(logPath, 'utf8');
    expect(logContent).toContain('Next: commit and PR');
    expect(logContent).toContain('sess_test_abc');
  });

  it('writes nothing when the assistant message has no **Next:** line', () => {
    const transcriptPath = makeTranscript(
      projectDirectory,
      'Plain narrative reply with no call-to-action at the end.',
    );

    const result = runStopReentryHook(projectDirectory, transcriptPath, 'sess_test_noop');

    expect(result.status).toBe(0);

    const logPath = nodePath.join(projectDirectory, '.project', 're-entry.md');
    expect(existsSync(logPath)).toBe(false);
  });

  it('writes nothing when the **Next:** line has only whitespace after the bold preface', () => {
    const transcriptPath = makeTranscript(projectDirectory, 'Wrap-up paragraph.\n\n**Next:**   ');

    const result = runStopReentryHook(projectDirectory, transcriptPath, 'sess_test_empty');

    expect(result.status).toBe(0);

    const logPath = nodePath.join(projectDirectory, '.project', 're-entry.md');
    expect(existsSync(logPath)).toBe(false);
  });

  it('uses hook-supplied session_id even when assistant text contains a deceptive one', () => {
    const transcriptPath = makeTranscript(
      projectDirectory,
      'I am session_id=DECEPTIVE123 just kidding.\n\n**Next:** verify the line shows the real id',
    );

    const beforeWriteMs = Date.now();
    const result = runStopReentryHook(projectDirectory, transcriptPath, 'sess_actual_xyz');
    const afterWriteMs = Date.now();

    expect(result.status).toBe(0);

    const logPath = nodePath.join(projectDirectory, '.project', 're-entry.md');
    const line = readFileSync(logPath, 'utf8').trim();

    // session_id must be the one from stdin, not the deceptive string in the text.
    expect(line).toContain('sess_actual_xyz');
    expect(line).not.toContain('DECEPTIVE123');

    // Timestamp must be the wall clock at write time (ISO-8601, within a 1s tolerance).
    // Split-and-parse rather than one big regex — the chained-bounded-quantifier
    // form trips the unsafe-regex linter false-positive even though it's safe.
    const [timestamp] = line.split(' ');
    if (timestamp === undefined || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(timestamp)) {
      throw new Error(`Log line missing ISO-8601 timestamp prefix: ${line}`);
    }
    const writtenMs = Date.parse(timestamp);
    expect(writtenMs).toBeGreaterThanOrEqual(beforeWriteMs - 1000);
    expect(writtenMs).toBeLessThanOrEqual(afterWriteMs + 1000);
  });

  it('renders ticket=∅/freeform sentinel when no active ticket exists in this worktree', () => {
    const transcriptPath = makeTranscript(projectDirectory, 'Done.\n\n**Next:** carry on');

    const result = runStopReentryHook(projectDirectory, transcriptPath, 'sess_no_ticket');
    expect(result.status).toBe(0);

    const logPath = nodePath.join(projectDirectory, '.project', 're-entry.md');
    const line = readFileSync(logPath, 'utf8').trim();

    expect(line).toContain('ticket=∅/freeform');
    expect(line).toMatch(/ Next: carry on$/);
  });

  it('writes nothing when stdin lacks session_id', () => {
    const transcriptPath = makeTranscript(
      projectDirectory,
      'Plain.\n\n**Next:** would not log anyway',
    );

    const result = spawnSync('bun', [STOP_REENTRY], {
      // Note: deliberately omitting session_id to exercise the missing-field guard.
      input: JSON.stringify({ transcript_path: transcriptPath, cwd: projectDirectory }),
      cwd: projectDirectory,
      encoding: 'utf8',
      timeout: TIMEOUT_QUICK,
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');

    const logPath = nodePath.join(projectDirectory, '.project', 're-entry.md');
    expect(existsSync(logPath)).toBe(false);
  });

  it('writes only the single-line first segment when Next: imperative spans multiple lines', () => {
    const transcriptPath = makeTranscript(
      projectDirectory,
      'Wrap-up.\n\n**Next:** do thing X\nthen also do Y',
    );

    const result = runStopReentryHook(projectDirectory, transcriptPath, 'sess_multi_line');
    expect(result.status).toBe(0);

    const logPath = nodePath.join(projectDirectory, '.project', 're-entry.md');
    const content = readFileSync(logPath, 'utf8');

    // Exactly one log line (the file ends with a trailing newline; trim it).
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);

    expect(lines[0]).toContain('Next: do thing X');
    expect(lines[0]).not.toContain('then also do Y');
  });

  it('writes to project-root .safeword-project/ even when input.cwd is a subdirectory', () => {
    // Repro for the nested-`.safeword-project/.safeword-project/` bug: Claude Code
    // hooks receive input.cwd = the session's current working directory, which can
    // be a subdirectory if the session has navigated. The hook must resolve the
    // project root (where .safeword-project/ already lives) rather than join cwd
    // blindly and silently mkdirSync a bogus nested path.
    const projectRoot = projectDirectory;
    // Initialize a fake project: real .safeword-project/ exists at the root, plus
    // a .git marker so resolveProjectRoot can walk up to find it.
    mkdirSync(nodePath.join(projectRoot, '.safeword-project'), { recursive: true });
    mkdirSync(nodePath.join(projectRoot, '.git'), { recursive: true });

    // Session cwd has drifted into a subdirectory.
    const drifted = nodePath.join(projectRoot, '.safeword-project', 'tickets');
    mkdirSync(drifted, { recursive: true });

    const transcriptPath = makeTranscript(drifted, 'Done.\n\n**Next:** carry on');

    const result = spawnSync('bun', [STOP_REENTRY], {
      input: JSON.stringify({
        session_id: 'sess_drifted_cwd',
        transcript_path: transcriptPath,
        cwd: drifted, // ← drifted, not projectRoot
      }),
      cwd: drifted,
      encoding: 'utf8',
      timeout: TIMEOUT_QUICK,
    });

    expect(result.status).toBe(0);

    // The log lands at the real project root, not nested inside the subdir.
    const correctPath = nodePath.join(projectRoot, '.safeword-project', 're-entry.md');
    expect(existsSync(correctPath)).toBe(true);
    expect(readFileSync(correctPath, 'utf8')).toContain('sess_drifted_cwd');

    // And no bogus nested .safeword-project/ got materialized under the subdir.
    const bogus = nodePath.join(drifted, '.safeword-project');
    expect(existsSync(bogus)).toBe(false);
  });

  it('renders ticket=<id>/<phase> for the ticket bound to this session', () => {
    // Create an active ticket in the project directory.
    const ticketsDirectory = nodePath.join(
      projectDirectory,
      '.safeword-project',
      'tickets',
      '645W8H',
    );
    mkdirSync(ticketsDirectory, { recursive: true });
    const ticketContent = [
      '---',
      'id: 645W8H',
      'slug: session-reentry-brief',
      'type: feature',
      'phase: scenario-gate',
      'status: in_progress',
      'last_modified: 2026-05-22T15:43:30.000Z',
      '---',
      '',
      '# Test ticket',
      '',
    ].join('\n');
    writeFileSync(nodePath.join(ticketsDirectory, 'ticket.md'), ticketContent);

    // Bind the ticket to THIS session, as post-tool-quality does when an edit
    // touches a ticket.md. The re-entry tag reads the per-session binding (#274).
    writeFileSync(
      nodePath.join(projectDirectory, '.safeword-project', 'quality-state-sess_test_ticket.json'),
      JSON.stringify({ activeTicket: '645W8H' }),
    );

    const transcriptPath = makeTranscript(
      projectDirectory,
      'Wrapping up.\n\n**Next:** keep going on Slice 1',
    );

    const result = runStopReentryHook(projectDirectory, transcriptPath, 'sess_test_ticket');
    expect(result.status).toBe(0);

    const logPath = nodePath.join(projectDirectory, '.safeword-project', 're-entry.md');
    const line = readFileSync(logPath, 'utf8').trim();

    expect(line).toContain('ticket=645W8H/scenario-gate');
    expect(line).not.toContain('ticket=∅/freeform');
  });

  it('renders ∅/freeform when a worktree ticket exists but is NOT bound to this session (#274)', () => {
    // A backlog ticket sits in the worktree, in_progress, freshly modified — but
    // this session never bound it (no quality-state-<sessionId>.json). The old
    // global-most-recent scan mislabeled the brief with this unrelated ticket;
    // the per-session resolver must emit the freeform sentinel instead.
    const ticketsDirectory = nodePath.join(
      projectDirectory,
      '.safeword-project',
      'tickets',
      '9E6Q4V',
    );
    mkdirSync(ticketsDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(ticketsDirectory, 'ticket.md'),
      [
        '---',
        'id: 9E6Q4V',
        'slug: unrelated-backlog',
        'type: task',
        'phase: intake',
        'status: in_progress',
        'last_modified: 2026-06-19T21:44:00.000Z',
        '---',
        '',
        '# Unrelated backlog ticket',
        '',
      ].join('\n'),
    );
    // Deliberately NO quality-state-<sessionId>.json — this session has no binding.

    const transcriptPath = makeTranscript(
      projectDirectory,
      'Did unrelated work.\n\n**Next:** carry on',
    );

    const result = runStopReentryHook(projectDirectory, transcriptPath, 'sess_unbound');
    expect(result.status).toBe(0);

    const logPath = nodePath.join(projectDirectory, '.safeword-project', 're-entry.md');
    const line = readFileSync(logPath, 'utf8').trim();

    expect(line).toContain('ticket=∅/freeform');
    expect(line).not.toContain('9E6Q4V');
  });
});
