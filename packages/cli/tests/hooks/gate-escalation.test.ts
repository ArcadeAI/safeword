/**
 * Slice 1b — gate-escalation self-report. When a safeword gate fires enough times
 * across sessions to cross the escalation threshold, `recordFailure` emits exactly
 * one GateEscalation signal (a candidate false-positive in safeword's own gates).
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ESCALATION_THRESHOLD,
  getStateFilePath,
  recordFailure,
} from '../../templates/hooks/lib/quality-state.js';
import { readReports } from '../../templates/hooks/lib/self-report.js';

describe('gate-escalation self-report (Slice 1b)', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'sw-gate-esc-'));
    // Namespace root must exist for the counter file; .safeword for the spool.
    mkdirSync(nodePath.join(projectDirectory, '.project'), { recursive: true });
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
  });

  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  /** Fire `pattern` once in a fresh session (the counter dedups per session). */
  function fireInSession(sessionId: string, pattern: string): void {
    writeFileSync(getStateFilePath(projectDirectory, sessionId), '{}');
    recordFailure(projectDirectory, sessionId, pattern);
  }

  it('emits one GateEscalation signal exactly at the threshold crossing', () => {
    for (let i = 1; i < ESCALATION_THRESHOLD; i++) {
      fireInSession(`s${i}`, 'loc');
    }
    // Below the threshold: nothing captured yet.
    expect(readReports(projectDirectory)).toHaveLength(0);

    // The crossing fire.
    fireInSession(`s${ESCALATION_THRESHOLD}`, 'loc');

    const records = readReports(projectDirectory);
    expect(records).toHaveLength(1);
    expect(records[0]?.errorClass).toBe('GateEscalation');
    expect(records[0]?.source).toBe('loc');

    // Firing again past the threshold does not re-emit (bounded to the crossing).
    fireInSession(`s${ESCALATION_THRESHOLD + 1}`, 'loc');
    expect(readReports(projectDirectory)).toHaveLength(1);
  });
});
