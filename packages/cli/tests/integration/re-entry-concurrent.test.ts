/**
 * Integration test: two simultaneous stop-reentry hooks don't interleave.
 *
 * Ticket 645W8H. Scenario 3.1 — POSIX append atomicity for sub-PIPE_BUF writes
 * means concurrent writers should produce two distinct, well-formed log lines,
 * each correctly tagged with its own session_id, with no garbled mid-content.
 */

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const STOP_REENTRY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/stop-reentry.ts');

function makeTranscript(directory: string, name: string, lastAssistantMessage: string): string {
  const transcriptLine = JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: lastAssistantMessage }],
    },
  });
  const transcriptPath = nodePath.join(directory, name);
  writeFileSync(transcriptPath, transcriptLine);
  return transcriptPath;
}

function runStopReentryAsync(
  directory: string,
  transcriptPath: string,
  sessionId: string,
): Promise<number> {
  return new Promise(resolve => {
    const child = spawn('bun', [STOP_REENTRY], {
      cwd: directory,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.stdin.write(
      JSON.stringify({
        session_id: sessionId,
        transcript_path: transcriptPath,
        cwd: directory,
      }),
    );
    child.stdin.end();
    child.on('exit', code => {
      resolve(code ?? 1);
    });
  });
}

describe('stop-reentry hook — Rule 3: concurrent writers do not interleave', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('two simultaneous Stop hooks produce two distinct correctly-tagged lines', async () => {
    const transcriptA = makeTranscript(
      projectDirectory,
      'a.jsonl',
      'Working on A.\n\n**Next:** do A',
    );
    const transcriptB = makeTranscript(
      projectDirectory,
      'b.jsonl',
      'Working on B.\n\n**Next:** do B',
    );

    const [codeA, codeB] = await Promise.all([
      runStopReentryAsync(projectDirectory, transcriptA, 'sess_AAA'),
      runStopReentryAsync(projectDirectory, transcriptB, 'sess_BBB'),
    ]);

    expect(codeA).toBe(0);
    expect(codeB).toBe(0);

    const logPath = nodePath.join(projectDirectory, '.safeword-project', 're-entry.md');
    const lines = readFileSync(logPath, 'utf8').trim().split('\n');

    expect(lines).toHaveLength(2);

    // Each line is well-formed: canonical shape with ISO timestamp, session_id,
    // ticket field, and Next: imperative — no garbled mid-content.
    for (const line of lines) {
      expect(line).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z sess_\S+ ticket=\S+ Next: /,
      );
    }

    // Both sessions tagged correctly, with their own imperative paired with their own id.
    const lineA = lines.find(l => l.includes('sess_AAA'));
    const lineB = lines.find(l => l.includes('sess_BBB'));
    expect(lineA).toContain('Next: do A');
    expect(lineB).toContain('Next: do B');
  });
});
