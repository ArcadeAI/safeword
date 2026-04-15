/**
 * Integration Test: Phase State Derivation (Ticket #124)
 *
 * Verifies that phase/TDD state is derived from ticket files at read time,
 * not cached in session state. Covers prompt hook, compact context hook,
 * and post-tool hook behavior after cache removal.
 */

import { execSync, spawnSync } from 'node:child_process';
import nodePath from 'node:path';
import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  TIMEOUT_QUICK,
  writeTestFile,
} from '../helpers';

/* eslint-disable unicorn/no-null -- State file uses JSON null values by design */

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const PROMPT_QUESTIONS = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/prompt-questions.ts');
const COMPACT_CONTEXT = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/session-compact-context.ts');
const POST_TOOL_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/post-tool-quality.ts');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get per-session state file path */
function stateFilePath(sessionId = 'test-session'): string {
  return `.safeword-project/quality-state-${sessionId}.json`;
}

/** Write per-session quality state */
function writeState(cwd: string, state: Record<string, unknown>, sessionId = 'test-session'): void {
  writeTestFile(cwd, stateFilePath(sessionId), JSON.stringify(state, null, 2));
}

/** Create a ticket.md in the standard folder structure */
function createTicket(
  cwd: string,
  id: string,
  slug: string,
  options: { phase?: string; status?: string; type?: string } = {},
): void {
  const { phase = 'implement', status = 'in_progress', type = 'feature' } = options;
  const content = [
    '---',
    `id: ${id}`,
    `type: ${type}`,
    `phase: ${phase}`,
    `status: ${status}`,
    `last_modified: 2026-04-15T12:00:00Z`,
    '---',
    '',
    `# Ticket ${id}`,
    '',
  ].join('\n');
  writeTestFile(cwd, `.safeword-project/tickets/${id}-${slug}/ticket.md`, content);
}

