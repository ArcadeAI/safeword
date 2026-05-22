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

  it('claude --continue → additionalContext shows last 3 entries from the most-recent session', () => {
    // --continue is functionally equivalent to --resume <most-recent-session> from
    // the hook's perspective: Claude Code picks the most-recent session and passes
    // its session_id via stdin. The hook just filters; it doesn't pick.
    makeLogFile(projectDirectory, [
      '2026-05-22T10:00:00Z sess_old ticket=∅/freeform Next: old one',
      '2026-05-22T11:00:00Z sess_old ticket=∅/freeform Next: old two',
      '2026-05-22T12:00:00Z sess_old ticket=∅/freeform Next: old three',
      '2026-05-22T13:00:00Z sess_recent ticket=∅/freeform Next: recent one',
      '2026-05-22T14:00:00Z sess_recent ticket=∅/freeform Next: recent two',
      '2026-05-22T15:00:00Z sess_recent ticket=∅/freeform Next: recent three',
    ]);

    // For this fixture, the most-recent session is sess_recent (latest timestamp).
    const result = runSessionStartHook(projectDirectory, 'sess_recent', 'resume');

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { additionalContext?: string };
    };
    const ctx = parsed.hookSpecificOutput?.additionalContext ?? '';

    expect(ctx).toContain('recent one');
    expect(ctx).toContain('recent two');
    expect(ctx).toContain('recent three');

    expect(ctx).not.toContain('old one');
    expect(ctx).not.toContain('old two');
    expect(ctx).not.toContain('old three');
  });

  it('renders only the last 3 when filter matches more than 3 entries', () => {
    makeLogFile(projectDirectory, [
      '2026-05-22T01:00:00Z sess_long ticket=∅/freeform Next: entry one',
      '2026-05-22T02:00:00Z sess_long ticket=∅/freeform Next: entry two',
      '2026-05-22T03:00:00Z sess_long ticket=∅/freeform Next: entry three',
      '2026-05-22T04:00:00Z sess_long ticket=∅/freeform Next: entry four',
      '2026-05-22T05:00:00Z sess_long ticket=∅/freeform Next: entry five',
    ]);

    const result = runSessionStartHook(projectDirectory, 'sess_long', 'resume');
    expect(result.status).toBe(0);

    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { additionalContext?: string };
    };
    const ctx = parsed.hookSpecificOutput?.additionalContext ?? '';

    expect(ctx).toContain('entry three');
    expect(ctx).toContain('entry four');
    expect(ctx).toContain('entry five');

    expect(ctx).not.toContain('entry one');
    expect(ctx).not.toContain('entry two');
  });

  it('each rendered entry occupies one line', () => {
    makeLogFile(projectDirectory, [
      '2026-05-22T10:00:00Z sess_one ticket=∅/freeform Next: alpha',
      '2026-05-22T11:00:00Z sess_one ticket=∅/freeform Next: bravo',
      '2026-05-22T12:00:00Z sess_one ticket=∅/freeform Next: charlie',
    ]);

    const result = runSessionStartHook(projectDirectory, 'sess_one', 'resume');
    expect(result.status).toBe(0);

    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { additionalContext?: string };
    };
    const ctx = parsed.hookSpecificOutput?.additionalContext ?? '';

    // Every entry line starts with the dash bullet from renderBrief's per-entry template.
    const entryLines = ctx.split('\n').filter(l => l.startsWith('- '));
    expect(entryLines).toHaveLength(3);

    // Each entry line contains the imperative AND is exactly one line (no embedded
    // newlines or wrapping — verified by the split itself).
    expect(entryLines[0]).toContain('alpha');
    expect(entryLines[1]).toContain('bravo');
    expect(entryLines[2]).toContain('charlie');
  });

  it('absent or empty log → no additionalContext injection (silent, no error)', () => {
    // Case 1: log file does not exist at all.
    const resultA = runSessionStartHook(projectDirectory, 'sess_any', 'startup');
    expect(resultA.status).toBe(0);
    expect(resultA.stdout.trim()).toBe('');
    expect(resultA.stderr).toBe('');

    // Case 2: log file exists but is empty (only whitespace).
    makeLogFile(projectDirectory, []);
    const resultB = runSessionStartHook(projectDirectory, 'sess_any', 'startup');
    expect(resultB.status).toBe(0);
    expect(resultB.stdout.trim()).toBe('');
    expect(resultB.stderr).toBe('');
  });

  it('fresh `claude` (source startup) with prior entries from other sessions → most-recent tagged', () => {
    makeLogFile(projectDirectory, [
      '2026-05-22T10:00:00Z sess_old ticket=∅/freeform Next: ancient action',
      '2026-05-22T11:00:00Z sess_other ticket=∅/freeform Next: middle action',
      '2026-05-22T15:00:00Z sess_other ticket=∅/freeform Next: pick this up',
    ]);

    // Fresh `claude` — Claude Code mints a brand-new session_id that won't appear
    // in the existing log. source='startup' tells the hook to fall back to the
    // most-recent entry across all sessions.
    const result = runSessionStartHook(projectDirectory, 'sess_BRAND_NEW', 'startup');

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { additionalContext?: string };
    };
    const ctx = parsed.hookSpecificOutput?.additionalContext ?? '';

    // Shows only the single most-recent entry across all sessions.
    expect(ctx).toContain('pick this up');
    expect(ctx).not.toContain('middle action');
    expect(ctx).not.toContain('ancient action');

    // The entry is tagged as belonging to another session.
    expect(ctx).toContain('(from another session)');
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
