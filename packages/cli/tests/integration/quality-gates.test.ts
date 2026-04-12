/**
 * Integration Test: Quality Gates (Tickets #024, #114)
 *
 * Verifies the three-layer enforcement model:
 * - Natural gates: artifact prerequisite (test-definitions requires ticket scope fields)
 * - Reminders: phase/TDD state tracked for prompt hook (no longer blocks edits)
 * - Output validation: LOC gate (only hard block), done gate (in stop hook)
 *
 * PostToolUse tracks LOC, phase changes, TDD step transitions in state file.
 * PreToolUse enforces LOC gate + artifact prerequisite. Phase/TDD are reminders only.
 */

import { execSync, spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  fileExists,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  TIMEOUT_QUICK,
  writeTestFile,
} from '../helpers';

/* eslint-disable unicorn/no-null -- State file uses JSON null values by design; re-enabled at EOF */

// Absolute paths to hook scripts in safeword source tree
const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const POST_TOOL_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/post-tool-quality.ts');
const PRE_TOOL_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/pre-tool-quality.ts');

/** Get per-session state file path */
function stateFilePath(sessionId = 'test-session'): string {
  return `.safeword-project/quality-state-${sessionId}.json`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run the PostToolUse quality hook */
function runPostToolQuality(
  cwd: string,
  toolName: string,
  filePath: string,
  sessionId = 'test-session',
) {
  return spawnSync('bun', [POST_TOOL_QUALITY], {
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

/** Run the PreToolUse quality hook */
function runPreToolQuality(
  cwd: string,
  toolName: string,
  filePath?: string,
  sessionId = 'test-session',
) {
  return spawnSync('bun', [PRE_TOOL_QUALITY], {
    input: JSON.stringify({
      session_id: sessionId,
      hook_event_name: 'PreToolUse',
      tool_name: toolName,
      tool_input: filePath ? { file_path: filePath } : {},
    }),
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

/** Get current HEAD short hash */
function getHead(cwd: string): string {
  return execSync('git rev-parse --short HEAD', { cwd, encoding: 'utf8' }).trim();
}

/** Write per-session quality state */
function writeState(cwd: string, state: Record<string, unknown>, sessionId = 'test-session'): void {
  writeTestFile(cwd, stateFilePath(sessionId), JSON.stringify(state, null, 2));
}

/** Read per-session quality state */
function readState(cwd: string, sessionId = 'test-session'): Record<string, unknown> {
  return JSON.parse(readTestFile(cwd, stateFilePath(sessionId)));
}

/** Create a test project with git repo and initial commit */
function createTestProject(): string {
  const dir = createTemporaryDirectory();
  initGitRepo(dir);
  writeTestFile(dir, '.safeword-project/.gitkeep', '');
  writeTestFile(dir, 'init.txt', 'init');
  execSync('git add . && git commit -m "init"', { cwd: dir, stdio: 'pipe' });
  return dir;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Quality Gates', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTestProject();
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  // =========================================================================
  // Suite 1: LOC Gate
  // =========================================================================
  describe('LOC Gate', () => {
    it('1.1: below threshold allows edits', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 100,
        lastCommitHash: head,
        activeTicket: null,
        lastKnownPhase: null,
        gate: null,
      });

      const result = runPreToolQuality(projectDirectory, 'Edit');

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
    });

    it('1.2: PostToolUse sets LOC gate at threshold', () => {
      // Create a file with 420 lines and stage it so git diff --stat HEAD sees it
      const lines = Array.from({ length: 420 }, (_, i) => `const x${i} = ${i};`).join('\n');
      writeTestFile(projectDirectory, 'large-file.ts', lines);
      execSync('git add large-file.ts', { cwd: projectDirectory, stdio: 'pipe' });

      const result = runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, 'large-file.ts'),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      expect(state.gate).toBe('loc');
      expect(state.locSinceCommit).toBeGreaterThanOrEqual(400);
    });

    it('1.3: PreToolUse blocks with commit reminder at LOC gate', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 450,
        lastCommitHash: head,
        activeTicket: null,
        lastKnownPhase: null,
        gate: 'loc',
      });

      const result = runPreToolQuality(projectDirectory, 'Edit');

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      const reason = output.hookSpecificOutput.permissionDecisionReason;
      expect(reason).toContain('SAFEWORD');
      expect(reason).toContain('450 LOC');
      expect(reason).toContain('Commit');
    });

    it('1.4: LOC gate clears on commit', () => {
      // State has a stale hash — doesn't match current HEAD
      writeState(projectDirectory, {
        locSinceCommit: 500,
        lastCommitHash: 'stale-hash',
        activeTicket: null,
        lastKnownPhase: null,
        gate: 'loc',
      });

      const result = runPreToolQuality(projectDirectory, 'Edit');

      expect(result.status).toBe(0);
    });
  });

  // =========================================================================
  // Suite 2: Phase Gate
  // =========================================================================
  describe('Phase Gate', () => {
    it('2.1: PostToolUse detects phase change in ticket.md', () => {
      const ticketPath = '.safeword-project/tickets/099-test/ticket.md';
      writeTestFile(
        projectDirectory,
        ticketPath,
        ['---', 'id: 099', 'phase: implement', 'status: in_progress', '---', '# Test Ticket'].join(
          '\n',
        ),
      );

      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'intake',
        gate: null,
      });

      const result = runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, ticketPath),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      // Phase transitions no longer set gates — they update state for prompt hook reminders
      expect(state.gate).toBeNull();
      expect(state.lastKnownPhase).toBe('implement');
    });

    it('2.2: PreToolUse allows edits even with phase gate set (gates are now reminders)', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'implement',
        gate: 'phase:implement',
      });

      const result = runPreToolQuality(projectDirectory, 'Edit');

      // Phase gates no longer block — they're reminders via prompt hook
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('2.3: phase gate clears on commit', () => {
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: 'stale-hash',
        activeTicket: '099',
        lastKnownPhase: 'implement',
        gate: 'phase:implement',
      });

      const result = runPreToolQuality(projectDirectory, 'Edit');

      expect(result.status).toBe(0);
    });

    it('2.4: .safeword-project/ edits bypass phase gate (prevents circular dependency)', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'implement',
        lastKnownTddStep: null,
        gate: 'phase:implement',
      });

      const ticketPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
      );
      const result = runPreToolQuality(projectDirectory, 'Edit', ticketPath);

      // Should allow — .safeword-project/ files are exempt from gates
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('2.5: test-definitions.md edits allowed when ticket has scope fields', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'implement',
        lastKnownTddStep: null,
        gate: 'tdd:green',
      });

      // Ticket must have scope fields for artifact prerequisite to pass
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
        [
          '---',
          'id: 099',
          'phase: implement',
          'status: in_progress',
          'scope: test scope',
          'out_of_scope: nothing',
          'done_when: tests pass',
          '---',
          '# Test',
        ].join('\n'),
      );

      const testDefsPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/test-definitions.md',
      );
      const result = runPreToolQuality(projectDirectory, 'Edit', testDefsPath);

      // Allowed — ticket has scope fields, TDD gate is a reminder not a block
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('2.6: .safeword-project/ edits bypass LOC gate too', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 500,
        lastCommitHash: head,
        activeTicket: null,
        lastKnownPhase: null,
        lastKnownTddStep: null,
        gate: 'loc',
      });

      const learningPath = nodePath.join(
        projectDirectory,
        '.safeword-project/learnings/some-learning.md',
      );
      const result = runPreToolQuality(projectDirectory, 'Edit', learningPath);

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('2.7: non-ticket edit does not set phase gate', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: null,
        lastKnownPhase: 'intake',
        gate: null,
      });

      // Edit a regular (non-ticket) file — stage so LOC is tracked
      writeTestFile(projectDirectory, 'src/foo.ts', 'export const x = 1;\n');
      execSync('git add src/foo.ts', { cwd: projectDirectory, stdio: 'pipe' });

      const result = runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, 'src/foo.ts'),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      expect(state.gate).toBeNull();
      expect(state.lastKnownPhase).toBe('intake');
      // LOC should still be tracked (file has 1 line)
      expect(state.locSinceCommit).toBeGreaterThan(0);
    });

    it('2.8: ticket creation (null→phase) does not set gate', () => {
      const ticketPath = '.safeword-project/tickets/099-test/ticket.md';
      writeTestFile(
        projectDirectory,
        ticketPath,
        ['---', 'id: 099', 'phase: implement', 'status: in_progress', '---', '# Test'].join('\n'),
      );

      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: null,
        lastKnownPhase: null,
        lastKnownTddStep: null,
        gate: null,
      });

      const result = runPostToolQuality(
        projectDirectory,
        'Write',
        nodePath.join(projectDirectory, ticketPath),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      // Phase tracked but no gate — null→phase is not a transition
      expect(state.lastKnownPhase).toBe('implement');
      expect(state.gate).toBeNull();
      expect(state.activeTicket).toBe('099');
    });

    it('2.9: real phase transition (non-null→phase) still sets gate', () => {
      const ticketPath = '.safeword-project/tickets/099-test/ticket.md';
      writeTestFile(
        projectDirectory,
        ticketPath,
        ['---', 'id: 099', 'phase: implement', 'status: in_progress', '---', '# Test'].join('\n'),
      );

      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'intake',
        lastKnownTddStep: null,
        gate: null,
      });

      const result = runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, ticketPath),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      // Phase transitions update state but no longer set gates
      expect(state.lastKnownPhase).toBe('implement');
      expect(state.gate).toBeNull();
    });
  });

  // =========================================================================
  // Suite 3: State Management
  // =========================================================================
  describe('State Management', () => {
    it('3.1: PreToolUse allows when state file missing', () => {
      // No state file created
      const result = runPreToolQuality(projectDirectory, 'Edit');

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      // PreToolUse must NOT create the state file (read-only)
      expect(fileExists(projectDirectory, stateFilePath())).toBe(false);
    });

    it('3.2: PostToolUse creates state file with 5 fields', () => {
      // No state file — PostToolUse should create it
      writeTestFile(projectDirectory, 'src/foo.ts', 'export const x = 1;\n');
      execSync('git add src/foo.ts', { cwd: projectDirectory, stdio: 'pipe' });

      const result = runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, 'src/foo.ts'),
      );

      expect(result.status).toBe(0);
      expect(fileExists(projectDirectory, stateFilePath())).toBe(true);

      const state = readState(projectDirectory);
      const keys = Object.keys(state);
      expect(keys).toHaveLength(6);
      expect(keys).toContain('locSinceCommit');
      expect(keys).toContain('lastCommitHash');
      expect(keys).toContain('activeTicket');
      expect(keys).toContain('lastKnownPhase');
      expect(keys).toContain('gate');
      expect(keys).toContain('lastKnownTddStep');
      expect(state.lastCommitHash).toBe(getHead(projectDirectory));
      expect(state.gate).toBeNull();
    });
  });

  // =========================================================================
  // Suite 4: Edge Cases
  // =========================================================================
  describe('Edge Cases', () => {
    it('4.1: PreToolUse passes through non-edit tools', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 500,
        lastCommitHash: head,
        activeTicket: null,
        lastKnownPhase: null,
        gate: 'loc',
      });

      // Bash should NOT be blocked even with LOC gate set
      const result = runPreToolQuality(projectDirectory, 'Bash');

      expect(result.status).toBe(0);
    });

    it('4.2: insertions-only diff counts LOC correctly', () => {
      // Create a new file with 50 lines, stage it (insertions only, no deletions)
      const lines = Array.from({ length: 50 }, (_, i) => `const line${i} = ${i};`).join('\n');
      writeTestFile(projectDirectory, 'new-file.ts', lines);
      execSync('git add new-file.ts', { cwd: projectDirectory, stdio: 'pipe' });

      const result = runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, 'new-file.ts'),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      // Should count ~50 lines (insertions only, no deletions line)
      expect(state.locSinceCommit).toBeGreaterThanOrEqual(40);
      expect(state.locSinceCommit).toBeLessThan(100);
    });
  });

  // =========================================================================
  // Suite 5: TDD Gate Namespace + additionalContext + Commit-Prefix Removal
  // =========================================================================
  describe('TDD Gate Namespace', () => {
    it('1: TDD gates no longer block edits (reminders via prompt hook)', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'implement',
        lastKnownTddStep: null,
        gate: 'tdd:refactor',
      });

      const result = runPreToolQuality(projectDirectory, 'Edit');

      // TDD gates are now reminders, not blocks
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('2: deny without additionalContext omits the field', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 450,
        lastCommitHash: head,
        activeTicket: null,
        lastKnownPhase: null,
        lastKnownTddStep: null,
        gate: 'loc',
      });

      const result = runPreToolQuality(projectDirectory, 'Edit');

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(output.hookSpecificOutput.additionalContext).toBeUndefined();
    });

    it('3: LOC gate is the only hard gate remaining', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 500,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'implement',
        lastKnownTddStep: null,
        gate: 'loc',
      });

      // Create a large file to trigger LOC threshold
      const lines = Array.from({ length: 420 }, (_, i) => `const x${i} = ${i};`).join('\n');
      writeTestFile(projectDirectory, 'large-file.ts', lines);
      execSync('git add large-file.ts', { cwd: projectDirectory, stdio: 'pipe' });

      const result = runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, 'large-file.ts'),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      // LOC gate blocks — it's the only hard gate remaining
      expect(state.gate).toBe('loc');
    });

    it('4: feat: commit no longer sets refactor gate', () => {
      writeTestFile(projectDirectory, 'src/impl.ts', 'export const y = 2;\n');
      execSync('git add src/impl.ts && git commit -m "feat: add scenario implementation"', {
        cwd: projectDirectory,
        stdio: 'pipe',
      });

      writeState(projectDirectory, {
        locSinceCommit: 50,
        lastCommitHash: 'pre-commit-hash',
        activeTicket: '099',
        lastKnownPhase: 'implement',
        lastKnownTddStep: null,
        gate: null,
      });

      writeTestFile(projectDirectory, 'src/next.ts', 'export const z = 3;\n');
      execSync('git add src/next.ts', { cwd: projectDirectory, stdio: 'pipe' });

      const result = runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, 'src/next.ts'),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      expect(state.gate).toBeNull();
    });

    it('5: PreToolUse allows edits with tdd:refactor gate (reminders, not blocks)', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'implement',
        lastKnownTddStep: null,
        gate: 'tdd:refactor',
      });

      const result = runPreToolQuality(projectDirectory, 'Edit');

      // TDD gates no longer block — reminders via prompt hook
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('6: phase gate no longer blocks edits (reminders via prompt hook)', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'implement',
        lastKnownTddStep: null,
        gate: 'phase:implement',
      });

      const result = runPreToolQuality(projectDirectory, 'Edit');

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('14: PreToolUse allows edits with tdd:green gate (reminders, not blocks)', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'implement',
        lastKnownTddStep: null,
        gate: 'tdd:green',
      });

      const result = runPreToolQuality(projectDirectory, 'Edit');

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });
  });

  // =========================================================================
  // Suite 6: TDD Step Detection (test-definitions.md sub-checkboxes)
  // =========================================================================
  describe('TDD Step Detection', () => {
    /** Helper: write a test-definitions.md with scenario sub-checkboxes */
    function writeTestDefinitions(
      cwd: string,
      ticketFolder: string,
      scenarios: { name: string; red: boolean; green: boolean; refactor: boolean }[],
    ): string {
      const lines = ['# Test Definitions', ''];
      for (const scenario of scenarios) {
        lines.push(
          `### Scenario: ${scenario.name}`,
          `- [${scenario.red ? 'x' : ' '}] RED`,
          `- [${scenario.green ? 'x' : ' '}] GREEN`,
          `- [${scenario.refactor ? 'x' : ' '}] REFACTOR`,
          '',
        );
      }
      const relativePath = `.safeword-project/tickets/${ticketFolder}/test-definitions.md`;
      writeTestFile(cwd, relativePath, lines.join('\n'));
      return relativePath;
    }

    it('7: RED checkbox marked updates lastKnownTddStep (no gate)', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'implement',
        lastKnownTddStep: null,
        gate: null,
      });

      const testDefsPath = writeTestDefinitions(projectDirectory, '099-test', [
        { name: 'Login validation', red: true, green: false, refactor: false },
      ]);

      const result = runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, testDefsPath),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      // TDD step tracked for prompt hook reminders — no gate set
      expect(state.gate).toBeNull();
      expect(state.lastKnownTddStep).toBe('red');
    });

    it('8: GREEN checkbox marked updates lastKnownTddStep (no gate)', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'implement',
        lastKnownTddStep: 'red',
        gate: null,
      });

      const testDefsPath = writeTestDefinitions(projectDirectory, '099-test', [
        { name: 'Login validation', red: true, green: true, refactor: false },
      ]);

      const result = runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, testDefsPath),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      expect(state.gate).toBeNull();
      expect(state.lastKnownTddStep).toBe('green');
    });

    it('9: REFACTOR checkbox marked updates lastKnownTddStep (no gate)', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'implement',
        lastKnownTddStep: 'green',
        gate: null,
      });

      const testDefsPath = writeTestDefinitions(projectDirectory, '099-test', [
        { name: 'Login validation', red: true, green: true, refactor: true },
        { name: 'Password reset', red: false, green: false, refactor: false },
      ]);

      const result = runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, testDefsPath),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      expect(state.gate).toBeNull();
      expect(state.lastKnownTddStep).toBe('refactor');
    });

    it('10: no gate when TDD step unchanged', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'implement',
        lastKnownTddStep: 'red',
        gate: null,
      });

      const testDefsPath = writeTestDefinitions(projectDirectory, '099-test', [
        { name: 'Login validation', red: true, green: false, refactor: false },
      ]);

      const result = runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, testDefsPath),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      expect(state.gate).toBeNull();
    });

    it('11: TDD detection only during implement phase', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'decomposition',
        lastKnownTddStep: null,
        gate: null,
      });

      const testDefsPath = writeTestDefinitions(projectDirectory, '099-test', [
        { name: 'Login validation', red: true, green: false, refactor: false },
      ]);

      const result = runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, testDefsPath),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      expect(state.gate).toBeNull();
    });

    it('12: non-ticket test-definitions.md edit is ignored', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'implement',
        lastKnownTddStep: null,
        gate: null,
      });

      writeTestFile(
        projectDirectory,
        'docs/test-definitions.md',
        [
          '# Test Definitions',
          '',
          '### Scenario: Login',
          '- [x] RED',
          '- [ ] GREEN',
          '- [ ] REFACTOR',
        ].join('\n'),
      );

      const result = runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, 'docs/test-definitions.md'),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      expect(state.gate).toBeNull();
    });

    it('13: all-checked scenario with no next scenario fires no gate', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'implement',
        lastKnownTddStep: 'refactor',
        gate: null,
      });

      const testDefsPath = writeTestDefinitions(projectDirectory, '099-test', [
        { name: 'Login validation', red: true, green: true, refactor: true },
      ]);

      const result = runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, testDefsPath),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      expect(state.gate).toBeNull();
    });
  });

  // =========================================================================
  // Suite 7: Phase-Based Access Control
  // =========================================================================
  describe('Phase Access Control', () => {
    /** Helper: bind a ticket to the test session's state */
    function bindTicketToSession(cwd: string, ticketId: string, phase: string): void {
      const head = getHead(cwd);
      writeState(cwd, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: ticketId,
        lastKnownPhase: phase,
        lastKnownTddStep: null,
        gate: null,
      });
    }

    /** Helper: create a ticket at a given phase and status */
    function createTicket(
      cwd: string,
      id: string,
      slug: string,
      options: { phase: string; status: string; type?: string },
    ): void {
      const lastModified = new Date().toISOString();
      writeTestFile(
        cwd,
        `.safeword-project/tickets/${id}-${slug}/ticket.md`,
        [
          '---',
          `id: ${id}`,
          `type: ${options.type ?? 'task'}`,
          `phase: ${options.phase}`,
          `status: ${options.status}`,
          `last_modified: ${lastModified}`,
          '---',
          `# ${slug}`,
        ].join('\n'),
      );
    }

    it('7.1: allows code edits during planning phases (enforcement via reminders, not blocks)', () => {
      createTicket(projectDirectory, '099', 'test', { phase: 'intake', status: 'in_progress' });
      bindTicketToSession(projectDirectory, '099', 'intake');

      const codePath = nodePath.join(projectDirectory, 'src/foo.ts');
      const result = runPreToolQuality(projectDirectory, 'Edit', codePath);

      // Planning phases no longer block — prompt hook reminders guide the agent instead
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('7.2: allows code edits when active ticket at implement phase', () => {
      createTicket(projectDirectory, '099', 'test', { phase: 'implement', status: 'in_progress' });

      const codePath = nodePath.join(projectDirectory, 'src/foo.ts');
      const result = runPreToolQuality(projectDirectory, 'Edit', codePath);

      // No deny output — allowed
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('7.3: allows code edits at done phase (enforcement via done gate, not edit blocking)', () => {
      createTicket(projectDirectory, '099', 'test', { phase: 'done', status: 'in_progress' });
      bindTicketToSession(projectDirectory, '099', 'done');

      const codePath = nodePath.join(projectDirectory, 'src/foo.ts');
      const result = runPreToolQuality(projectDirectory, 'Edit', codePath);

      // Done phase no longer blocks edits — the stop hook's done gate handles completion evidence
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('7.4: allows code edits when no active ticket exists', () => {
      // No ticket created — no enforcement
      const codePath = nodePath.join(projectDirectory, 'src/foo.ts');
      const result = runPreToolQuality(projectDirectory, 'Edit', codePath);

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('7.5: ignores epic tickets (uses child ticket phase)', () => {
      // Epic at intake, child task at implement
      createTicket(projectDirectory, '100', 'epic', {
        phase: 'intake',
        status: 'in_progress',
        type: 'epic',
      });
      createTicket(projectDirectory, '101', 'child', { phase: 'implement', status: 'in_progress' });

      const codePath = nodePath.join(projectDirectory, 'src/foo.ts');
      const result = runPreToolQuality(projectDirectory, 'Edit', codePath);

      // Should allow — epic is skipped, child is at implement
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('7.6: ignores non-in_progress tickets', () => {
      // Ticket at intake but status is pending — not active
      createTicket(projectDirectory, '099', 'test', { phase: 'intake', status: 'pending' });

      const codePath = nodePath.join(projectDirectory, 'src/foo.ts');
      const result = runPreToolQuality(projectDirectory, 'Edit', codePath);

      // Should allow — ticket is not in_progress
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('7.7: meta paths (.safeword-project/, .claude/, .safeword/) allowed during planning', () => {
      createTicket(projectDirectory, '099', 'test', { phase: 'intake', status: 'in_progress' });

      const metaPaths = [
        '.safeword-project/tickets/099-test/ticket.md',
        '.claude/skills/bdd/DISCOVERY.md',
        '.safeword/hooks/pre-tool-quality.ts',
        '.cursor/settings.json',
      ];

      for (const relativePath of metaPaths) {
        const fullPath = nodePath.join(projectDirectory, relativePath);
        const result = runPreToolQuality(projectDirectory, 'Edit', fullPath);

        expect(result.status).toBe(0);
        expect(result.stdout).toBe('');
      }
    });

    it('7.8: allows edits when session ticket is done (status: done)', () => {
      createTicket(projectDirectory, '099', 'test', { phase: 'done', status: 'done' });
      bindTicketToSession(projectDirectory, '099', 'done');

      const codePath = nodePath.join(projectDirectory, 'src/foo.ts');
      const result = runPreToolQuality(projectDirectory, 'Edit', codePath);

      // Should allow — ticket is done (not in_progress)
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('7.9: allows edits when session ticket is backlog', () => {
      createTicket(projectDirectory, '099', 'test', { phase: 'intake', status: 'backlog' });
      bindTicketToSession(projectDirectory, '099', 'intake');

      const codePath = nodePath.join(projectDirectory, 'src/foo.ts');
      const result = runPreToolQuality(projectDirectory, 'Edit', codePath);

      // Should allow — ticket is backlog (not in_progress)
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('7.10: allows edits when session has no activeTicket even if planning ticket exists', () => {
      const head = getHead(projectDirectory);
      createTicket(projectDirectory, '099', 'test', { phase: 'intake', status: 'in_progress' });
      // Session state has NO activeTicket — session hasn't claimed this ticket
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: null,
        lastKnownPhase: null,
        lastKnownTddStep: null,
        gate: null,
      });

      const codePath = nodePath.join(projectDirectory, 'src/foo.ts');
      const result = runPreToolQuality(projectDirectory, 'Edit', codePath);

      // Should allow — session has no active ticket, so phase access doesn't apply
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });
  });

  // =========================================================================
  // Suite 8: Per-Session State Isolation
  // =========================================================================
  describe('Per-Session State', () => {
    it('8.1: sessions use separate state files', () => {
      // Create LOC gate in session-A
      const head = getHead(projectDirectory);
      writeState(
        projectDirectory,
        {
          locSinceCommit: 500,
          lastCommitHash: head,
          activeTicket: null,
          lastKnownPhase: null,
          lastKnownTddStep: null,
          gate: 'loc',
        },
        'session-A',
      );

      // Session-B has no state — should not be blocked
      const result = runPreToolQuality(projectDirectory, 'Edit', undefined, 'session-B');

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('8.2: session-A LOC gate does not block session-B', () => {
      const head = getHead(projectDirectory);

      // Session-A: LOC gate set (only hard gate remaining)
      writeState(
        projectDirectory,
        {
          locSinceCommit: 500,
          lastCommitHash: head,
          activeTicket: '099',
          lastKnownPhase: 'implement',
          lastKnownTddStep: null,
          gate: 'loc',
        },
        'session-A',
      );

      // Session-B: no gate
      writeState(
        projectDirectory,
        {
          locSinceCommit: 0,
          lastCommitHash: head,
          activeTicket: '099',
          lastKnownPhase: 'implement',
          lastKnownTddStep: null,
          gate: null,
        },
        'session-B',
      );

      // Session-A should be blocked (LOC gate)
      const resultA = runPreToolQuality(projectDirectory, 'Edit', undefined, 'session-A');
      expect(resultA.status).toBe(0);
      const outputA = JSON.parse(resultA.stdout);
      expect(outputA.hookSpecificOutput.permissionDecision).toBe('deny');

      // Session-B should pass
      const resultB = runPreToolQuality(projectDirectory, 'Edit', undefined, 'session-B');
      expect(resultB.status).toBe(0);
      expect(resultB.stdout).toBe('');
    });

    it('8.3: PostToolUse writes to session-specific state file', () => {
      writeTestFile(projectDirectory, 'src/foo.ts', 'export const x = 1;\n');
      execSync('git add src/foo.ts', { cwd: projectDirectory, stdio: 'pipe' });

      runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, 'src/foo.ts'),
        'session-X',
      );

      // Session-X state should exist
      expect(fileExists(projectDirectory, stateFilePath('session-X'))).toBe(true);
      const stateX = readState(projectDirectory, 'session-X');
      expect(stateX.lastCommitHash).toBe(getHead(projectDirectory));

      // Default test-session state should NOT exist
      expect(fileExists(projectDirectory, stateFilePath())).toBe(false);
    });
  });

  // =========================================================================
  // Suite 9: Artifact Prerequisite Gate (test-definitions.md requires ticket scope)
  // =========================================================================
  describe('Artifact Prerequisite Gate', () => {
    it('9.1: denies test-definitions.md creation when ticket.md is missing', () => {
      const testDefsPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/test-definitions.md',
      );
      const result = runPreToolQuality(projectDirectory, 'Write', testDefsPath);

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(output.hookSpecificOutput.permissionDecisionReason).toContain(
        'Cannot create test definitions',
      );
    });

    it('9.2: denies test-definitions.md when ticket has no scope fields', () => {
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
        ['---', 'id: 099', 'type: feature', 'phase: intake', '---', '# Test'].join('\n'),
      );

      const testDefsPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/test-definitions.md',
      );
      const result = runPreToolQuality(projectDirectory, 'Write', testDefsPath);

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(output.hookSpecificOutput.permissionDecisionReason).toContain('scope');
      expect(output.hookSpecificOutput.permissionDecisionReason).toContain('out_of_scope');
      expect(output.hookSpecificOutput.permissionDecisionReason).toContain('done_when');
    });

    it('9.3: allows test-definitions.md when ticket has all scope fields', () => {
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
        [
          '---',
          'id: 099',
          'type: feature',
          'phase: define-behavior',
          'scope: Build morning digest',
          'out_of_scope: Real-time alerts',
          'done_when: Daily digest delivered',
          '---',
          '# Test',
        ].join('\n'),
      );

      const testDefsPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/test-definitions.md',
      );
      const result = runPreToolQuality(projectDirectory, 'Write', testDefsPath);

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('9.4: denies when ticket has partial scope fields', () => {
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
        ['---', 'id: 099', 'scope: Build morning digest', '---', '# Test'].join('\n'),
      );

      const testDefsPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/test-definitions.md',
      );
      const result = runPreToolQuality(projectDirectory, 'Write', testDefsPath);

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      // scope is present, so only out_of_scope and done_when should be missing
      const reason = output.hookSpecificOutput.permissionDecisionReason;
      expect(reason).toContain('out_of_scope');
      expect(reason).toContain('done_when');
      expect(reason).not.toMatch(/\bscope,/); // "scope" alone isn't missing — only "out_of_scope" is
    });

    it('9.5: non-test-definitions files in .safeword-project/ bypass prerequisite', () => {
      const ticketPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
      );
      const result = runPreToolQuality(projectDirectory, 'Write', ticketPath);

      // ticket.md is not test-definitions.md — META_PATHS exemption applies
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });
  });
});
/* eslint-enable unicorn/no-null */
