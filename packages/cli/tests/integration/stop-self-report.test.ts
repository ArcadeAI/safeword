/**
 * Integration test: the stop-self-report hook surfaces captured signals via
 * hookSpecificOutput.additionalContext (ticket QYYC5Y, issue #345).
 *
 * Spawns the real dogfood hook under bun, with a seeded spool, and asserts it
 * emits a factual additionalContext on exit 0 — and stays silent (no output)
 * when the session captured nothing.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { recordSignal } from '../../templates/hooks/lib/self-report.js';
import { createTemporaryDirectory, removeTemporaryDirectory, TIMEOUT_QUICK } from '../helpers';

function writeSelfReportConfig(directory: string, selfReport: Record<string, boolean>): void {
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, '.safeword', 'config.json'),
    JSON.stringify({ selfReport }),
  );
}

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const HOOK = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/stop-self-report.ts');

function runHook(directory: string, sessionId: string) {
  return spawnSync('bun', [HOOK], {
    input: JSON.stringify({ session_id: sessionId }),
    cwd: directory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

/** The exact record shape that drove the observed #1163 wake loop. */
const LOOP_SIGNAL = {
  source: 'loc-exceeded',
  agent: 'claude',
  errorClass: 'GateEscalation',
} as const;

describe('stop-self-report hook (QYYC5Y)', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('surfaces captured signals as additionalContext on exit 0', () => {
    recordSignal(
      projectDirectory,
      'sess-1',
      { source: 'post-tool-quality', errorClass: 'TypeError' },
      '1.0.0',
    );

    const result = runHook(projectDirectory, 'sess-1');

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(parsed.hookSpecificOutput.hookEventName).toBe('Stop');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('Safeword recorded 1');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('TypeError@post-tool-quality');
  });

  it('stays silent (no output) when the session captured nothing', () => {
    const result = runHook(projectDirectory, 'empty-session');

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('stays silent when selfReport.surface is false (#353)', () => {
    recordSignal(projectDirectory, 'sess-2', { source: 'check', exitCode: 1 }, '1.0.0');
    writeSelfReportConfig(projectDirectory, { surface: false });

    const result = runHook(projectDirectory, 'sess-2');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  // -------------------------------------------------------------------------
  // Issue #1163: the wake loop. Stop additionalContext wakes the agent as a
  // fresh turn with no user message; ending that turn fires Stop again. The
  // session spool never drains, so an unconditional emit re-surfaces a
  // byte-identical line forever — observed live as ~1h40m of the agent
  // replying "." to itself. These assert emit-only-on-change.
  // -------------------------------------------------------------------------

  it('surfaces a signature once, then stays silent on every later stop (#1163)', () => {
    recordSignal(projectDirectory, 'sess-loop', LOOP_SIGNAL, '0.68.0');

    const first = runHook(projectDirectory, 'sess-loop');
    expect(first.status).toBe(0);
    expect(first.stdout).toContain('GateEscalation@loc-exceeded');

    // Nothing new landed, so every subsequent Stop must emit NOTHING. A repeat
    // here is not cosmetic noise — it is an infinite agent wake loop.
    for (let stop = 0; stop < 3; stop++) {
      const later = runHook(projectDirectory, 'sess-loop');
      expect(later.status).toBe(0);
      expect(later.stdout.trim()).toBe('');
    }
  });

  it('stays silent when an ALREADY-surfaced signature recurs (#1163)', () => {
    recordSignal(projectDirectory, 'sess-repeat', LOOP_SIGNAL, '0.68.0');
    expect(runHook(projectDirectory, 'sess-repeat').stdout).toContain('GateEscalation');

    // A second occurrence of the SAME signature is not new information — dedupe
    // is by signature, not by record count, so a gate that keeps firing cannot
    // wake the agent once per firing.
    recordSignal(projectDirectory, 'sess-repeat', LOOP_SIGNAL, '0.68.0');

    expect(runHook(projectDirectory, 'sess-repeat').stdout.trim()).toBe('');
  });

  it('surfaces only the NEW signature when a different one lands later (#1163)', () => {
    recordSignal(projectDirectory, 'sess-new', LOOP_SIGNAL, '0.68.0');
    expect(runHook(projectDirectory, 'sess-new').stdout).toContain('GateEscalation@loc-exceeded');

    recordSignal(
      projectDirectory,
      'sess-new',
      { source: 'post-tool-quality', agent: 'claude', errorClass: 'TypeError' },
      '0.68.0',
    );

    const second = runHook(projectDirectory, 'sess-new');
    expect(second.stdout).toContain('TypeError@post-tool-quality');
    // The already-surfaced one must not ride along again.
    expect(second.stdout).not.toContain('GateEscalation');
  });

  it('dedupes per session — a second session still gets its own surfacing (#1163)', () => {
    recordSignal(projectDirectory, 'sess-a', LOOP_SIGNAL, '0.68.0');
    recordSignal(projectDirectory, 'sess-b', LOOP_SIGNAL, '0.68.0');

    expect(runHook(projectDirectory, 'sess-a').stdout).toContain('GateEscalation');
    expect(runHook(projectDirectory, 'sess-a').stdout.trim()).toBe('');
    // sess-b's marker is independent — the dedupe must not silence a fresh session.
    expect(runHook(projectDirectory, 'sess-b').stdout).toContain('GateEscalation');
  });

  it('appends the filing-guide pointer when selfReport.file is true (#353)', () => {
    recordSignal(projectDirectory, 'sess-3', { source: 'check', exitCode: 1 }, '1.0.0');
    writeSelfReportConfig(projectDirectory, { file: true });

    const result = runHook(projectDirectory, 'sess-3');
    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput: { additionalContext: string };
    };
    expect(parsed.hookSpecificOutput.additionalContext).toContain(
      '.safeword/guides/self-report-filing.md',
    );
  });
});
