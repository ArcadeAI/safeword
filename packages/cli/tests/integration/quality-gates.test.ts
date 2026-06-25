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
import { rmSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

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
  toolInput: Record<string, unknown> = {},
) {
  return spawnSync('bun', [PRE_TOOL_QUALITY], {
    input: JSON.stringify({
      session_id: sessionId,
      hook_event_name: 'PreToolUse',
      tool_name: toolName,
      tool_input: filePath ? { file_path: filePath, ...toolInput } : toolInput,
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

/** Write a test-definitions.md with scenario sub-checkboxes */
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

/** Bind a ticket to the test session's state */
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

/** Create a ticket at a given phase and status */
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

/** Create a ticket with full frontmatter (includes scope/out_of_scope/done_when) */
function createFullTicket(
  cwd: string,
  id: string,
  slug: string,
  options: { phase: string; status: string; type: string },
): void {
  const lastModified = new Date().toISOString();
  writeTestFile(
    cwd,
    `.safeword-project/tickets/${id}-${slug}/ticket.md`,
    [
      '---',
      `id: ${id}`,
      `type: ${options.type}`,
      `phase: ${options.phase}`,
      `status: ${options.status}`,
      `last_modified: ${lastModified}`,
      'scope: test scope',
      'out_of_scope: nothing',
      'done_when: tests pass',
      '---',
      `# ${slug}`,
    ].join('\n'),
  );
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

    it('1.3: PostToolUse clears LOC gate when diff drops below threshold without commit', () => {
      const largeFilePath = nodePath.join(projectDirectory, 'large-file.ts');
      const lines = Array.from({ length: 420 }, (_, i) => `const x${i} = ${i};`).join('\n');
      writeTestFile(projectDirectory, 'large-file.ts', lines);
      execSync('git add large-file.ts', { cwd: projectDirectory, stdio: 'pipe' });

      const armedResult = runPostToolQuality(projectDirectory, 'Edit', largeFilePath);

      expect(armedResult.status).toBe(0);
      expect(readState(projectDirectory).gate).toBe('loc');

      execSync('git restore --staged large-file.ts', { cwd: projectDirectory, stdio: 'pipe' });
      rmSync(largeFilePath);

      const clearedResult = runPostToolQuality(projectDirectory, 'Bash', largeFilePath);

      expect(clearedResult.status).toBe(0);
      const state = readState(projectDirectory);
      expect(state.locSinceCommit).toBe(0);
      expect(state.gate).toBeNull();
    });

    it('1.4: PreToolUse blocks with commit reminder at LOC gate', () => {
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
      expect(reason).toContain('450 LOC');
      expect(reason).toContain('Commit');
      // ZCYD5P: every hard-block gate message points to /explain.
      expect(reason).toContain('Run `/explain` for a plain-English version');
      // 19E2XQ: the hint also rides systemMessage — the field Claude Code
      // surfaces to the USER (permissionDecisionReason reaches the model and can
      // be swallowed before the human sees it, issue #17356).
      expect(output.systemMessage).toContain('Run `/explain` for a plain-English version');
    });

    it('1.5: PreToolUse allows stale LOC gate when stored LOC is below threshold', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: null,
        lastKnownPhase: null,
        gate: 'loc',
      });

      const result = runPreToolQuality(projectDirectory, 'Edit');

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
    });

    it('1.6: LOC gate clears on commit', () => {
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
    it('2.1: PostToolUse binds activeTicket but does not cache phase', () => {
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
        activeTicket: null,
        gate: null,
      });

      const result = runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, ticketPath),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      // Phase is no longer cached — derived at read time via getTicketInfo()
      expect(state.gate).toBeNull();
      expect(state.activeTicket).toBe('099');
      expect(state).not.toHaveProperty('lastKnownPhase');
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
      // LOC should still be tracked (file has 1 line)
      expect(state.locSinceCommit).toBeGreaterThan(0);
    });

    it('2.8: ticket creation binds activeTicket without caching phase', () => {
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
        gate: null,
      });

      const result = runPostToolQuality(
        projectDirectory,
        'Write',
        nodePath.join(projectDirectory, ticketPath),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      expect(state.gate).toBeNull();
      expect(state.activeTicket).toBe('099');
      expect(state).not.toHaveProperty('lastKnownPhase');
    });

    it('2.9: ticket edit binds activeTicket without caching phase', () => {
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
        gate: null,
      });

      const result = runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, ticketPath),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      expect(state.activeTicket).toBe('099');
      expect(state).not.toHaveProperty('lastKnownPhase');
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

    it('3.2: PostToolUse creates state file with 9 fields', () => {
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
      expect(keys).toContain('gate');
      expect(keys).toContain('recentFailures');
      expect(keys).toContain('incrementedPatterns');
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
    it('7: RED checkbox edit does not cache TDD step in state', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
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
      expect(state).not.toHaveProperty('lastKnownTddStep');
    });

    it('8: GREEN checkbox edit does not cache TDD step in state', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
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
      expect(state).not.toHaveProperty('lastKnownTddStep');
    });

    it('9: REFACTOR checkbox edit does not cache TDD step in state', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
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
      expect(state).not.toHaveProperty('lastKnownTddStep');
    });

    it('10: test-definitions edit does not set any gate', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
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

    it('11: test-definitions edit in non-implement phase sets no gate', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '099',
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

    it('9.2b: denies when scope fields are present but empty lists (9S6600)', () => {
      // `scope:` with no items parses to an empty array; the gate must treat
      // that as missing, not present. dimensions.md is supplied so the only
      // gate that can fire is the scope-fields check.
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
        [
          '---',
          'id: 099',
          'type: feature',
          'phase: define-behavior',
          'scope:',
          'out_of_scope:',
          'done_when:',
          '---',
          '# Test',
        ].join('\n'),
      );
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/dimensions.md',
        '| Dimension | Partitions |\n|---|---|\n| D | a, b |\n',
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
    });

    it('9.3: allows test-definitions.md when ticket has all scope fields and dimensions.md exists', () => {
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
      // Features require dimensions.md before test-definitions.md
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/dimensions.md',
        '| Dimension | Partitions |\n|---|---|\n| Delivery | email, slack |\n',
      );
      // ...and a spec.md (ticket 9EA27P). This suite tests the scope/dimensions
      // prerequisite, not JTBD content, so skip the JTBD enumeration.
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/spec.md',
        '# Spec\n\n## Jobs To Be Done\n\nskip: prerequisite-gate fixture; JTBD/AC content covered in jtbd-gate.test.ts\n',
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

    it('9.5: editing existing test-definitions.md is allowed (gate only fires on creation)', () => {
      // Create ticket WITHOUT scope fields
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
        ['---', 'id: 099', 'type: feature', '---', '# Test'].join('\n'),
      );
      // Create existing test-definitions.md
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/test-definitions.md',
        '# Existing scenarios\n',
      );

      const testDefsPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/test-definitions.md',
      );
      const result = runPreToolQuality(projectDirectory, 'Edit', testDefsPath);

      // Allowed — file already exists, prerequisite only gates creation
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('9.6: denies test-definitions.md when ticket is still in intake phase', () => {
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
        [
          '---',
          'id: 099',
          'type: feature',
          'phase: intake',
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
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(output.hookSpecificOutput.permissionDecisionReason).toContain('intake phase');
    });

    it('9.7: denies test-definitions.md for features without dimensions.md', () => {
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
      // Remove dimensions.md if it exists from prior test
      const dimensionsPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/dimensions.md',
      );
      try {
        execSync(`rm -f "${dimensionsPath}"`);
      } catch {
        // ignore — file may not exist
      }

      const testDefsPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/test-definitions.md',
      );
      const result = runPreToolQuality(projectDirectory, 'Write', testDefsPath);

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(output.hookSpecificOutput.permissionDecisionReason).toContain('dimensions.md');
    });

    it('9.8: allows test-definitions.md for features with dimensions.md', () => {
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
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/dimensions.md',
        '| Dimension | Partitions |\n|---|---|\n| Delivery | email, slack |\n',
      );
      // Features now require spec.md too (ticket 9EA27P); skip JTBD enumeration.
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/spec.md',
        '# Spec\n\n## Jobs To Be Done\n\nskip: prerequisite-gate fixture; JTBD/AC content covered in jtbd-gate.test.ts\n',
      );

      const testDefsPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/test-definitions.md',
      );
      const result = runPreToolQuality(projectDirectory, 'Write', testDefsPath);

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('9.9: allows test-definitions.md for tasks without dimensions.md (feature-only gate)', () => {
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
        [
          '---',
          'id: 099',
          'type: task',
          'phase: define-behavior',
          'scope: Fix button color',
          'out_of_scope: Layout changes',
          'done_when: Button is red',
          '---',
          '# Test',
        ].join('\n'),
      );
      // No dimensions.md — tasks don't require it
      const dimensionsPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/dimensions.md',
      );
      try {
        execSync(`rm -f "${dimensionsPath}"`);
      } catch {
        // ignore — file may not exist
      }

      const testDefsPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/test-definitions.md',
      );
      const result = runPreToolQuality(projectDirectory, 'Write', testDefsPath);

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('9.10: non-test-definitions files in .safeword-project/ bypass prerequisite', () => {
      const ticketPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
      );
      const result = runPreToolQuality(projectDirectory, 'Write', ticketPath);

      // ticket.md is not test-definitions.md — META_PATHS exemption applies
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    // -----------------------------------------------------------------------
    // Ticket MKVNFB: dimensions.md may be satisfied by `skip: <reason>` instead
    // of a real dimension table. Reuses isValidSkipReason from J7VBGJ.
    // -----------------------------------------------------------------------

    it('9.11: allows test-definitions.md when dimensions.md is `skip: <non-empty reason>`', () => {
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
        [
          '---',
          'id: 099',
          'type: feature',
          'phase: define-behavior',
          'scope: One trivial behavioral dimension',
          'out_of_scope: Nothing',
          'done_when: Behavior works',
          '---',
        ].join('\n'),
      );
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/dimensions.md',
        'skip: single behavioral dimension, no partitioning to enumerate\n',
      );
      // Features now require spec.md too (ticket 9EA27P); skip JTBD enumeration.
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/spec.md',
        '# Spec\n\n## Jobs To Be Done\n\nskip: prerequisite-gate fixture; JTBD/AC content covered in jtbd-gate.test.ts\n',
      );

      const testDefsPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/test-definitions.md',
      );
      const result = runPreToolQuality(projectDirectory, 'Write', testDefsPath);

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('9.12: denies test-definitions.md when dimensions.md is `skip:` with empty reason', () => {
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
        [
          '---',
          'id: 099',
          'type: feature',
          'phase: define-behavior',
          'scope: x',
          'out_of_scope: x',
          'done_when: x',
          '---',
        ].join('\n'),
      );
      writeTestFile(projectDirectory, '.safeword-project/tickets/099-test/dimensions.md', 'skip:');

      const testDefsPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/test-definitions.md',
      );
      const result = runPreToolQuality(projectDirectory, 'Write', testDefsPath);

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(output.hookSpecificOutput.permissionDecisionReason).toContain('non-empty reason');
    });

    it('9.13: denies test-definitions.md when dimensions.md is `skip:` with whitespace-only reason', () => {
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
        [
          '---',
          'id: 099',
          'type: feature',
          'phase: define-behavior',
          'scope: x',
          'out_of_scope: x',
          'done_when: x',
          '---',
        ].join('\n'),
      );
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/dimensions.md',
        'skip:    \n',
      );

      const testDefsPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/test-definitions.md',
      );
      const result = runPreToolQuality(projectDirectory, 'Write', testDefsPath);

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(output.hookSpecificOutput.permissionDecisionReason).toContain('non-empty reason');
    });

    it('9.14: denies feature phase advance into define-behavior when scope frontmatter is missing', () => {
      const ticketPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
      );
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
        ['---', 'id: 099', 'type: feature', 'phase: intake', '---', '# Test'].join('\n'),
      );

      const result = runPreToolQuality(projectDirectory, 'Edit', ticketPath, 'test-session', {
        old_string: 'phase: intake',
        new_string: 'phase: define-behavior',
      });

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      const reason = output.hookSpecificOutput.permissionDecisionReason;
      expect(reason).toContain('Feature ticket is not ready for define-behavior');
      expect(reason).toContain('scope');
      expect(reason).toContain('out_of_scope');
      expect(reason).toContain('done_when');
    });

    it('9.15: denies feature phase advance into define-behavior when spec and dimensions are missing', () => {
      const ticketPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
      );
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
        [
          '---',
          'id: 099',
          'type: feature',
          'phase: intake',
          'scope: Build morning digest',
          'out_of_scope: Real-time alerts',
          'done_when: Daily digest delivered',
          '---',
          '# Test',
        ].join('\n'),
      );

      const result = runPreToolQuality(projectDirectory, 'Edit', ticketPath, 'test-session', {
        old_string: 'phase: intake',
        new_string: 'phase: define-behavior',
      });

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      const reason = output.hookSpecificOutput.permissionDecisionReason;
      expect(reason).toContain('spec.md');
      expect(reason).toContain('dimensions.md');
    });

    it('9.16: allows ready feature phase advance into define-behavior', () => {
      const ticketPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
      );
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
        [
          '---',
          'id: 099',
          'type: feature',
          'phase: intake',
          'scope: Build morning digest',
          'out_of_scope: Real-time alerts',
          'done_when: Daily digest delivered',
          '---',
          '# Test',
        ].join('\n'),
      );
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/spec.md',
        '# Spec\n\n## Jobs To Be Done\n\nskip: ready fixture; JTBD/AC content covered elsewhere\n',
      );
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/dimensions.md',
        'skip: single behavioral dimension, no partitioning to enumerate\n',
      );

      const result = runPreToolQuality(projectDirectory, 'Edit', ticketPath, 'test-session', {
        old_string: 'phase: intake',
        new_string: 'phase: define-behavior',
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('9.17: does not apply feature readiness to task phase advance', () => {
      const ticketPath = nodePath.join(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
      );
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
        ['---', 'id: 099', 'type: task', 'phase: intake', '---', '# Test'].join('\n'),
      );

      const result = runPreToolQuality(projectDirectory, 'Edit', ticketPath, 'test-session', {
        old_string: 'phase: intake',
        new_string: 'phase: define-behavior',
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });
  });
  // =========================================================================
  // Suite 10: Novel Research Reminder (Ticket #126)
  // =========================================================================
  describe('Novel Research Reminder', () => {
    it('10.1: PostToolUse appends learnings file to pending array on first edit', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: null,
        gate: null,
      });

      const learningPath = nodePath.join(
        projectDirectory,
        '.safeword-project/learnings/test-learning.md',
      );
      writeTestFile(projectDirectory, '.safeword-project/learnings/test-learning.md', '# Learning');

      const result = runPostToolQuality(projectDirectory, 'Write', learningPath);

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      expect(state.learningsNudgesPending).toEqual([learningPath]);
      expect(state.learningsNudgesAcknowledged ?? []).toEqual([]);
    });

    it('10.2: PostToolUse does not arm pending for non-learnings files', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: null,
        gate: null,
      });

      writeTestFile(projectDirectory, 'src/foo.ts', 'export const x = 1;\n');
      execSync('git add src/foo.ts', { cwd: projectDirectory, stdio: 'pipe' });

      const result = runPostToolQuality(
        projectDirectory,
        'Edit',
        nodePath.join(projectDirectory, 'src/foo.ts'),
      );

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      expect(state.learningsNudgesPending ?? []).toEqual([]);
    });

    it('10.3: per-fingerprint dedup — re-editing the same file does not re-arm', () => {
      const head = getHead(projectDirectory);
      const learningPath = nodePath.join(
        projectDirectory,
        '.safeword-project/learnings/already-armed.md',
      );
      // State already has this file in pending — second edit should not re-arm.
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: null,
        gate: null,
        learningsNudgesPending: [learningPath],
      });

      writeTestFile(projectDirectory, '.safeword-project/learnings/already-armed.md', '# Update');
      const result = runPostToolQuality(projectDirectory, 'Edit', learningPath);

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      // Still exactly one entry — not duplicated.
      expect(state.learningsNudgesPending).toEqual([learningPath]);
    });

    it('10.3b: per-fingerprint dedup — editing an already-acknowledged file does not re-arm', () => {
      const head = getHead(projectDirectory);
      const learningPath = nodePath.join(
        projectDirectory,
        '.safeword-project/learnings/already-acked.md',
      );
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: null,
        gate: null,
        learningsNudgesPending: [],
        learningsNudgesAcknowledged: [learningPath],
      });

      writeTestFile(projectDirectory, '.safeword-project/learnings/already-acked.md', '# Update');
      const result = runPostToolQuality(projectDirectory, 'Edit', learningPath);

      expect(result.status).toBe(0);

      const state = readState(projectDirectory);
      expect(state.learningsNudgesPending ?? []).toEqual([]);
      expect(state.learningsNudgesAcknowledged).toEqual([learningPath]);
    });

    it('10.4: prompt hook injects reminder naming the file and moves pending → acknowledged', () => {
      writeTestFile(projectDirectory, '.safeword/.gitkeep', '');

      const learningPath = '.safeword-project/learnings/probe.md';
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: getHead(projectDirectory),
        activeTicket: null,
        gate: null,
        learningsNudgesPending: [learningPath],
      });

      const PROMPT_QUESTIONS = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/prompt-questions.ts');

      const result = spawnSync('bun', [PROMPT_QUESTIONS], {
        input: JSON.stringify({ session_id: 'test-session' }),
        cwd: projectDirectory,
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
        encoding: 'utf8',
        timeout: TIMEOUT_QUICK,
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Novel claim detected');
      expect(result.stdout).toContain('probe.md');
      expect(result.stdout).toContain('/quality-review');

      const state = readState(projectDirectory);
      expect(state.learningsNudgesPending).toEqual([]);
      expect(state.learningsNudgesAcknowledged).toEqual([learningPath]);
    });

    it('10.5: prompt hook does not inject reminder when pending is empty', () => {
      writeTestFile(projectDirectory, '.safeword/.gitkeep', '');

      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: getHead(projectDirectory),
        activeTicket: null,
        gate: null,
      });

      const PROMPT_QUESTIONS = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/prompt-questions.ts');

      const result = spawnSync('bun', [PROMPT_QUESTIONS], {
        input: JSON.stringify({ session_id: 'test-session' }),
        cwd: projectDirectory,
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
        encoding: 'utf8',
        timeout: TIMEOUT_QUICK,
      });

      expect(result.status).toBe(0);
      expect(result.stdout).not.toContain('Novel claim');
    });
  });

  // =========================================================================
  // Suite 11: Implement Phase Requires test-definitions.md (Ticket #128)
  // Features at implement phase must have test-definitions.md before editing app code.
  // Tasks are exempt. META_PATHS are exempt (handled earlier in hook).
  // =========================================================================
  describe('Implement Phase Requires test-definitions.md', () => {
    it('11.1: denies app code edit for feature at implement phase without test-definitions.md', () => {
      createFullTicket(projectDirectory, '200', 'feat-gate', {
        phase: 'implement',
        status: 'in_progress',
        type: 'feature',
      });

      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '200',
        gate: null,
      });

      const codePath = nodePath.join(projectDirectory, 'src/app.ts');
      const result = runPreToolQuality(projectDirectory, 'Edit', codePath);

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(output.hookSpecificOutput.permissionDecisionReason).toContain('test-definitions.md');
    });

    it('11.2: allows app code edit for feature at implement phase WITH test-definitions.md', () => {
      createFullTicket(projectDirectory, '201', 'feat-ok', {
        phase: 'implement',
        status: 'in_progress',
        type: 'feature',
      });
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/201-feat-ok/test-definitions.md',
        '### Scenario: Login\n- [ ] RED\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );

      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '201',
        gate: null,
      });

      const codePath = nodePath.join(projectDirectory, 'src/app.ts');
      const result = runPreToolQuality(projectDirectory, 'Edit', codePath);

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('11.3: allows app code edit for task at implement phase without test-definitions.md', () => {
      createFullTicket(projectDirectory, '202', 'task-exempt', {
        phase: 'implement',
        status: 'in_progress',
        type: 'task',
      });

      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '202',
        gate: null,
      });

      const codePath = nodePath.join(projectDirectory, 'src/app.ts');
      const result = runPreToolQuality(projectDirectory, 'Edit', codePath);

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('11.4: allows app code edit when no active ticket', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: null,
        gate: null,
      });

      const codePath = nodePath.join(projectDirectory, 'src/app.ts');
      const result = runPreToolQuality(projectDirectory, 'Edit', codePath);

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('11.5: allows app code edit for feature at non-implement phase', () => {
      createFullTicket(projectDirectory, '203', 'feat-intake', {
        phase: 'intake',
        status: 'in_progress',
        type: 'feature',
      });

      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '203',
        gate: null,
      });

      const codePath = nodePath.join(projectDirectory, 'src/app.ts');
      const result = runPreToolQuality(projectDirectory, 'Edit', codePath);

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('11.6: allows app code edit when state file missing (no session context)', () => {
      createFullTicket(projectDirectory, '204', 'feat-no-state', {
        phase: 'implement',
        status: 'in_progress',
        type: 'feature',
      });

      // No state file — hook should exit cleanly
      const codePath = nodePath.join(projectDirectory, 'src/app.ts');
      const result = runPreToolQuality(projectDirectory, 'Edit', codePath);

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('11.7: records failure pattern when gate fires', () => {
      createFullTicket(projectDirectory, '205', 'feat-record', {
        phase: 'implement',
        status: 'in_progress',
        type: 'feature',
      });

      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 0,
        lastCommitHash: head,
        activeTicket: '205',
        gate: null,
        recentFailures: [],
        incrementedPatterns: [],
      });

      const codePath = nodePath.join(projectDirectory, 'src/app.ts');
      runPreToolQuality(projectDirectory, 'Edit', codePath);

      const state = readState(projectDirectory);
      const failures = state.recentFailures as { pattern: string }[];
      expect(failures.some(f => f.pattern === 'implement-without-test-definitions')).toBe(true);
    });
  });
});
/* eslint-enable unicorn/no-null */
