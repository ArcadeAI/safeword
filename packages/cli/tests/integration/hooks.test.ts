/**
 * E2E Test: Claude Code Hooks
 *
 * Verifies that all safeword hooks work correctly:
 * - SessionStart hooks (version, verify-agents, lint-check)
 * - UserPromptSubmit hooks (timestamp, questions)
 * - Stop hook (quality review reminder)
 * - PostToolUse hook (auto-lint) - tested in golden-path.test.ts
 *
 * Uses a single project setup (expensive) shared across all tests.
 */

import { execSync, spawnSync } from 'node:child_process';
import nodePath from 'node:path';
import process from 'node:process';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  initGitRepo,
  isRuffInstalled,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers';

const RUFF_AVAILABLE = isRuffInstalled();

// Single setup for all hook tests - sharing avoids 3 separate bun installs
// Tests must be idempotent or restore state after modification (see try/finally blocks)
let projectDirectory: string;

beforeAll(async () => {
  projectDirectory = createTemporaryDirectory();
  createTypeScriptPackageJson(projectDirectory);
  initGitRepo(projectDirectory);
  await runCli(['setup', '--yes'], { cwd: projectDirectory });
}, 180_000);

afterAll(() => {
  if (projectDirectory) {
    removeTemporaryDirectory(projectDirectory);
  }
});