/** Run prompt-questions hook and return stdout */
function runPromptHook(cwd: string, sessionId = 'test-session'): string {
  const result = spawnSync('bun', [PROMPT_QUESTIONS], {
    input: JSON.stringify({ session_id: sessionId, prompt: 'test prompt' }),
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
  return result.stdout;
}

/** Create a minimal test project */
function createTestProject(): string {
  const directory = createTemporaryDirectory();
  initGitRepo(directory);
  writeTestFile(directory, '.safeword/.gitkeep', '');
  writeTestFile(directory, '.safeword-project/.gitkeep', '');
  writeTestFile(directory, 'init.txt', 'init');
  execSync('git add . && git commit -m "init"', { cwd: directory, stdio: 'pipe' });
  return directory;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase Derivation (#124)', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTestProject();
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  /** Base state with no phase cache fields */
  function baseState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      locSinceCommit: 0,
      lastCommitHash: 'abc123',
      activeTicket: null,
      gate: null,
      locAtLastReview: 0,
      recentFailures: [],
      incrementedPatterns: [],
      ...overrides,
    };
  }

  /** Run compact context hook and return stdout */
  function runCompactHook(cwd: string, sessionId = 'test-session'): string {
    const result = spawnSync('bun', [COMPACT_CONTEXT], {
      input: JSON.stringify({ session_id: sessionId }),
      cwd,
      env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
      encoding: 'utf8',
      timeout: TIMEOUT_QUICK,
    });
    return result.stdout;
  }

  // =========================================================================
  // Rule: Prompt hook derives phase from ticket file, not cache
  // =========================================================================
  describe('Prompt hook derives phase from ticket file', () => {
    it('1.1: reads phase from ticket.md via activeTicket binding', () => {
      createTicket(projectDirectory, '099', 'test-ticket', { phase: 'implement' });
      writeState(projectDirectory, baseState({ activeTicket: '099' }));

      const output = runPromptHook(projectDirectory);

      expect(output).toContain('implement');
    });

    it('1.2: reflects phase change between invocations', () => {
      createTicket(projectDirectory, '099', 'test-ticket', { phase: 'define-behavior' });
      writeState(projectDirectory, baseState({ activeTicket: '099' }));

      const output1 = runPromptHook(projectDirectory);
      expect(output1).toContain('define-behavior');

      // Edit ticket.md to change phase
      createTicket(projectDirectory, '099', 'test-ticket', { phase: 'implement' });

      const output2 = runPromptHook(projectDirectory);
      expect(output2).toContain('implement');
      expect(output2).not.toContain('define-behavior');
    });
  });

  // =========================================================================
  // Rule: Prompt hook derives TDD step from test-definitions.md
  // =========================================================================
  describe('Prompt hook derives TDD step from test-definitions', () => {
    it('2.1: TDD step derived from test-definitions at prompt time', () => {
      createTicket(projectDirectory, '099', 'test-ticket', { phase: 'implement' });
      writeState(projectDirectory, baseState({ activeTicket: '099' }));

      // Create test-definitions.md with one checked RED sub-checkbox
      const testDefinitions = [
        '## Rule: Some rule',
        '',
        '- [ ] Some scenario',
        '',
        '### Scenario 1.1: Test scenario',
        '',
        '- [x] RED',
        '- [ ] GREEN',
        '- [ ] REFACTOR',
      ].join('\n');
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test-ticket/test-definitions.md',
        testDefinitions,
      );

      const output = runPromptHook(projectDirectory);

      expect(output).toContain('TDD: RED');
    });
  });

  // =========================================================================
  // Rule: Cold start shows "no active ticket"
  // =========================================================================
  describe('Cold start', () => {
    it('3.1: shows "no active ticket" when activeTicket is null', () => {
      writeState(projectDirectory, baseState({ activeTicket: null }));

      const output = runPromptHook(projectDirectory);

      expect(output).toContain('No active ticket');
    });
  });

  // =========================================================================
  // Rule: Freshness check clears stale activeTicket binding
  // =========================================================================
  describe('Freshness check clears stale binding', () => {
    it('4.1: binding cleared when ticket status is done', () => {
      createTicket(projectDirectory, '099', 'test-ticket', {
        phase: 'done',
        status: 'done',
      });
      writeState(projectDirectory, baseState({ activeTicket: '099' }));

      const output = runPromptHook(projectDirectory);

      expect(output).toContain('No active ticket');
    });

    it('4.2: binding cleared for non-standard statuses', () => {
      createTicket(projectDirectory, '099', 'test-ticket', {
        phase: 'implement',
        status: 'blocked',
      });
      writeState(projectDirectory, baseState({ activeTicket: '099' }));

      const output = runPromptHook(projectDirectory);

      expect(output).toContain('No active ticket');
    });

    it('4.3: binding cleared when ticket folder is missing', () => {
      // activeTicket points to non-existent ticket
      writeState(projectDirectory, baseState({ activeTicket: '999' }));

      const output = runPromptHook(projectDirectory);

      expect(output).toContain('No active ticket');
    });
  });

  // =========================================================================
  // Rule: Compact context uses per-session state, not legacy shared file
  // =========================================================================
  describe('Compact context uses per-session state', () => {
    it('5.1: reads per-session state and derives context from ticket.md', () => {
      createTicket(projectDirectory, '099', 'test-ticket', {
        phase: 'implement',
        status: 'in_progress',
      });
      writeState(projectDirectory, baseState({ activeTicket: '099' }));

      const output = runCompactHook(projectDirectory);

      expect(output).toContain('099');
      expect(output).toContain('implement');
    });

    it('5.2: legacy shared file ignored gracefully', () => {
      // Only write legacy shared quality-state.json (no per-session file)
      createTicket(projectDirectory, '099', 'test-ticket', { phase: 'implement' });
      writeTestFile(
        projectDirectory,
        '.safeword-project/quality-state.json',
        JSON.stringify({ activeTicket: '099', lastKnownPhase: 'implement' }),
      );

      const output = runCompactHook(projectDirectory);

      // Should not output stale data from legacy file
      expect(output).not.toContain('implement');
    });

    it('5.3: compact context skips stale ticket binding', () => {
      createTicket(projectDirectory, '099', 'test-ticket', {
        phase: 'done',
        status: 'done',
      });
      writeState(projectDirectory, baseState({ activeTicket: '099' }));

      const output = runCompactHook(projectDirectory);

      // Should not output ticket context for done tickets
      expect(output).not.toContain('implement');
      expect(output).not.toContain('Ticket: 099');
    });
  });

  // =========================================================================
  // Rule: Post-tool no longer caches phase or TDD step
  // =========================================================================
  describe('Post-tool no longer caches phase or TDD step', () => {
    /** Run post-tool quality hook */
    function runPostToolQuality(
      cwd: string,
      toolName: string,
      filePath: string,
      sessionId = 'test-session',
    ): void {
      spawnSync('bun', [POST_TOOL_QUALITY], {
        input: JSON.stringify({
          session_id: sessionId,
          hook_event_name: 'PostToolUse',
          tool_name: toolName,
          tool_input: { file_path: filePath },
        }),
        cwd,
        env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
        encoding: 'utf8',
        timeout: TIMEOUT_QUICK,
      });
    }

    /** Read per-session quality state */
    function readState(cwd: string, sessionId = 'test-session'): Record<string, unknown> {
      return JSON.parse(readTestFile(cwd, `.safeword-project/quality-state-${sessionId}.json`));
    }

    it('6.1: post-tool sets activeTicket but not phase cache', () => {
      createTicket(projectDirectory, '099', 'test-ticket', { phase: 'define-behavior' });
      const head = execSync('git rev-parse --short HEAD', {
        cwd: projectDirectory,
        encoding: 'utf8',
      }).trim();
      writeState(projectDirectory, baseState({ lastCommitHash: head }));

      const ticketPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test-ticket/ticket.md',
      );
      runPostToolQuality(projectDirectory, 'Edit', ticketPath);

      const state = readState(projectDirectory);
      expect(state.activeTicket).toBe('099');
      expect(state).not.toHaveProperty('lastKnownPhase');
    });

    it('6.2: post-tool does not cache TDD step', () => {
      createTicket(projectDirectory, '099', 'test-ticket', { phase: 'implement' });
      const head = execSync('git rev-parse --short HEAD', {
        cwd: projectDirectory,
        encoding: 'utf8',
      }).trim();
      writeState(projectDirectory, baseState({ activeTicket: '099', lastCommitHash: head }));

      const testDefsContent = [
        '## Rule: Test',
        '',
        '- [ ] Scenario',
        '',
        '### Scenario 1.1: Test',
        '',
        '- [x] RED',
        '- [ ] GREEN',
        '- [ ] REFACTOR',
      ].join('\n');
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test-ticket/test-definitions.md',
        testDefsContent,
      );

      const testDefsPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test-ticket/test-definitions.md',
      );
      runPostToolQuality(projectDirectory, 'Edit', testDefsPath);

      const state = readState(projectDirectory);
      expect(state).not.toHaveProperty('lastKnownTddStep');
    });
  });

  // =========================================================================
  // Rule: Prompt hook shows phase-appropriate reminders (#124b)
  // =========================================================================
  describe('Verify phase prompt reminders (#124b)', () => {
    it('1.1: verify phase shows verify-specific reminder', () => {
      createTicket(projectDirectory, '099', 'test-ticket', { phase: 'verify' });
      writeState(projectDirectory, baseState({ activeTicket: '099' }));

      const output = runPromptHook(projectDirectory);

      expect(output).toContain('verify');
      expect(output).toContain('/audit');
    });

    it('1.2: done phase shows simplified reminder', () => {
      createTicket(projectDirectory, '099', 'test-ticket', { phase: 'done' });
      writeState(projectDirectory, baseState({ activeTicket: '099' }));

      const output = runPromptHook(projectDirectory);

      expect(output).toContain('Close ticket');
      expect(output).not.toContain('refactor');
    });
  });

  // =========================================================================
  // Rule: No residual cache fields or functions remain
  // =========================================================================
  describe('No residual cache fields or functions', () => {
    it('7.1: lastKnownPhase and lastKnownTddStep removed from hook sources', () => {
      // Static verification: grep for cache fields in hook source files
      // parseTddStep is allowed in lib/active-ticket.ts (shared utility)
      const hooksDirectory = nodePath.join(SAFEWORD_ROOT, 'packages/cli/templates/hooks');
      const cacheFields = ['lastKnownPhase', 'lastKnownTddStep'];

      for (const pattern of cacheFields) {
        const result = spawnSync('grep', ['-r', pattern, hooksDirectory], {
          encoding: 'utf8',
        });
        // grep exits 1 when no matches found (good), 0 when matches found (bad)
        expect(result.status, `"${pattern}" should not appear in hook sources`).toBe(1);
      }
    });
  });
});

/* eslint-enable unicorn/no-null */
