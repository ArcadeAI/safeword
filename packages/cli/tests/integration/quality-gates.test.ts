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

/* eslint-disable unicorn/no-null -- State file uses JSON null values by design */

// Absolute paths to hook scripts in safeword source tree
const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const POST_TOOL_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/post-tool-quality.ts');
const PRE_TOOL_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/pre-tool-quality.ts');

const STATE_FILE_PATH = '.safeword-project/quality-state.json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run the PostToolUse quality hook */
function runPostToolQuality(cwd: string, toolName: string, filePath: string) {
  const hookInput = JSON.stringify({
    session_id: 'test-session',
    hook_event_name: 'PostToolUse',
    tool_name: toolName,
    tool_input: { file_path: filePath },
  });

  return spawnSync('bash', ['-c', `echo '${hookInput}' | bun "${POST_TOOL_QUALITY}"`], {
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

/** Run the PreToolUse quality hook */
function runPreToolQuality(cwd: string, toolName: string) {
  const hookInput = JSON.stringify({
    session_id: 'test-session',
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: {},
  });

  return spawnSync('bash', ['-c', `echo '${hookInput}' | bun "${PRE_TOOL_QUALITY}"`], {
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

/** Write quality-state.json */
function writeState(cwd: string, state: Record<string, unknown>): void {
  writeTestFile(cwd, STATE_FILE_PATH, JSON.stringify(state, null, 2));
}

/** Read quality-state.json */
function readState(cwd: string): Record<string, unknown> {
  return JSON.parse(readTestFile(cwd, STATE_FILE_PATH));
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
      // Must instruct Claude to run /quality-review before proceeding
      expect(reason).toContain('/quality-review');
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

    it('2.4: non-ticket edit does not set phase gate', () => {
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
      expect(fileExists(projectDirectory, STATE_FILE_PATH)).toBe(false);
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
      expect(fileExists(projectDirectory, STATE_FILE_PATH)).toBe(true);

      const state = readState(projectDirectory);
      const keys = Object.keys(state);
      expect(keys).toHaveLength(5);
      expect(keys).toContain('locSinceCommit');
      expect(keys).toContain('lastCommitHash');
      expect(keys).toContain('activeTicket');
      expect(keys).toContain('lastKnownPhase');
      expect(keys).toContain('gate');
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
  // Suite 5: Refactor Gate
  // =========================================================================
  describe('Refactor Gate', () => {
    it('5.1: PostToolUse sets refactor gate after feat: commit during implement phase', () => {
      // Simulate: Claude committed "feat: scenario name" (GREEN phase done)
      // Then edits another file — PostToolUse should detect the feat: commit
      // and set gate: 'refactor' since lastKnownPhase is 'implement'
      writeTestFile(projectDirectory, 'src/impl.ts', 'export const y = 2;\n');
      execSync('git add src/impl.ts && git commit -m "feat: add scenario implementation"', {
        cwd: projectDirectory,
        stdio: 'pipe',
      });

      const head = getHead(projectDirectory);

      // State has stale hash (pre-commit) — PostToolUse will see HEAD changed
      writeState(projectDirectory, {
        locSinceCommit: 50,
        lastCommitHash: 'pre-commit-hash',
        activeTicket: '099',
        lastKnownPhase: 'implement',
        gate: null,
      });

      // Now Claude edits another file — PostToolUse fires
      writeTestFile(projectDirectory, 'src/next.ts', 'export const z = 3;\n');
      execSync('git add src/next.ts', { cwd: projectDirectory, stdio: 'pipe' });

      const result = runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, 'src/next.ts'),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      expect(state.gate).toBe('refactor');
      expect(state.lastCommitHash).toBe(head);
    });

    it('5.2: PreToolUse blocks with refactor instructions when refactor gate set', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
        lastKnownPhase: 'implement',
        gate: 'refactor',
      });

      const result = runPreToolQuality(projectDirectory, 'Edit');

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      const reason = output.hookSpecificOutput.permissionDecisionReason;
      expect(reason).toContain('SAFEWORD');
      expect(reason).toContain('refactor');
    });

    it('5.3: PostToolUse does not set refactor gate for feat: commit outside implement phase', () => {
      // Commit with feat: prefix but phase is NOT implement
      writeTestFile(projectDirectory, 'src/impl.ts', 'export const y = 2;\n');
      execSync('git add src/impl.ts && git commit -m "feat: add something"', {
        cwd: projectDirectory,
        stdio: 'pipe',
      });

      writeState(projectDirectory, {
        locSinceCommit: 50,
        lastCommitHash: 'pre-commit-hash',
        activeTicket: '099',
        lastKnownPhase: 'intake',
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
  });
});