describe('E2E: SessionStart Hooks', () => {
  describe('session-bun-check.sh', () => {
    it('exits silently when bun is available', () => {
      const result = spawnSync('bash', ['.safeword/hooks/session-bun-check.sh'], {
        cwd: projectDirectory,
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
    });

    it('exits silently for non-safeword project', () => {
      const nonSafewordDirectory = createTemporaryDirectory();
      try {
        const result = spawnSync(
          'bash',
          [nodePath.join(projectDirectory, '.safeword/hooks/session-bun-check.sh')],
          {
            cwd: nonSafewordDirectory,
            env: { ...process.env, CLAUDE_PROJECT_DIR: nonSafewordDirectory },
            encoding: 'utf8',
          },
        );

        expect(result.status).toBe(0);
      } finally {
        removeTemporaryDirectory(nonSafewordDirectory);
      }
    });

    it('hard-blocks with exit 2 when bun is not in PATH', () => {
      const result = spawnSync('bash', ['.safeword/hooks/session-bun-check.sh'], {
        cwd: projectDirectory,
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: projectDirectory,
          // Override PATH to exclude bun
          PATH: '/usr/bin:/bin',
        },
        encoding: 'utf8',
      });

      expect(result.status).toBe(2);
      expect(result.stderr).toContain('bun is required');
      expect(result.stderr).toContain('quality hooks');
      expect(result.stderr).toContain('Install');
    });
  });

  describe('session-version.ts', () => {
    it('outputs version message for safeword project', () => {
      const output = execSync('bun .safeword/hooks/session-version.ts', {
        cwd: projectDirectory,
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
        encoding: 'utf8',
      });

      expect(output).toContain('SAFE WORD');
      expect(output).toContain('installed');
      expect(output).toMatch(/v\d+\.\d+\.\d+/); // Version format
    });

    it('exits silently for non-safeword project', () => {
      const nonSafewordDirectory = createTemporaryDirectory();
      try {
        // Run in a directory without .safeword
        const output = execSync('bun .safeword/hooks/session-version.ts', {
          cwd: projectDirectory, // Script is here
          env: { ...process.env, CLAUDE_PROJECT_DIR: nonSafewordDirectory }, // But points to non-safeword dir
          encoding: 'utf8',
        });

        // Should output nothing (silent exit)
        expect(output.trim()).toBe('');
      } finally {
        removeTemporaryDirectory(nonSafewordDirectory);
      }
    });
  });

  describe('session-verify-agents.ts', () => {
    it('creates AGENTS.md if missing', () => {
      // Remove AGENTS.md
      execSync('rm -f AGENTS.md', { cwd: projectDirectory });
      expect(fileExists(projectDirectory, 'AGENTS.md')).toBe(false);

      const output = execSync('bun .safeword/hooks/session-verify-agents.ts', {
        cwd: projectDirectory,
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
        encoding: 'utf8',
      });

      expect(fileExists(projectDirectory, 'AGENTS.md')).toBe(true);
      expect(output).toContain('Created AGENTS.md');

      const content = readTestFile(projectDirectory, 'AGENTS.md');
      expect(content).toContain('.safeword/SAFEWORD.md');
    });

    it('restores link if removed from AGENTS.md', () => {
      // Overwrite AGENTS.md without the link
      writeTestFile(projectDirectory, 'AGENTS.md', '# My Project\n\nSome content\n');

      const output = execSync('bun .safeword/hooks/session-verify-agents.ts', {
        cwd: projectDirectory,
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
        encoding: 'utf8',
      });

      expect(output).toContain('Restored AGENTS.md link');

      const content = readTestFile(projectDirectory, 'AGENTS.md');
      expect(content).toContain('.safeword/SAFEWORD.md');
      expect(content).toContain('My Project'); // Original content preserved
    });

    it('does nothing if link already present', () => {
      // Ensure link is present
      const originalContent = readTestFile(projectDirectory, 'AGENTS.md');
      expect(originalContent).toContain('.safeword/SAFEWORD.md');

      const output = execSync('bun .safeword/hooks/session-verify-agents.ts', {
        cwd: projectDirectory,
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
        encoding: 'utf8',
      });

      // Should be silent (no action needed)
      expect(output.trim()).toBe('');

      // Content unchanged
      const newContent = readTestFile(projectDirectory, 'AGENTS.md');
      expect(newContent).toBe(originalContent);
    });

    it('exits silently for non-safeword project', () => {
      const nonSafewordDirectory = createTemporaryDirectory();
      try {
        const output = execSync('bun .safeword/hooks/session-verify-agents.ts', {
          cwd: projectDirectory,
          env: { ...process.env, CLAUDE_PROJECT_DIR: nonSafewordDirectory },
          encoding: 'utf8',
        });

        expect(output.trim()).toBe('');
      } finally {
        removeTemporaryDirectory(nonSafewordDirectory);
      }
    });
  });

  describe('session-lint-check.ts', () => {
    it('outputs no warnings when lint configs exist', () => {
      // Project should have eslint and prettier after setup
      expect(fileExists(projectDirectory, 'eslint.config.mjs')).toBe(true);
      expect(fileExists(projectDirectory, '.prettierrc')).toBe(true);

      const output = execSync('bun .safeword/hooks/session-lint-check.ts', {
        cwd: projectDirectory,
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
        encoding: 'utf8',
      });

      // Should not contain warnings
      expect(output).not.toContain('⚠️');
    });

    it('warns when ESLint config is missing', () => {
      // Temporarily remove ESLint config
      execSync('mv eslint.config.mjs eslint.config.mjs.bak', {
        cwd: projectDirectory,
      });

      try {
        const output = execSync('bun .safeword/hooks/session-lint-check.ts', {
          cwd: projectDirectory,
          env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
          encoding: 'utf8',
        });

        expect(output).toContain('ESLint config not found');
      } finally {
        // Restore ESLint config
        execSync('mv eslint.config.mjs.bak eslint.config.mjs', {
          cwd: projectDirectory,
        });
      }
    });

    it('warns when Prettier config is missing', () => {
      // Temporarily remove Prettier config
      execSync('mv .prettierrc .prettierrc.bak', { cwd: projectDirectory });

      try {
        const output = execSync('bun .safeword/hooks/session-lint-check.ts', {
          cwd: projectDirectory,
          env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
          encoding: 'utf8',
        });

        expect(output).toContain('Prettier config not found');
      } finally {
        // Restore Prettier config
        execSync('mv .prettierrc.bak .prettierrc', { cwd: projectDirectory });
      }
    });

    it('exits silently for non-safeword project', () => {
      const nonSafewordDirectory = createTemporaryDirectory();
      try {
        const output = execSync('bun .safeword/hooks/session-lint-check.ts', {
          cwd: projectDirectory,
          env: { ...process.env, CLAUDE_PROJECT_DIR: nonSafewordDirectory },
          encoding: 'utf8',
        });

        expect(output.trim()).toBe('');
      } finally {
        removeTemporaryDirectory(nonSafewordDirectory);
      }
    });
  });
});

describe('E2E: UserPromptSubmit Hooks', () => {
  describe('prompt-timestamp.ts', () => {
    it('outputs current timestamp in expected format', () => {
      const output = execSync('bun .safeword/hooks/prompt-timestamp.ts', {
        cwd: projectDirectory,
        encoding: 'utf8',
      });

      expect(output).toContain('Current time:');
      // Check for natural language format (day of week, month, date, year)
      expect(output).toMatch(/\w+, \w+ \d{1,2}, \d{4}/);
      // Check for ISO format (with milliseconds)
      expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
      // Check for local time
      expect(output).toMatch(/Local: \d{2}:\d{2}/);
    });
  });

  describe('prompt-questions.ts', () => {
    it('outputs question guidance for prompts', () => {
      const output = execSync(
        'echo "Help me implement a new feature for user authentication" | bun .safeword/hooks/prompt-questions.ts',
        {
          cwd: projectDirectory,
          env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
          encoding: 'utf8',
        },
      );

      expect(output).toContain('Contribute before asking');
    });

    it('exits silently for non-safeword project', () => {
      const nonSafewordDirectory = createTemporaryDirectory();
      try {
        const output = execSync(
          'echo "Help me implement a new feature for user authentication" | bun .safeword/hooks/prompt-questions.ts',
          {
            cwd: projectDirectory,
            env: { ...process.env, CLAUDE_PROJECT_DIR: nonSafewordDirectory },
            encoding: 'utf8',
          },
        );

        expect(output.trim()).toBe('');
      } finally {
        removeTemporaryDirectory(nonSafewordDirectory);
      }
    });
  });
});

describe('E2E: Phase-Aware Quality Review', () => {
  // Ticket frontmatter template
  function createTicketContent(options: {
    id: string;
    type?: string;
    phase?: string;
    status?: string;
    lastModified: string;
  }): string {
    const lines = ['---', `id: ${options.id}`];
    if (options.type) lines.push(`type: ${options.type}`);
    if (options.phase) lines.push(`phase: ${options.phase}`);
    if (options.status) lines.push(`status: ${options.status}`);
    lines.push(`last_modified: ${options.lastModified}`, '---', '', `# Ticket ${options.id}`, '');
    return lines.join('\n');
  }

  // Helper to create tickets directory with tickets
  function setupIssuesDirectory(
    targetDirectory: string,
    tickets: Parameters<typeof createTicketContent>[0][],
  ): void {
    const ticketsDirectory = `${targetDirectory}/.safeword-project/tickets`;
    execSync(`mkdir -p "${ticketsDirectory}"`, { cwd: targetDirectory });
    // Clear existing tickets
    execSync(`rm -rf "${ticketsDirectory}"/*`, { cwd: targetDirectory });
    for (const ticket of tickets) {
      // Create folder structure: .safeword-project/tickets/{id}/ticket.md
      const folderPath = `.safeword-project/tickets/${ticket.id}`;
      execSync(`mkdir -p "${targetDirectory}/${folderPath}"`, {
        cwd: targetDirectory,
      });
      writeTestFile(targetDirectory, `${folderPath}/ticket.md`, createTicketContent(ticket));
    }
  }

  // Helper to clear tickets directory
  function clearIssuesDirectory(targetDirectory: string): void {
    execSync(`rm -rf "${targetDirectory}/.safeword-project/tickets"/*`, {
      cwd: targetDirectory,
    });
  }

  // Helper to create transcript with changes
  function createChangesTranscript(targetDirectory: string, customText = 'Made changes.'): string {
    const transcriptPath = `${targetDirectory}/.safeword/test-transcript.jsonl`;
    const message = {
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', name: 'Edit' },
          { type: 'text', text: customText },
        ],
      },
    };
    writeTestFile(targetDirectory, '.safeword/test-transcript.jsonl', JSON.stringify(message));
    return transcriptPath;
  }

  // Helper to run stop hook and extract quality message
  // Returns { reason, exitCode, stderr }; hook always exits 0 with JSON stdout
  function runStopHookForPhase(
    targetDirectory: string,
    customText?: string,
  ): {
    reason: string;
    exitCode: number;
    stderr: string;
  } {
    const transcriptPath = createChangesTranscript(targetDirectory, customText);
    const result = spawnSync('bun', ['.safeword/hooks/stop-quality.ts'], {
      input: JSON.stringify({
        transcript_path: transcriptPath,
        last_assistant_message: customText ?? '',
      }),
      cwd: targetDirectory,
      env: { ...process.env, CLAUDE_PROJECT_DIR: targetDirectory },
      encoding: 'utf8',
    });
    const exitCode = result.status ?? 0;
    const stderr = result.stderr?.trim() ?? '';

    // Exit 0 = soft/hard block or allow; parse JSON from stdout
    try {
      const parsed = JSON.parse(result.stdout.trim());
      return { reason: parsed.reason ?? '', exitCode, stderr };
    } catch {
      return { reason: '', exitCode, stderr };
    }
  }

  describe('Happy Path - Phase Detection', () => {
    it('Scenario 1: Shows intake prompts during discovery phase', () => {
      setupIssuesDirectory(projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'intake',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);

      const result = runStopHookForPhase(projectDirectory);

      expect(result.reason).toContain('Understanding Phase');
      expect(result.reason).toContain('edge cases');
    });

    it('Scenario 2: Shows scenario prompts during define-behavior phase', () => {
      setupIssuesDirectory(projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'define-behavior',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);

      const result = runStopHookForPhase(projectDirectory);

      expect(result.reason).toContain('Scenario Phase');
      expect(result.reason).toContain('Atomic');
      expect(result.reason).toContain('Observable');
    });

    it('Scenario 3: Shows implementation prompts during implement phase', () => {
      setupIssuesDirectory(projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'implement',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      // Create test-definitions.md (required artifact for features at implement phase)
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/001/test-definitions.md',
        '# Test Definitions\n\n## Rule: Test rule\n\n- [x] Scenario one\n',
      );

      const result = runStopHookForPhase(projectDirectory);

      expect(result.reason).toContain('Is it correct?');
      expect(result.reason).toContain('latest docs');
    });

    it('Scenario 4: Hard blocks done phase without evidence', () => {
      setupIssuesDirectory(projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'done',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      // Create test-definitions.md (required artifact for done phase — scenario NOT complete)
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/001/test-definitions.md',
        '# Test Definitions\n\n## Rule: Test rule\n\n- [ ] Scenario one\n',
      );

      const result = runStopHookForPhase(projectDirectory);

      // Done phase uses hard block (exit 0, JSON output)
      expect(result.exitCode).toBe(0);
      expect(result.reason).toContain('scenarios');
    });

    it('Scenario 4b: Allows done phase with evidence present', () => {
      setupIssuesDirectory(projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'done',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      // Create test-definitions.md with all scenarios complete
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/001/test-definitions.md',
        '# Test Definitions\n\n## Rule: Test rule\n\n- [x] Scenario one\n',
      );

      // Transcript contains audit evidence (tests run by hook, scenarios checked by file)
      const evidenceText = 'Audit passed';
      const result = runStopHookForPhase(projectDirectory, evidenceText);

      // Evidence found - should allow stop (exit 0, no block)
      expect(result.exitCode).toBe(0);
      expect(result.reason).toBe(''); // No block reason when allowed
    });
  });

  describe('Edge Cases - Fallbacks', () => {
    it('Scenario 5: Falls back to implement when no phase field', () => {
      setupIssuesDirectory(projectDirectory, [
        {
          id: '001',
          type: 'feature',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);

      const result = runStopHookForPhase(projectDirectory);

      // Default implementation review
      expect(result.reason).toContain('Is it correct?');
    });

    it('Scenario 6: Falls back to implement for unknown phase', () => {
      setupIssuesDirectory(projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'invalid-phase',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);

      const result = runStopHookForPhase(projectDirectory);

      // Default implementation review
      expect(result.reason).toContain('Is it correct?');
    });
  });

  describe('Edge Cases - Ticket Filtering', () => {
    it('Scenario 7: Ignores backlog tickets (status filtering)', () => {
      setupIssuesDirectory(projectDirectory, [
        // Older but in_progress - should be used
        {
          id: '001',
          type: 'feature',
          phase: 'intake',
          status: 'in_progress',
          lastModified: '2026-01-06T09:00:00Z',
        },
        // Newer but backlog - should be ignored
        {
          id: '002',
          type: 'feature',
          phase: 'implement',
          status: 'backlog',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);

      const result = runStopHookForPhase(projectDirectory);

      // Should use intake from ticket 001, not implement from ticket 002
      expect(result.reason).toContain('Understanding Phase');
    });

    it('Scenario 8: Ignores epic tickets (type filtering)', () => {
      setupIssuesDirectory(projectDirectory, [
        // Epic with newest timestamp - should be ignored
        {
          id: '001',
          type: 'epic',
          phase: 'implement',
          status: 'in_progress',
          lastModified: '2026-01-06T11:00:00Z',
        },
        // Feature - should be used
        {
          id: '002',
          type: 'feature',
          phase: 'intake',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);

      const result = runStopHookForPhase(projectDirectory);

      // Should use intake from feature, not implement from epic
      expect(result.reason).toContain('Understanding Phase');
    });

    it('Scenario 9: Falls back when no in_progress tickets', () => {
      setupIssuesDirectory(projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'intake',
          status: 'done',
          lastModified: '2026-01-06T10:00:00Z',
        },
        {
          id: '002',
          type: 'feature',
          phase: 'define-behavior',
          status: 'backlog',
          lastModified: '2026-01-06T09:00:00Z',
        },
      ]);

      const result = runStopHookForPhase(projectDirectory);

      // Default implementation review (fallback)
      expect(result.reason).toContain('Is it correct?');
    });

    it('Scenario 10: Falls back when issues directory empty', () => {
      clearIssuesDirectory(projectDirectory);

      const result = runStopHookForPhase(projectDirectory);

      // Default implementation review (fallback)
      expect(result.reason).toContain('Is it correct?');
    });
  });

  describe('Cumulative Artifact Checks', () => {
    it('Scenario 11: Soft blocks feature at scenario-gate without test-definitions.md', () => {
      setupIssuesDirectory(projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'scenario-gate',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      // No test-definitions.md file exists

      const result = runStopHookForPhase(projectDirectory);

      // Should soft block with artifact requirement message
      expect(result.exitCode).toBe(0); // Soft block uses exit 0
      expect(result.reason).toContain('test-definitions.md');
    });

    it('Scenario 12: Allows feature at scenario-gate with test-definitions.md', () => {
      setupIssuesDirectory(projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'scenario-gate',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      // Create test-definitions.md
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/001/test-definitions.md',
        '# Test Definitions\n\n## Rule: Test rule\n\n- [ ] Scenario one\n',
      );

      const result = runStopHookForPhase(projectDirectory);

      // Should show normal phase review, not artifact block
      expect(result.reason).toContain('Scenario Gate');
      expect(result.reason).not.toContain('test-definitions.md');
    });

    it('Scenario 13: Tasks skip artifact checks (no test-definitions required)', () => {
      setupIssuesDirectory(projectDirectory, [
        {
          id: '001',
          type: 'task',
          phase: 'implement',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      // No test-definitions.md - should be fine for tasks

      const result = runStopHookForPhase(projectDirectory);

      // Should show normal implementation review, not artifact block
      expect(result.reason).toContain('Is it correct?');
      expect(result.reason).not.toContain('test-definitions.md');
    });
  });

  describe('Type-Aware Done Gate', () => {
    it('Scenario 14: Feature done requires all scenarios complete', () => {
      setupIssuesDirectory(projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'done',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      // Create test-definitions.md with incomplete scenario
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/001/test-definitions.md',
        '# Test Definitions\n\n## Rule: Test rule\n\n- [ ] Scenario one\n',
      );

      const result = runStopHookForPhase(projectDirectory);

      // Feature should require all scenarios complete (checked by file reading)
      expect(result.exitCode).toBe(0);
      expect(result.reason).toContain('scenarios');
    });

    it('Scenario 15: Task done does not require scenario evidence', () => {
      setupIssuesDirectory(projectDirectory, [
        {
          id: '001',
          type: 'task',
          phase: 'done',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);

      // Only test evidence, no scenario evidence
      const evidenceText = '## Done Checklist\n\n**Test Suite:** ✓ 42/42 tests pass';
      const result = runStopHookForPhase(projectDirectory, evidenceText);

      // Task should allow with just test evidence
      expect(result.exitCode).toBe(0);
      expect(result.reason).toBe('');
    });

    it('Scenario 16: Feature done with test, scenario, and audit evidence passes', () => {
      setupIssuesDirectory(projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'done',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      // Create test-definitions.md (required artifact for done phase)
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/001/test-definitions.md',
        '# Test Definitions\n\n## Rule: Test rule\n\n- [x] Scenario one\n',
      );

      // Test + scenario + audit evidence
      const evidenceText =
        '## Verify Checklist\n\n**Test Suite:** ✓ 42/42 tests pass\n**Scenarios:** All 5 scenarios marked complete\n\nAudit passed with warnings';
      const result = runStopHookForPhase(projectDirectory, evidenceText);

      // Should allow
      expect(result.exitCode).toBe(0);
      expect(result.reason).toBe('');
    });

    it('T7: Feature done hard blocks without audit evidence', () => {
      setupIssuesDirectory(projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'done',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/001/test-definitions.md',
        '# Test Definitions\n\n## Rule: Test rule\n\n- [x] Scenario one\n',
      );

      // Has test + scenario evidence but NO audit evidence
      const evidenceText =
        '## Verify Checklist\n\n**Test Suite:** ✓ 42/42 tests pass\n**Scenarios:** All 5 scenarios marked complete';
      const result = runStopHookForPhase(projectDirectory, evidenceText);

      // Should hard block requiring /audit
      expect(result.exitCode).toBe(0);
      expect(result.reason).toContain('audit');
    });

    it('T8: Feature done passes with verify + audit evidence', () => {
      setupIssuesDirectory(projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'done',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/001/test-definitions.md',
        '# Test Definitions\n\n## Rule: Test rule\n\n- [x] Scenario one\n',
      );

      // Has test + scenario + audit evidence
      const evidenceText =
        '## Verify Checklist\n\n**Test Suite:** ✓ 42/42 tests pass\n**Scenarios:** All 5 scenarios marked complete\n\nAudit passed with warnings';
      const result = runStopHookForPhase(projectDirectory, evidenceText);

      // Should allow
      expect(result.exitCode).toBe(0);
      expect(result.reason).toBe('');
    });
  });

  // Cleanup after all phase tests
  afterAll(() => {
    clearIssuesDirectory(projectDirectory);
  });
});

describe('E2E: Stop Hook', () => {
  // Helper to create a mock transcript with an assistant message
  function createMockTranscript(targetDirectory: string, assistantText: string): string {
    const transcriptPath = `${targetDirectory}/.safeword/test-transcript.jsonl`;
    // Use 'type' at top level to match actual Claude Code transcript format
    const message = {
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: assistantText }],
      },
    };
    writeTestFile(targetDirectory, '.safeword/test-transcript.jsonl', JSON.stringify(message));
    return transcriptPath;
  }

  // Helper to create a multi-message transcript (JSONL format)
  function createMultiMessageTranscript(
    targetDirectory: string,
    messages: { text?: string; toolUse?: string }[],
  ): string {
    const transcriptPath = `${targetDirectory}/.safeword/test-transcript.jsonl`;
    const lines = messages.map(message => {
      const content: { type: string; text?: string; name?: string }[] = [];
      if (message.text) {
        content.push({ type: 'text', text: message.text });
      }
      if (message.toolUse) {
        content.push({ type: 'tool_use', name: message.toolUse });
      }
      return JSON.stringify({
        type: 'assistant',
        message: { content },
      });
    });
    writeTestFile(targetDirectory, '.safeword/test-transcript.jsonl', lines.join('\n'));
    return transcriptPath;
  }

  // Helper to run stop hook with mock transcript
  function runStopHook(
    targetDirectory: string,
    transcriptPath: string,
  ): { stdout: string; stderr: string; exitCode: number } {
    const result = spawnSync('bun', ['.safeword/hooks/stop-quality.ts'], {
      input: JSON.stringify({ transcript_path: transcriptPath }),
      cwd: targetDirectory,
      env: { ...process.env, CLAUDE_PROJECT_DIR: targetDirectory },
      encoding: 'utf8',
    });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.status || 0,
    };
  }

  // Helper to parse JSON output from stop hook (new format: exit 0 + JSON stdout)
  function parseStopOutput(result: { stdout: string; stderr: string; exitCode: number }): {
    decision?: string;
    reason?: string;
  } {
    try {
      return JSON.parse(result.stdout.trim());
    } catch {
      return {};
    }
  }

  describe('stop-quality.ts', () => {
    it('triggers quality review when edit tools are used', () => {
      const transcriptPath = createMultiMessageTranscript(projectDirectory, [
        { text: 'Let me edit that file.', toolUse: 'Edit' },
      ]);

      const result = runStopHook(projectDirectory, transcriptPath);
      const output = parseStopOutput(result);

      expect(result.exitCode).toBe(0);
      expect(output.decision).toBe('block');
      expect(output.reason).toContain('Quality Review');
      expect(output.reason).toContain('Is it correct?');
    });

    it('exits silently when no edit tools are used', () => {
      const text = 'I answered a question without making any changes.';
      const transcriptPath = createMockTranscript(projectDirectory, text);

      const result = runStopHook(projectDirectory, transcriptPath);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('');
    });

    it('exits silently for non-safeword project', () => {
      const nonSafewordDirectory = createTemporaryDirectory();
      try {
        const result = spawnSync('bun', ['.safeword/hooks/stop-quality.ts'], {
          input: JSON.stringify({ transcript_path: '/tmp/fake.jsonl' }),
          cwd: projectDirectory,
          env: { ...process.env, CLAUDE_PROJECT_DIR: nonSafewordDirectory },
          encoding: 'utf8',
        });

        expect(result.stdout.trim()).toBe('');
      } finally {
        removeTemporaryDirectory(nonSafewordDirectory);
      }
    });

    it('detects edit tools from older messages within scan window', () => {
      // Edit tool in first message, text-only in second
      const transcriptPath = createMultiMessageTranscript(projectDirectory, [
        { text: 'Let me edit that file.', toolUse: 'Edit' },
        { text: 'Done with the changes.' },
      ]);

      const result = runStopHook(projectDirectory, transcriptPath);
      const output = parseStopOutput(result);

      expect(result.exitCode).toBe(0);
      expect(output.decision).toBe('block');
      expect(output.reason).toContain('Quality Review');
    });

    it('exits with error when usage limit reached in last message', () => {
      const text = '5-hour limit reached - resets in 2 hours';
      const transcriptPath = createMockTranscript(projectDirectory, text);

      const result = runStopHook(projectDirectory, transcriptPath);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('usage limit reached');
    });

    it('does not false-positive on discussion of rate limits in normal response', () => {
      // Long response discussing rate limits — no edit tools, so no review
      const text =
        'Here is how to implement rate limiting in your API:\n\n' +
        '```typescript\n' +
        'const USAGE_LIMIT_REACHED = "You have exceeded your quota";\n' +
        'if (requests > maxRequests) {\n' +
        '  throw new Error("5-hour limit reached");\n' +
        '}\n' +
        '```';
      const transcriptPath = createMockTranscript(projectDirectory, text);

      const result = runStopHook(projectDirectory, transcriptPath);

      // No edit tools → silent exit, no usage limit error (text is long)
      expect(result.exitCode).toBe(0);
      expect(result.stderr).not.toContain('usage limit reached');
    });
  });
});

/**
 * Test Suite 2: Python-Aware Lint Hook
 * Tests for Story 2 - running Ruff on Python files in the post-tool lint hook.
 */
describe('E2E: Python Lint Hook', () => {
  /** Helper to run lint hook and return result */
  function runLintHook(filePath: string) {
    return spawnSync('bun', ['.safeword/hooks/lib/lint.ts', filePath], {
      cwd: projectDirectory,
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
      encoding: 'utf8',
    });
  }

  describe('Test 2.1: Routes .py files to Ruff', () => {
    it('should handle Python files without error', () => {
      writeTestFile(projectDirectory, 'test.py', 'x = 1\n');
      const result = runLintHook(`${projectDirectory}/test.py`);
      expect(result.status).toBe(0);
    });

    it('should handle .pyi stub files', () => {
      writeTestFile(projectDirectory, 'test.pyi', 'def foo() -> int: ...\n');
      const result = runLintHook(`${projectDirectory}/test.pyi`);
      expect(result.status).toBe(0);
    });
  });

  describe('Test 2.2: Continues running ESLint for JS/TS files', () => {
    it('should run ESLint for TypeScript files', () => {
      writeTestFile(projectDirectory, 'test.ts', 'const x = 1\n');
      const result = runLintHook(`${projectDirectory}/test.ts`);
      // ESLint runs and exits successfully
      expect(result.status).toBe(0);
    });
  });

  describe('Test 2.3: Skips Ruff gracefully if not installed', () => {
    it('should not error when Ruff is missing from PATH', () => {
      writeTestFile(projectDirectory, 'test.py', 'print("hello")\n');

      // Find actual bun path (process.execPath gives node when running via vitest)
      const bunPath = execSync('which bun', { encoding: 'utf8' }).trim();
      const bunDirectory = nodePath.dirname(bunPath);

      // Run with PATH that has bun but likely not ruff
      const result = spawnSync(
        'bash',
        [
          '-c',
          `PATH=/bin:/usr/bin:${bunDirectory} bun .safeword/hooks/lib/lint.ts "${projectDirectory}/test.py"`,
        ],
        {
          cwd: projectDirectory,
          env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
          encoding: 'utf8',
        },
      );

      // Should exit 0 (graceful skip via .nothrow())
      expect(result.status).toBe(0);
    });
  });

  describe('Test 2.4: Ruff fixes Python files via lint hook', () => {
    /** Helper to run post-tool-lint hook via JSON input (actually executes the lint) */
    function runPostToolLint(cwd: string, filePath: string) {
      const hookInput = JSON.stringify({
        session_id: 'test-session',
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        tool_input: { file_path: filePath },
      });

      return spawnSync(
        'bash',
        ['-c', `echo '${hookInput}' | bun .safeword/hooks/post-tool-lint.ts`],
        {
          cwd,
          env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
          encoding: 'utf8',
        },
      );
    }

    it.skipIf(!RUFF_AVAILABLE)('should format Python files when run through lint hook', () => {
      // Create badly formatted Python file
      const badCode = 'x=1;y=2';
      writeTestFile(projectDirectory, 'format-test.py', badCode);

      // Run lint hook on the file
      const result = runPostToolLint(projectDirectory, `${projectDirectory}/format-test.py`);
      expect(result.status).toBe(0);

      // File should now be formatted
      const formatted = readTestFile(projectDirectory, 'format-test.py');
      expect(formatted).toContain('x = 1');
      expect(formatted).toContain('y = 2');
    });

    it.skipIf(!RUFF_AVAILABLE)('should fix auto-fixable lint issues', () => {
      // Create file with unused import (auto-fixable with --fix)
      const codeWithUnusedImport = 'import os\nx = 1\n';
      writeTestFile(projectDirectory, 'fix-test.py', codeWithUnusedImport);

      // Run lint hook on the file
      const result = runPostToolLint(projectDirectory, `${projectDirectory}/fix-test.py`);
      expect(result.status).toBe(0);

      // Unused import should be removed
      const fixed = readTestFile(projectDirectory, 'fix-test.py');
      expect(fixed).not.toContain('import os');
      expect(fixed).toContain('x = 1');
    });

    it.skipIf(!RUFF_AVAILABLE)(
      'should output additionalContext JSON when unfixable errors remain',
      () => {
        // F841 (unused variable after return) is not auto-fixable without --unsafe-fixes
        const codeWithUnfixable = 'def foo():\n    return\n    x = 1\n';
        writeTestFile(projectDirectory, 'unfixable-test.py', codeWithUnfixable);

        const result = runPostToolLint(projectDirectory, `${projectDirectory}/unfixable-test.py`);
        expect(result.status).toBe(0);

        // Hook should output additionalContext JSON for remaining errors
        const stdout = result.stdout.trim();
        expect(stdout).toMatch(/.+/);
        const output = JSON.parse(stdout);
        expect(output.hookSpecificOutput).toBeDefined();
        expect(output.hookSpecificOutput.hookEventName).toBe('PostToolUse');
        expect(output.hookSpecificOutput.additionalContext).toContain('unfixable-test.py');
      },
    );

    it.skipIf(!RUFF_AVAILABLE)('should output no JSON when all errors are auto-fixed', () => {
      // Unused import is fully auto-fixable — no remaining errors
      const autoFixable = 'import os\nx = 1\n';
      writeTestFile(projectDirectory, 'clean-after-fix.py', autoFixable);

      const result = runPostToolLint(projectDirectory, `${projectDirectory}/clean-after-fix.py`);
      expect(result.status).toBe(0);

      // No additionalContext should be output (file is clean after fix)
      const stdout = result.stdout.trim();
      // stdout should be empty or not contain hookSpecificOutput
      if (stdout) {
        expect(stdout).not.toContain('additionalContext');
      }
    });
  });
});
