/**
 * Integration tests for the phase work-log stamp hook (ticket E32M4P, #772).
 *
 * Exercises post-tool-work-log.ts end to end: PostToolUse fires after a
 * ticket.md edit lands; when the payload shows a `phase:` change, the hook
 * appends a work-log line stamped with the real system clock. The bdd phase
 * files' `{timestamp}` templates fabricated these times — the hook is the
 * clock the agent doesn't have.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  type HookResult,
  removeTemporaryDirectory,
  spawnHookScript,
} from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const HOOK = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/post-tool-work-log.ts');

const TICKET_BODY = (phase: string) =>
  `---\nid: AB12CD\nslug: sample\ntype: feature\nphase: ${phase}\nstatus: in_progress\n---\n\n# Sample\n\n**Goal:** sample.\n\n## Work Log\n\n- 2026-07-05T00:00:00.000Z Started: Created ticket AB12CD\n`;

function runHook(cwd: string, toolName: string, toolInput: Record<string, unknown>): HookResult {
  return spawnHookScript(HOOK, cwd, {
    session_id: 'test-session',
    hook_event_name: 'PostToolUse',
    tool_name: toolName,
    tool_input: toolInput,
  });
}

describe('Phase work-log stamp hook', () => {
  let projectDirectory = '';

  afterEach(() => {
    if (!projectDirectory) {
      return;
    }

    removeTemporaryDirectory(projectDirectory);
    projectDirectory = '';
  });

  /** Temp project with a .safeword marker and one ticket already at `phase`. */
  function setupProject(phaseOnDisk: string): string {
    projectDirectory = createTemporaryDirectory();
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
    const ticketDirectory = nodePath.join(projectDirectory, '.project/tickets/AB12CD-sample');
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(nodePath.join(ticketDirectory, 'ticket.md'), TICKET_BODY(phaseOnDisk));
    return projectDirectory;
  }

  function ticketPath(cwd: string): string {
    return nodePath.join(cwd, '.project/tickets/AB12CD-sample/ticket.md');
  }

  describe('Rule: a landed phase transition gains exactly one real-time line', () => {
    it('Scenario: an Edit that advances the phase appends one stamped line', () => {
      const cwd = setupProject('scenario-gate');
      const before = Date.now();
      runHook(cwd, 'Edit', {
        file_path: ticketPath(cwd),
        old_string: 'phase: define-behavior',
        new_string: 'phase: scenario-gate',
      });
      const after = Date.now();

      const content = readFileSync(ticketPath(cwd), 'utf8');
      const stamps = content
        .split('\n')
        .filter(line => line.includes('Phase: define-behavior → scenario-gate'));
      expect(stamps).toHaveLength(1);

      const timestamp = /^- (\S+) Phase:/.exec(stamps[0] ?? '')?.[1] ?? '';
      const stampedAt = Date.parse(timestamp);
      expect(stampedAt).toBeGreaterThanOrEqual(before - 1000);
      expect(stampedAt).toBeLessThanOrEqual(after + 1000);
    });

    it('Scenario: the stamp is a pure append — prior content survives byte-for-byte', () => {
      const cwd = setupProject('scenario-gate');
      const priorContent = readFileSync(ticketPath(cwd), 'utf8');
      runHook(cwd, 'Edit', {
        file_path: ticketPath(cwd),
        old_string: 'phase: define-behavior',
        new_string: 'phase: scenario-gate',
      });
      const content = readFileSync(ticketPath(cwd), 'utf8');
      expect(content.startsWith(priorContent)).toBe(true);
      expect(content.length).toBeGreaterThan(priorContent.length);
    });
  });

  describe('Rule: edits that are not phase transitions leave the file untouched', () => {
    it('Scenario: a non-phase edit and a Write rewrite add no stamp', () => {
      const cwd = setupProject('implement');
      const priorContent = readFileSync(ticketPath(cwd), 'utf8');

      runHook(cwd, 'Edit', {
        file_path: ticketPath(cwd),
        old_string: '**Goal:** sample.',
        new_string: '**Goal:** reworded sample.',
      });
      runHook(cwd, 'Write', {
        file_path: ticketPath(cwd),
        content: TICKET_BODY('verify'),
      });

      expect(readFileSync(ticketPath(cwd), 'utf8')).toBe(priorContent);
    });

    it('Scenario: files outside the tickets namespace are never stamped', () => {
      const cwd = setupProject('implement');
      const strayTicket = nodePath.join(cwd, 'ticket.md');
      writeFileSync(strayTicket, TICKET_BODY('implement'));
      const specPath = nodePath.join(cwd, '.project/tickets/AB12CD-sample/spec.md');
      writeFileSync(specPath, 'phase: implement\n');

      runHook(cwd, 'Edit', {
        file_path: strayTicket,
        old_string: 'phase: implement',
        new_string: 'phase: verify',
      });
      runHook(cwd, 'Edit', {
        file_path: specPath,
        old_string: 'phase: implement',
        new_string: 'phase: verify',
      });

      expect(readFileSync(strayTicket, 'utf8')).toBe(TICKET_BODY('implement'));
      expect(readFileSync(specPath, 'utf8')).toBe('phase: implement\n');
    });
  });
});
