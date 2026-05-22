/**
 * Integration test: statusline re-entry script surfaces latest Next:.
 *
 * Ticket 645W8H. Slice 3 — Rule 8.
 *
 * The script receives Claude Code's standard status-line JSON on stdin
 * and prints whatever should appear at the bottom of the editor. For
 * re-entry, we print the latest `Next: <imperative>` for the current
 * session (with a `⚠️ conflict: <file>` prefix when applicable — that's
 * scenarios 8.2 onwards).
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory, TIMEOUT_QUICK } from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const STATUSLINE_REENTRY = nodePath.join(SAFEWORD_ROOT, '.safeword/statusline/reentry.ts');

function makeLogFile(directory: string, lines: string[]): void {
  const briefDirectory = nodePath.join(directory, '.safeword-project');
  mkdirSync(briefDirectory, { recursive: true });
  writeFileSync(nodePath.join(briefDirectory, 're-entry.md'), `${lines.join('\n')}\n`);
}

function runStatusline(directory: string, sessionId: string) {
  // Mirrors the Claude Code status-line JSON shape (subset).
  return spawnSync('bun', [STATUSLINE_REENTRY], {
    input: JSON.stringify({
      session_id: sessionId,
      cwd: directory,
      model: { id: 'claude-opus-4-7', display_name: 'Opus 4.7' },
    }),
    cwd: directory,
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

describe('statusline-reentry script — Rule 8: surface latest Next:', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('prints the latest Next: imperative for the current session', () => {
    makeLogFile(projectDirectory, [
      '2026-05-22T10:00:00Z sess_current ticket=∅/freeform Next: first thing',
      '2026-05-22T11:00:00Z sess_current ticket=∅/freeform Next: second thing',
      '2026-05-22T12:00:00Z sess_current ticket=∅/freeform Next: latest action',
    ]);

    const result = runStatusline(projectDirectory, 'sess_current');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('latest action');
    // Older entries should NOT be on the status line — it's a single most-recent.
    expect(result.stdout).not.toContain('first thing');
    expect(result.stdout).not.toContain('second thing');
  });
});
