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
  removeTemporaryDirectory,
  TIMEOUT_QUICK,
  writeTestFile,
} from '../helpers';

/* eslint-disable unicorn/no-null -- State file uses JSON null values by design */

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const PROMPT_QUESTIONS = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/prompt-questions.ts');

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
    `id: '${id}'`,
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

  // =========================================================================
  // Rule: Prompt hook derives phase from ticket file, not cache
  // =========================================================================
  describe('Prompt hook derives phase from ticket file', () => {
    it('1.1: reads phase from ticket.md via activeTicket binding', () => {
      createTicket(projectDirectory, '099', 'test-ticket', { phase: 'implement' });
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: 'abc123',
        activeTicket: '099',
        gate: null,
        locAtLastReview: 0,
        recentFailures: [],
        incrementedPatterns: [],
      });

      const output = runPromptHook(projectDirectory);

      expect(output).toContain('implement');
    });
  });
});

/* eslint-enable unicorn/no-null */
