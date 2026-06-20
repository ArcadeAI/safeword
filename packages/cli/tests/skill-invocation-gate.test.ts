import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  checkSkillInvocations,
  getRequiredSkillsForPhase,
  PHASE_GATES,
  requiredSkillsForDone,
} from '../templates/hooks/lib/skill-invocation-log.js';

function makeProjectWithLog(lines: string[]): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'gate-'));
  mkdirSync(nodePath.join(root, '.safeword-project'), { recursive: true });
  writeFileSync(
    nodePath.join(root, '.safeword-project', 'skill-invocations.log'),
    lines.length > 0 ? `${lines.join('\n')}\n` : '',
  );
  return root;
}

describe('skill-invocation gate (147)', () => {
  describe('Rule: Phase-gate check consults the config map', () => {
    it('PHASE_GATES.done is [verify, audit]', () => {
      expect(PHASE_GATES.done).toEqual(['verify', 'audit']);
    });

    it('getRequiredSkillsForPhase("done") returns [verify, audit]', () => {
      expect(getRequiredSkillsForPhase('done')).toEqual(['verify', 'audit']);
    });

    it('getRequiredSkillsForPhase("implement") returns empty (not gated)', () => {
      expect(getRequiredSkillsForPhase('implement')).toEqual([]);
    });

    it('getRequiredSkillsForPhase("unknown-phase") returns empty (graceful default)', () => {
      expect(getRequiredSkillsForPhase('unknown-phase')).toEqual([]);
    });
  });

  describe('Rule: done requirements are loop-count-aware (W610WW)', () => {
    it('a single-loop feature requires verify + audit only', () => {
      expect(requiredSkillsForDone(true, 1)).toEqual(['verify', 'audit']);
    });

    it('a multi-loop feature also requires quality-review', () => {
      expect(requiredSkillsForDone(true, 2)).toEqual(['verify', 'audit', 'quality-review']);
    });

    it('a single-loop task requires nothing (no verify/audit burden, no review)', () => {
      expect(requiredSkillsForDone(false, 1)).toEqual([]);
    });

    it('a zero-loop task requires nothing', () => {
      expect(requiredSkillsForDone(false, 0)).toEqual([]);
    });

    it('a multi-loop task requires quality-review only — not verify/audit', () => {
      expect(requiredSkillsForDone(false, 2)).toEqual(['quality-review']);
    });
  });

  describe('Rule: Missing required skills hard-block', () => {
    it('passes when both verify and audit entries exist for current session', () => {
      const root = makeProjectWithLog([
        '2026-05-15T00:00:00Z session-abc verify',
        '2026-05-15T00:00:01Z session-abc audit',
      ]);

      const result = checkSkillInvocations({
        sessionId: 'session-abc',
        required: ['verify', 'audit'],
        rootDirectory: root,
      });

      expect(result.ok).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('fails when verify entry missing for current session', () => {
      const root = makeProjectWithLog(['2026-05-15T00:00:01Z session-abc audit']);

      const result = checkSkillInvocations({
        sessionId: 'session-abc',
        required: ['verify', 'audit'],
        rootDirectory: root,
      });

      expect(result.ok).toBe(false);
      expect(result.missing).toContain('verify');
      expect(result.missing).not.toContain('audit');
    });

    it('fails when both missing', () => {
      const root = makeProjectWithLog([]);

      const result = checkSkillInvocations({
        sessionId: 'session-abc',
        required: ['verify', 'audit'],
        rootDirectory: root,
      });

      expect(result.ok).toBe(false);
      expect(result.missing).toEqual(['verify', 'audit']);
    });

    it('other-session entries do not satisfy current-session gate', () => {
      const root = makeProjectWithLog([
        '2026-05-15T00:00:00Z other-session verify',
        '2026-05-15T00:00:01Z other-session audit',
      ]);

      const result = checkSkillInvocations({
        sessionId: 'session-abc',
        required: ['verify', 'audit'],
        rootDirectory: root,
      });

      expect(result.ok).toBe(false);
      expect(result.missing).toEqual(['verify', 'audit']);
    });

    it('log file missing fails closed (blocks)', () => {
      const root = mkdtempSync(nodePath.join(tmpdir(), 'gate-'));
      // No .safeword/ directory at all

      const result = checkSkillInvocations({
        sessionId: 'session-abc',
        required: ['verify', 'audit'],
        rootDirectory: root,
      });

      expect(result.ok).toBe(false);
      expect(result.missing).toEqual(['verify', 'audit']);
    });
  });

  describe('Rule: Log parsing is robust to malformed entries', () => {
    it('malformed lines (missing fields) are ignored, not crashed-on', () => {
      const root = makeProjectWithLog([
        'malformed-line-no-spaces',
        '2026-05-15T00:00:00Z session-abc verify',
        'partial line',
        '2026-05-15T00:00:01Z session-abc audit',
      ]);

      const result = checkSkillInvocations({
        sessionId: 'session-abc',
        required: ['verify', 'audit'],
        rootDirectory: root,
      });

      expect(result.ok).toBe(true);
    });

    it('empty log file means no invocations recorded', () => {
      const root = makeProjectWithLog([]);

      const result = checkSkillInvocations({
        sessionId: 'session-abc',
        required: ['verify', 'audit'],
        rootDirectory: root,
      });

      expect(result.ok).toBe(false);
      expect(result.missing).toEqual(['verify', 'audit']);
    });

    it('empty required list passes trivially', () => {
      const root = makeProjectWithLog([]);

      const result = checkSkillInvocations({
        sessionId: 'session-abc',
        required: [],
        rootDirectory: root,
      });

      expect(result.ok).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });
});
