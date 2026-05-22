/**
 * Integration test: stop-reentry hook writes a re-entry.md line.
 *
 * Ticket 645W8H. Slice 1 walking skeleton.
 *
 * Covers Rule 1 — Stop hook records intent when present, skips otherwise.
 * Scenario: assistant message ends with `**Next:** commit and PR` →
 *           .safeword-project/re-entry.md gains one new line containing
 *           "Next: commit and PR" and the hook-injected session_id.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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

    const logPath = nodePath.join(projectDirectory, '.safeword-project', 're-entry.md');
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

    const logPath = nodePath.join(projectDirectory, '.safeword-project', 're-entry.md');
    expect(existsSync(logPath)).toBe(false);
  });

  it('writes nothing when the **Next:** line has only whitespace after the bold preface', () => {
    const transcriptPath = makeTranscript(projectDirectory, 'Wrap-up paragraph.\n\n**Next:**   ');

    const result = runStopReentryHook(projectDirectory, transcriptPath, 'sess_test_empty');

    expect(result.status).toBe(0);

    const logPath = nodePath.join(projectDirectory, '.safeword-project', 're-entry.md');
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

    const logPath = nodePath.join(projectDirectory, '.safeword-project', 're-entry.md');
    const line = readFileSync(logPath, 'utf8').trim();

    // session_id must be the one from stdin, not the deceptive string in the text.
    expect(line).toContain('sess_actual_xyz');
    expect(line).not.toContain('DECEPTIVE123');

    // Timestamp must be the wall clock at write time (ISO-8601, within a 1s tolerance).
    const tsMatch = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s/.exec(line);
    if (tsMatch === null) {
      throw new Error(`Log line missing ISO-8601 timestamp prefix: ${line}`);
    }
    const writtenMs = Date.parse(tsMatch[1]);
    expect(writtenMs).toBeGreaterThanOrEqual(beforeWriteMs - 1000);
    expect(writtenMs).toBeLessThanOrEqual(afterWriteMs + 1000);
  });
});
