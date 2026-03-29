/**
 * Integration Test: Quality Gates (Ticket #024)
 *
 * Verifies the PostToolUse → state file → PreToolUse pattern:
 * - PostToolUse counts LOC via `git diff --stat HEAD`, detects phase changes
 * - PreToolUse blocks edits when LOC > 400 or phase gate is set
 * - Gates clear when HEAD changes (commit happened)
 *
 * 15 scenarios across 5 suites: LOC Gate, Phase Gate, State Management, Edge Cases, Refactor Gate
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

    it('1.3: PreToolUse blocks with TDD reminder at LOC gate', () => {
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
      expect(reason).toContain('RED');
      expect(reason).toContain('GREEN');
      expect(reason).toContain('REFACTOR');
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
      expect(state.gate).toBe('phase:implement');
      expect(state.lastKnownPhase).toBe('implement');
    });

    it('2.2: PreToolUse blocks with phase file content and quality-review instruction', () => {
      // Create skill directory with a phase file containing known content
      const skillDirectory = '.claude/skills/bdd';
      writeTestFile(
        projectDirectory,
        `${skillDirectory}/TDD.md`,
        '# TDD Guide\n\nRED then GREEN then REFACTOR\n',
      );

      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'implement',
        gate: 'phase:implement',
      });

      const result = runPreToolQuality(projectDirectory, 'Edit');

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      const reason = output.hookSpecificOutput.permissionDecisionReason;
      expect(reason).toContain('SAFEWORD');
      expect(reason).toContain('implement');
      // Content must come from the actual file (read at runtime, not hardcoded)
      expect(reason).toContain('TDD Guide');
      // /quality-review instruction in additionalContext (not reason)
      expect(output.hookSpecificOutput.additionalContext).toContain('/quality-review');
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

    it('2.5: test-definitions.md edits also bypass TDD gate', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'implement',
        lastKnownTddStep: null,
        gate: 'tdd:green',
      });

      const testDefsPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/test-definitions.md',
      );
      const result = runPreToolQuality(projectDirectory, 'Edit', testDefsPath);

      // Should allow — all .safeword-project/ files are exempt
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
      // Real transition — gate should fire
      expect(state.lastKnownPhase).toBe('implement');
      expect(state.gate).toBe('phase:implement');
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
    it('1: deny with additionalContext includes both fields in output', () => {
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

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(output.hookSpecificOutput.permissionDecisionReason).toMatch(/.+/);
      expect(output.hookSpecificOutput.additionalContext).toContain('/tdd-review');
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

    it('3: LOC gate does not override tdd: gates', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 500,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'implement',
        lastKnownTddStep: null,
        gate: 'tdd:refactor',
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
      expect(state.gate).toBe('tdd:refactor');
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

    it('5: PreToolUse blocks with additionalContext for tdd:refactor gate', () => {
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

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      const reason = output.hookSpecificOutput.permissionDecisionReason;
      expect(reason).toContain('SAFEWORD');
      expect(reason).toContain('refactor');
      expect(output.hookSpecificOutput.additionalContext).toContain('/tdd-review');
    });

    it('6: phase gate uses additionalContext for quality-review', () => {
      const skillDirectory = '.claude/skills/bdd';
      writeTestFile(
        projectDirectory,
        `${skillDirectory}/TDD.md`,
        '# TDD Guide\n\nRED then GREEN then REFACTOR\n',
      );

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
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      const reason = output.hookSpecificOutput.permissionDecisionReason;
      expect(reason).toContain('SAFEWORD');
      expect(reason).toContain('implement');
      expect(reason).toContain('TDD Guide');
      expect(output.hookSpecificOutput.additionalContext).toContain('/quality-review');
    });

    it('14: PreToolUse blocks with step-appropriate message for tdd:green', () => {
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
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      const reason = output.hookSpecificOutput.permissionDecisionReason;
      expect(reason).toContain('SAFEWORD');
      expect(reason).toContain('green');
      expect(output.hookSpecificOutput.additionalContext).toContain('/tdd-review');
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

    it('7: RED checkbox marked sets tdd:green gate', () => {
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
      expect(state.gate).toBe('tdd:green');
    });

    it('8: GREEN checkbox marked sets tdd:refactor gate', () => {
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
      expect(state.gate).toBe('tdd:refactor');
    });

    it('9: REFACTOR checkbox marked sets tdd:red gate', () => {
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
      expect(state.gate).toBe('tdd:red');
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

    it('7.1: blocks code edits when active ticket at intake phase', () => {
      createTicket(projectDirectory, '099', 'test', { phase: 'intake', status: 'in_progress' });

      const codePath = nodePath.join(projectDirectory, 'src/foo.ts');
      const result = runPreToolQuality(projectDirectory, 'Edit', codePath);

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(output.hookSpecificOutput.permissionDecisionReason).toContain('intake');
      expect(output.hookSpecificOutput.permissionDecisionReason).toContain('implement');
    });

    it('7.2: allows code edits when active ticket at implement phase', () => {
      createTicket(projectDirectory, '099', 'test', { phase: 'implement', status: 'in_progress' });

      const codePath = nodePath.join(projectDirectory, 'src/foo.ts');
      const result = runPreToolQuality(projectDirectory, 'Edit', codePath);

      // No deny output — allowed
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('7.3: blocks code edits when active ticket at done phase', () => {
      createTicket(projectDirectory, '099', 'test', { phase: 'done', status: 'in_progress' });

      const codePath = nodePath.join(projectDirectory, 'src/foo.ts');
      const result = runPreToolQuality(projectDirectory, 'Edit', codePath);

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(output.hookSpecificOutput.permissionDecisionReason).toContain('done');
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

    it('8.2: session-A gate does not block session-B', () => {
      const head = getHead(projectDirectory);

      // Session-A: phase gate set
      writeState(
        projectDirectory,
        {
          locSinceCommit: 0,
          lastCommitHash: head,
          activeTicket: '099',
          lastKnownPhase: 'implement',
          lastKnownTddStep: null,
          gate: 'phase:implement',
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

      // Session-A should be blocked
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
});
/* eslint-enable unicorn/no-null */
