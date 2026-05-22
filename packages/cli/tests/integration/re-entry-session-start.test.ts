/**
 * Integration test: session-start-reentry hook injects filtered tail.
 *
 * Ticket 645W8H. Slice 2.
 *
 * Covers Rule 4 — SessionStart injects a filtered tail from
 * .safeword-project/re-entry.md via additionalContext, scoped to the
 * current session_id (with resume / continue / fresh modes).
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory, TIMEOUT_QUICK } from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const SESSION_START_REENTRY = nodePath.join(
  SAFEWORD_ROOT,
  '.safeword/hooks/session-start-reentry.ts',
);

function makeLogFile(directory: string, lines: string[]): void {
  const briefDirectory = nodePath.join(directory, '.safeword-project');
  mkdirSync(briefDirectory, { recursive: true });
  writeFileSync(nodePath.join(briefDirectory, 're-entry.md'), `${lines.join('\n')}\n`);
}

function runSessionStartHook(
  directory: string,
  sessionId: string,
  source: 'startup' | 'resume' | 'clear' | 'compact',
) {
  return spawnSync('bun', [SESSION_START_REENTRY], {
    input: JSON.stringify({
      session_id: sessionId,
      source,
      cwd: directory,
    }),
    cwd: directory,
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

describe('session-start-reentry hook — Rule 4: filtered tail', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('resume by session id → additionalContext shows last 3 entries from that session, oldest first', () => {
    makeLogFile(projectDirectory, [
      '2026-05-22T10:00:00Z sess_abc ticket=∅/freeform Next: thing one',
      '2026-05-22T11:00:00Z sess_xyz ticket=∅/freeform Next: xyz alpha',
      '2026-05-22T12:00:00Z sess_abc ticket=∅/freeform Next: thing two',
      '2026-05-22T13:00:00Z sess_abc ticket=∅/freeform Next: thing three',
      '2026-05-22T14:00:00Z sess_abc ticket=∅/freeform Next: thing four',
      '2026-05-22T15:00:00Z sess_xyz ticket=∅/freeform Next: xyz beta',
      '2026-05-22T16:00:00Z sess_abc ticket=∅/freeform Next: thing five',
    ]);

    const result = runSessionStartHook(projectDirectory, 'sess_abc', 'resume');

    expect(result.status).toBe(0);

    // Hook output: JSON with hookSpecificOutput.additionalContext per Claude Code protocol.
    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
    };
    const ctx = parsed.hookSpecificOutput?.additionalContext ?? '';

    // Last 3 sess_abc imperatives are "thing three", "thing four", "thing five".
    expect(ctx).toContain('thing three');
    expect(ctx).toContain('thing four');
    expect(ctx).toContain('thing five');

    // Earlier sess_abc entries and any sess_xyz entries must NOT appear.
    expect(ctx).not.toContain('thing one');
    expect(ctx).not.toContain('thing two');
    expect(ctx).not.toContain('xyz alpha');
    expect(ctx).not.toContain('xyz beta');

    // Oldest first within the filtered set.
    expect(ctx.indexOf('thing three')).toBeLessThan(ctx.indexOf('thing four'));
    expect(ctx.indexOf('thing four')).toBeLessThan(ctx.indexOf('thing five'));
  });
});
