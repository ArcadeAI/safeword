/**
 * Unit tests for the phase work-log stamp helpers (ticket E32M4P, issue #772).
 * Pure functions over hook payloads and file content — no filesystem.
 *
 * detectPhaseTransition reconstructs a `phase:` change from an Edit/MultiEdit
 * payload (the only channel that carries prior content at PostToolUse time);
 * appendWorkLogEntry appends a stamp line without touching any other byte.
 * The no-op tests are precision pins: they flip if the detector ever stamps
 * edits that aren't phase transitions.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  appendWorkLogEntry,
  detectPhaseTransition,
} from '../../templates/hooks/lib/work-log-stamp.js';

describe('detectPhaseTransition', () => {
  describe('Rule: a landed phase change is reconstructable from the edit payload', () => {
    it('Scenario: an Edit changing the phase detects from → to', () => {
      expect(
        detectPhaseTransition({
          old_string: 'phase: define-behavior',
          new_string: 'phase: scenario-gate',
        }),
      ).toEqual({ from: 'define-behavior', to: 'scenario-gate' });
    });

    it('Scenario: the phase line is found inside a larger frontmatter edit', () => {
      expect(
        detectPhaseTransition({
          old_string: 'type: feature\nphase: intake\nstatus: in_progress',
          new_string: 'type: feature\nphase: define-behavior\nstatus: in_progress',
        }),
      ).toEqual({ from: 'intake', to: 'define-behavior' });
    });

    it('Scenario: a MultiEdit carrying a phase change among other edits detects it', () => {
      expect(
        detectPhaseTransition({
          edits: [
            { old_string: '**Goal:** old wording', new_string: '**Goal:** new wording' },
            { old_string: 'phase: implement', new_string: 'phase: verify' },
          ],
        }),
      ).toEqual({ from: 'implement', to: 'verify' });
    });

    it('Scenario: a backward move is a transition like any other', () => {
      expect(
        detectPhaseTransition({
          old_string: 'phase: scenario-gate',
          new_string: 'phase: define-behavior',
        }),
      ).toEqual({ from: 'scenario-gate', to: 'define-behavior' });
    });

    it('Scenario: the last phase-bearing edit wins in a MultiEdit', () => {
      expect(
        detectPhaseTransition({
          edits: [
            { old_string: 'phase: intake', new_string: 'phase: define-behavior' },
            { old_string: 'phase: define-behavior', new_string: 'phase: scenario-gate' },
          ],
        }),
      ).toEqual({ from: 'define-behavior', to: 'scenario-gate' });
    });
  });

  describe('Rule: non-transitions detect nothing (precision pins)', () => {
    it('Scenario: an edit that never touches phase', () => {
      expect(
        detectPhaseTransition({
          old_string: '**Goal:** old wording',
          new_string: '**Goal:** new wording',
        }),
      ).toBeUndefined();
    });

    it('Scenario: re-declaring the same phase', () => {
      expect(
        detectPhaseTransition({
          old_string: 'phase: implement\nstatus: in_progress',
          new_string: 'phase: implement\nstatus: blocked',
        }),
      ).toBeUndefined();
    });

    it('Scenario: a phase introduced where the old payload had none', () => {
      expect(
        detectPhaseTransition({
          old_string: 'status: in_progress',
          new_string: 'phase: implement\nstatus: in_progress',
        }),
      ).toBeUndefined();
    });

    it('Scenario: a full-file Write payload is the documented no-op', () => {
      expect(
        detectPhaseTransition({
          content: '---\nid: X\nphase: verify\n---\n\n# T\n',
        }),
      ).toBeUndefined();
    });

    it('Scenario: an empty payload detects nothing', () => {
      expect(detectPhaseTransition({})).toBeUndefined();
      expect(detectPhaseTransition(undefined)).toBeUndefined();
    });
  });
});

describe('appendWorkLogEntry', () => {
  const ENTRY = '- 2026-07-06T02:00:00.000Z Phase: define-behavior → scenario-gate';

  it('Scenario: everything but the appended line is byte-identical', () => {
    const content = '---\nid: X\nphase: scenario-gate\n---\n\n# T\n\n## Work Log\n\n- old entry\n';
    const result = appendWorkLogEntry(content, ENTRY);
    expect(result.startsWith(content)).toBe(true);
    expect(result).toBe(`${content}${ENTRY}\n`);
  });

  it('Scenario: a ticket without a Work Log section gains one before the entry', () => {
    const content = '---\nid: X\nphase: scenario-gate\n---\n\n# T\n';
    const result = appendWorkLogEntry(content, ENTRY);
    expect(result.startsWith(content)).toBe(true);
    expect(result).toBe(`${content}\n## Work Log\n\n${ENTRY}\n`);
  });

  it('Scenario: a file missing its trailing newline still appends cleanly', () => {
    const content = '---\nid: X\n---\n\n## Work Log\n\n- old entry';
    const result = appendWorkLogEntry(content, ENTRY);
    expect(result).toBe(`${content}\n${ENTRY}\n`);
  });
});

describe('Rule: no bdd phase file instructs fabricating a timestamp', () => {
  const BDD_DIR = nodePath.resolve(import.meta.dirname, '../../templates/skills/bdd');

  it.each(['DISCOVERY.md', 'SCENARIOS.md', 'TDD.md', 'VERIFY.md'])(
    'Scenario: %s carries no {timestamp} transition template',
    file => {
      const content = readFileSync(nodePath.join(BDD_DIR, file), 'utf8');
      expect(content).not.toMatch(/\{timestamp\} Complete:/);
    },
  );
});
