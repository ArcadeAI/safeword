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
import { chmodSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  acquireAutoUpgradeLock,
  AUTO_UPGRADE_LOCK_MESSAGE,
  releaseAutoUpgradeLock,
} from '../../templates/hooks/lib/auto-upgrade-lock.js';
import { REPLY_FORMAT_REMINDER } from '../../templates/hooks/lib/quality.js';
import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  initGitRepo,
  INSTALL_DEPENDENCIES_ENV,
  isRuffInstalled,
  readTestFile,
  removeTemporaryDirectory,
  setupOrThrow,
  TIMEOUT_SETUP_HOOK,
  writeTestFile,
} from '../helpers';

const IS_RUFF_AVAILABLE = isRuffInstalled();
const VERIFIED_AT = '2026-04-15T18:00:00Z';
const PR_SCOPE_OK_LINE = '**PR Scope:** ✅ Diff matches ticket scope';
const TEMPLATE_CODEX_SESSION_START = nodePath.resolve(
  import.meta.dirname,
  '../../templates/hooks/session-codex-start.ts',
);

// Single setup for all hook tests - sharing avoids 3 separate bun installs
// Tests must be idempotent or restore state after modification (see try/finally blocks)
const shared: { projectDirectory: string } = { projectDirectory: '' };

beforeAll(async () => {
  shared.projectDirectory = createTemporaryDirectory();
  createTypeScriptPackageJson(shared.projectDirectory);
  initGitRepo(shared.projectDirectory);
  await setupOrThrow(shared.projectDirectory, ['setup', '--yes', '--agents', 'cursor'], {
    env: INSTALL_DEPENDENCIES_ENV,
  });
});

afterAll(() => {
  if (shared.projectDirectory) {
    removeTemporaryDirectory(shared.projectDirectory);
  }
});

// ---------------------------------------------------------------------------
// Test helpers (moved to module scope for unicorn/consistent-function-scoping)
// ---------------------------------------------------------------------------

/** Build ticket.md frontmatter from options */
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

/** Create valid verify.md content for done-gate tests */
function createVerifyContent({
  testSuite = '**Test Suite:** ✓ 42/42 tests pass',
  extraLines = [],
}: {
  testSuite?: string;
  extraLines?: string[];
} = {}): string {
  return [`Verified: ${VERIFIED_AT}`, '', testSuite, PR_SCOPE_OK_LINE, ...extraLines, ''].join(
    '\n',
  );
}

/** Clear tickets directory */
function clearIssuesDirectory(targetDirectory: string): void {
  execSync(`rm -rf "${targetDirectory}/.project/tickets"/*`, {
    cwd: targetDirectory,
  });
}

/** Create transcript with an Edit tool_use and custom text */
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

/** Create a mock transcript with a single assistant text message */
function createMockTranscript(targetDirectory: string, assistantText: string): string {
  const transcriptPath = `${targetDirectory}/.safeword/test-transcript.jsonl`;
  const message = {
    type: 'assistant',
    message: {
      content: [{ type: 'text', text: assistantText }],
    },
  };
  writeTestFile(targetDirectory, '.safeword/test-transcript.jsonl', JSON.stringify(message));
  return transcriptPath;
}

/** Create a multi-message transcript (JSONL format) */
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

/** Run stop hook with mock transcript */
function runStopHook(
  targetDirectory: string,
  transcriptPath: string,
  overrides: { session_id?: string; last_assistant_message?: string } = {},
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync('bun', ['.safeword/hooks/stop-quality.ts'], {
    input: JSON.stringify({ transcript_path: transcriptPath, ...overrides }),
    cwd: targetDirectory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: targetDirectory },
    encoding: 'utf8',
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 0,
  };
}

/** Run the installed UserPromptSubmit question hook. */
function runPromptQuestionsHook(
  targetDirectory: string,
  input: string,
  claudeProjectDirectory = targetDirectory,
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync('bun', ['.safeword/hooks/prompt-questions.ts'], {
    input,
    cwd: targetDirectory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: claudeProjectDirectory },
    encoding: 'utf8',
  });
  if (result.error) {
    throw result.error;
  }
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

/** Parse JSON output from stop hook */
function parseStopOutput(result: { stdout: string }): {
  decision?: string;
  reason?: string;
} {
  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    return {};
  }
}

/** Run lint hook on a file */
function runLintHook(targetDirectory: string, filePath: string) {
  return spawnSync('bun', ['.safeword/hooks/lib/lint.ts', filePath], {
    cwd: targetDirectory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: targetDirectory },
    encoding: 'utf8',
  });
}

/** Create tickets directory with ticket fixtures */
function setupIssuesDirectory(
  targetDirectory: string,
  tickets: Parameters<typeof createTicketContent>[0][],
): void {
  const ticketsDirectory = `${targetDirectory}/.project/tickets`;
  execSync(`mkdir -p "${ticketsDirectory}"`, { cwd: targetDirectory });
  // Clear existing tickets
  execSync(`rm -rf "${ticketsDirectory}"/*`, { cwd: targetDirectory });
  for (const ticket of tickets) {
    // Create folder structure: .project/tickets/{id}/ticket.md
    const folderPath = `.project/tickets/${ticket.id}`;
    execSync(`mkdir -p "${targetDirectory}/${folderPath}"`, {
      cwd: targetDirectory,
    });
    writeTestFile(targetDirectory, `${folderPath}/ticket.md`, createTicketContent(ticket));
  }
}

/** Run stop hook and extract quality message */
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

/** Run post-tool-lint hook via JSON input */
function runPostToolLint(cwd: string, filePath: string) {
  const hookInput = JSON.stringify({
    session_id: 'test-session',
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: filePath },
  });

  return spawnSync('bash', ['-c', `echo '${hookInput}' | bun .safeword/hooks/post-tool-lint.ts`], {
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E2E: SessionStart Hooks', () => {
  describe('session-bun-check.sh', () => {
    it('exits silently when bun is available', () => {
      const result = spawnSync('bash', ['.safeword/hooks/session-bun-check.sh'], {
        cwd: shared.projectDirectory,
        env: { ...process.env, CLAUDE_PROJECT_DIR: shared.projectDirectory },
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
          [nodePath.join(shared.projectDirectory, '.safeword/hooks/session-bun-check.sh')],
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
        cwd: shared.projectDirectory,
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: shared.projectDirectory,
          // Override PATH to exclude bun
          PATH: '/usr/bin:/bin',
        },
        encoding: 'utf8',
      });

      expect(result.status).toBe(2);
      // UJSZXB: plain-language, safety-framed wording for the NTB (no "PATH" /
      // "quality hooks" jargon) — still names bun. Which remedy it recommends
      // depends on the host's toolchain; those cases are covered below.
      expect(result.stderr).toContain('bun');
      expect(result.stderr).toContain('safety checks');
    });

    describe('when the host manages its toolchain with mise', () => {
      // Hooks run non-interactively, so a customer whose shell rc does
      // `mise activate` reaches this hook with no shims on PATH even though
      // `bun` works in their terminal. Recommending a curl install there would
      // plant a second, unmanaged bun that shadows their pinned one.
      const runWithoutBun = (home: string, extraEnvironment: Record<string, string> = {}) =>
        spawnSync('bash', ['.safeword/hooks/session-bun-check.sh'], {
          cwd: shared.projectDirectory,
          env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: shared.projectDirectory,
            HOME: home,
            PATH: '/usr/bin:/bin',
            MISE_DATA_DIR: '',
            XDG_DATA_HOME: '',
            ...extraEnvironment,
          },
          encoding: 'utf8',
        });

      it('points at the existing mise-managed bun instead of a competing install', () => {
        const home = createTemporaryDirectory();
        try {
          const shims = nodePath.join(home, '.local/share/mise/shims');
          mkdirSync(shims, { recursive: true });
          writeTestFile(shims, 'bun', '#!/bin/sh\nexit 0\n');
          chmodSync(nodePath.join(shims, 'bun'), 0o755);

          const result = runWithoutBun(home);

          expect(result.status).toBe(2);
          expect(result.stderr).toContain('mise');
          expect(result.stderr).toContain(shims);
          expect(result.stderr).not.toContain('bun.sh/install');
        } finally {
          removeTemporaryDirectory(home);
        }
      });

      it('recommends installing bun through mise when mise governs the project', () => {
        const home = createTemporaryDirectory();
        const miseConfig = nodePath.join(shared.projectDirectory, 'mise.toml');
        try {
          writeTestFile(shared.projectDirectory, 'mise.toml', '[tools]\nnode = "24"\n');

          const result = runWithoutBun(home);

          expect(result.status).toBe(2);
          expect(result.stderr).toContain('mise use -g bun@latest');
          expect(result.stderr).not.toContain('bun.sh/install');
          // Installing through mise drops bun into the shims directory, so
          // install guidance alone leaves the next session just as blind.
          expect(result.stderr).toContain(nodePath.join(home, '.local/share/mise/shims'));
        } finally {
          rmSync(miseConfig, { force: true });
          removeTemporaryDirectory(home);
        }
      });

      // Login shells read different files, so a bash host told to edit
      // ~/.zprofile restarts into the same broken session. Run the emitted
      // command rather than matching its text: advice that doesn't survive
      // being pasted — into a home directory containing a space, say — leaves
      // the host exactly as unguarded as before.
      it.each([
        ['/bin/zsh', '.zprofile'],
        ['/bin/bash', '.bash_profile'],
      ])('emits a login-PATH command %s can actually run', (shell, profile) => {
        const enclosing = createTemporaryDirectory();
        const home = nodePath.join(enclosing, 'home dir');
        try {
          const shims = nodePath.join(home, '.local/share/mise/shims');
          mkdirSync(shims, { recursive: true });
          writeTestFile(shims, 'bun', '#!/bin/sh\nexit 0\n');
          chmodSync(nodePath.join(shims, 'bun'), 0o755);

          const result = runWithoutBun(home, { SHELL: shell });
          const command = result.stderr
            .split('\n')
            .map(line => line.trim())
            .find(line => line.startsWith('echo '));
          expect(command).toContain(shims);

          const applied = spawnSync('bash', ['-c', command ?? ''], {
            env: { ...process.env, HOME: home },
            encoding: 'utf8',
          });
          expect(applied.status).toBe(0);

          // The point isn't the file's contents — it's that loading the profile
          // actually puts bun back within reach.
          const resolved = spawnSync('bash', ['-c', `. "$HOME/${profile}"; command -v bun`], {
            env: { ...process.env, HOME: home },
            encoding: 'utf8',
          });

          expect(resolved.stdout.trim()).toBe(nodePath.join(shims, 'bun'));
        } finally {
          removeTemporaryDirectory(enclosing);
        }
      });

      // A path holding a quote or a `$` cannot be embedded in a pasteable
      // command safely, so describe the step instead of emitting one that
      // breaks on paste or mis-expands when the profile loads.
      it('describes the step instead of emitting an unpasteable command', () => {
        const enclosing = createTemporaryDirectory();
        const home = nodePath.join(enclosing, "O'Neil");
        try {
          const shims = nodePath.join(home, '.local/share/mise/shims');
          mkdirSync(shims, { recursive: true });
          writeTestFile(shims, 'bun', '#!/bin/sh\nexit 0\n');
          chmodSync(nodePath.join(shims, 'bun'), 0o755);

          const result = runWithoutBun(home, { SHELL: '/bin/zsh' });

          expect(result.stderr).toContain(shims);
          expect(result.stderr).not.toContain('.zprofile');
        } finally {
          removeTemporaryDirectory(enclosing);
        }
      });

      it('falls back to the standalone installer when nothing indicates mise', () => {
        const home = createTemporaryDirectory();
        try {
          const result = runWithoutBun(home);

          expect(result.status).toBe(2);
          expect(result.stderr).toContain('bun.sh/install');
          expect(result.stderr).not.toContain('mise');
        } finally {
          removeTemporaryDirectory(home);
        }
      });
    });
  });

  describe('session-version.ts', () => {
    it('outputs version message for safeword project', () => {
      const output = execSync('bun .safeword/hooks/session-version.ts', {
        cwd: shared.projectDirectory,
        env: { ...process.env, CLAUDE_PROJECT_DIR: shared.projectDirectory },
        encoding: 'utf8',
      });

      expect(output).toContain('Safeword');
      expect(output).toContain('installed');
      expect(output).toMatch(/v\d+\.\d+\.\d+/); // Version format
    });

    it('exits silently for non-safeword project', () => {
      const nonSafewordDirectory = createTemporaryDirectory();
      try {
        // Run in a directory without .safeword
        const output = execSync('bun .safeword/hooks/session-version.ts', {
          cwd: shared.projectDirectory, // Script is here
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

  describe('session-lint-check.ts', () => {
    it('outputs no warnings when lint configs exist', () => {
      // Project should have eslint and prettier after setup
      expect(fileExists(shared.projectDirectory, 'eslint.config.mjs')).toBe(true);
      expect(fileExists(shared.projectDirectory, '.prettierrc')).toBe(true);

      const output = execSync('bun .safeword/hooks/session-lint-check.ts', {
        cwd: shared.projectDirectory,
        env: { ...process.env, CLAUDE_PROJECT_DIR: shared.projectDirectory },
        encoding: 'utf8',
      });

      // Should not contain warnings
      expect(output).not.toContain('⚠️');
    });

    it('warns when ESLint config is missing', () => {
      // Temporarily remove ESLint config
      execSync('mv eslint.config.mjs eslint.config.mjs.bak', {
        cwd: shared.projectDirectory,
      });

      try {
        const output = execSync('bun .safeword/hooks/session-lint-check.ts', {
          cwd: shared.projectDirectory,
          env: { ...process.env, CLAUDE_PROJECT_DIR: shared.projectDirectory },
          encoding: 'utf8',
        });

        expect(output).toContain('ESLint config not found');
      } finally {
        // Restore ESLint config
        execSync('mv eslint.config.mjs.bak eslint.config.mjs', {
          cwd: shared.projectDirectory,
        });
      }
    });

    it('warns when Prettier config is missing', () => {
      // Temporarily remove Prettier config
      execSync('mv .prettierrc .prettierrc.bak', { cwd: shared.projectDirectory });

      try {
        const output = execSync('bun .safeword/hooks/session-lint-check.ts', {
          cwd: shared.projectDirectory,
          env: { ...process.env, CLAUDE_PROJECT_DIR: shared.projectDirectory },
          encoding: 'utf8',
        });

        expect(output).toContain('Prettier config not found');
      } finally {
        // Restore Prettier config
        execSync('mv .prettierrc.bak .prettierrc', { cwd: shared.projectDirectory });
      }
    });

    it('exits silently for non-safeword project', () => {
      const nonSafewordDirectory = createTemporaryDirectory();
      try {
        const output = execSync('bun .safeword/hooks/session-lint-check.ts', {
          cwd: shared.projectDirectory,
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
        cwd: shared.projectDirectory,
        encoding: 'utf8',
      });

      expect(output).toContain('Current time:');
      // Check for natural language date (e.g., "Wednesday, April 15, 2026")
      expect(output).toMatch(/day, \w+ \d{1,2}, \d{4}/);
      // Check for ISO format (with milliseconds)
      expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
      // Check for local time
      expect(output).toMatch(/Local: \d{2}:\d{2}/);
    });
  });

  describe('prompt-questions.ts', () => {
    it('outputs question guidance for prompts', () => {
      const result = runPromptQuestionsHook(
        shared.projectDirectory,
        'Help me implement a new feature for user authentication',
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Contribute before asking');
      expect(result.stdout.trim().split('\n').at(-1)).toBe('- Avoid bloat.');
    });

    it('leads with the two anchor bullets in a stable order', () => {
      const result = runPromptQuestionsHook(shared.projectDirectory, 'Ship the auth fix');

      // Position, not just presence: the anchors are assembled separately from the
      // situational lines precisely so no later push can displace them.
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim().split('\n').slice(0, 2)).toEqual([
        '- Contribute before asking. Embed open questions in your contribution.',
        `- ${REPLY_FORMAT_REMINDER}`,
      ]);
    });

    it('proactively reminds Claude how to format substantive work updates', () => {
      const result = runPromptQuestionsHook(
        shared.projectDirectory,
        'Summarize the completed work',
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('- Reply format: lead with the answer.');
      expect(result.stdout).toContain('substantive work update');
      expect(result.stdout).toContain('**CONFIDENT**');
      expect(result.stdout).toContain('**BLOCKED**');
      expect(result.stdout).toContain('**Next:**');
      expect(result.stdout).toContain('**Need:**');
    });

    it('keeps active implement/TDD prompts free of the decision-brief demand', () => {
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: 'TDD123',
          type: 'feature',
          phase: 'implement',
          status: 'in_progress',
          lastModified: VERIFIED_AT,
        },
      ]);
      writeTestFile(
        shared.projectDirectory,
        '.project/tickets/TDD123/test-definitions.md',
        ['## Scenario: implement work', '- [x] RED', '- [ ] GREEN', '- [ ] REFACTOR', ''].join(
          '\n',
        ),
      );
      writeTestFile(
        shared.projectDirectory,
        '.project/quality-state-test-session.json',
        JSON.stringify({ activeTicket: 'TDD123' }),
      );

      try {
        const result = runPromptQuestionsHook(
          shared.projectDirectory,
          JSON.stringify({ session_id: 'test-session', prompt: 'Continue implementation' }),
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('- Reply format: lead with the answer.');
        expect(result.stdout).not.toContain('**CONFIDENT**/**BLOCKED**');
        expect(result.stdout).not.toContain(REPLY_FORMAT_REMINDER);
      } finally {
        clearIssuesDirectory(shared.projectDirectory);
        rmSync(`${shared.projectDirectory}/.project/quality-state-test-session.json`, {
          force: true,
        });
      }
    });

    it('clears the idle Stop-review marker for the submitted session (1492)', () => {
      const sessionId = 'awaiting-user-prompt';
      const statePath = `.project/quality-state-${sessionId}.json`;
      writeTestFile(
        shared.projectDirectory,
        statePath,
        JSON.stringify({
          recentFailures: [],
          stopQualityReviewAwaitingUserPrompt: true,
        }),
      );

      try {
        const result = runPromptQuestionsHook(
          shared.projectDirectory,
          JSON.stringify({ session_id: sessionId, prompt: 'Continue with the next change.' }),
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Contribute before asking');
        expect(JSON.parse(readTestFile(shared.projectDirectory, statePath))).toMatchObject({
          stopQualityReviewAwaitingUserPrompt: false,
        });
      } finally {
        rmSync(`${shared.projectDirectory}/${statePath}`, { force: true });
      }
    });

    it('persists the idle Stop-review marker clear when reminder derivation throws (1492)', () => {
      const sessionId = 'marker-clear-after-reminder-error';
      const statePath = `.project/quality-state-${sessionId}.json`;
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: 'MALFORMED',
          type: 'task',
          phase: 'implement',
          status: 'in_progress',
          lastModified: VERIFIED_AT,
        },
      ]);
      writeTestFile(
        shared.projectDirectory,
        statePath,
        JSON.stringify({
          activeTicket: 'MALFORMED',
          stopQualityReviewAwaitingUserPrompt: true,
          // A valid JSON state with an invalid cached failure shape makes the
          // reminder path throw after the marker has been cleared in memory.
          // The pending nudge is downstream of that failure. Its absence below
          // pins the error precondition, so a future defensive normalization of
          // recentFailures cannot turn this recovery test into a vacuous pass.
          learningsNudgesPending: ['research.md'],
          recentFailures: { length: 1 },
        }),
      );

      try {
        const result = runPromptQuestionsHook(
          shared.projectDirectory,
          JSON.stringify({ session_id: sessionId, prompt: 'Continue with the next change.' }),
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('Novel claim detected');
        expect(JSON.parse(readTestFile(shared.projectDirectory, statePath))).toMatchObject({
          stopQualityReviewAwaitingUserPrompt: false,
        });
      } finally {
        clearIssuesDirectory(shared.projectDirectory);
        rmSync(`${shared.projectDirectory}/${statePath}`, { force: true });
      }
    });

    it('exits silently for non-safeword project', () => {
      const nonSafewordDirectory = createTemporaryDirectory();
      try {
        const result = runPromptQuestionsHook(
          shared.projectDirectory,
          'Help me implement a new feature for user authentication',
          nonSafewordDirectory,
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe('');
      } finally {
        removeTemporaryDirectory(nonSafewordDirectory);
      }
    });
  });
});

describe('E2E: Phase-Aware Quality Review', () => {
  describe('Happy Path - Phase Detection', () => {
    it('Scenario 1: Shows intake prompts during discovery phase', () => {
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'intake',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);

      const result = runStopHookForPhase(shared.projectDirectory);

      expect(result.reason).toContain('Phase: intake');
      expect(result.reason).toContain('CONFIDENT');
    });

    it('Scenario 2: Shows scenario prompts during define-behavior phase', () => {
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'define-behavior',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);

      const result = runStopHookForPhase(shared.projectDirectory);

      expect(result.reason).toContain('Phase: define-behavior');
      expect(result.reason).toContain('CONFIDENT');
      expect(result.reason).toContain('AODI');
    });

    it('Scenario 3: Shows implementation prompts during implement phase', () => {
      setupIssuesDirectory(shared.projectDirectory, [
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
        shared.projectDirectory,
        '.project/tickets/001/test-definitions.md',
        '# Test Definitions\n\n## Rule: Test rule\n\n- [x] Scenario one\n',
      );

      const result = runStopHookForPhase(shared.projectDirectory);

      expect(result.reason).toContain('Phase: implement');
      expect(result.reason).toContain('CONFIDENT');
      expect(result.reason).toContain('BLOCKED');
    });

    it('Scenario 4: Hard blocks done phase without verify.md', () => {
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'done',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      writeTestFile(
        shared.projectDirectory,
        '.project/tickets/001/test-definitions.md',
        '# Test Definitions\n\n## Rule: Test rule\n\n- [x] Scenario one\n',
      );
      // No verify.md — should block

      const result = runStopHookForPhase(shared.projectDirectory);

      expect(result.exitCode).toBe(0);
      expect(result.reason).toContain('verify');
    });

    it('Scenario 4b: Allows done phase with verify.md present', () => {
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'done',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      writeTestFile(
        shared.projectDirectory,
        '.project/tickets/001/test-definitions.md',
        '# Test Definitions\n\n## Rule: Test rule\n\n- [x] Scenario one\n',
      );
      writeTestFile(
        shared.projectDirectory,
        '.project/tickets/001/verify.md',
        createVerifyContent({ testSuite: '**Test Suite:** ✓ 10/10 tests pass' }),
      );

      const result = runStopHookForPhase(shared.projectDirectory);

      expect(result.exitCode).toBe(0);
      expect(result.reason).toBe('');
    });
  });

  describe('Edge Cases - Fallbacks', () => {
    it('Scenario 5: Falls back to implement when no phase field', () => {
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: '001',
          type: 'feature',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);

      const result = runStopHookForPhase(shared.projectDirectory);

      // Default implementation review (binary form)
      expect(result.reason).toContain('CONFIDENT');
      expect(result.reason).toContain('BLOCKED');
    });

    it('Scenario 6: Falls back to implement for unknown phase', () => {
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'invalid-phase',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);

      const result = runStopHookForPhase(shared.projectDirectory);

      // Default implementation review (binary form)
      expect(result.reason).toContain('CONFIDENT');
      expect(result.reason).toContain('BLOCKED');
    });
  });

  describe('Edge Cases - Ticket Filtering', () => {
    it('Scenario 7: Ignores backlog tickets (status filtering)', () => {
      setupIssuesDirectory(shared.projectDirectory, [
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

      const result = runStopHookForPhase(shared.projectDirectory);

      // Should use intake from ticket 001, not implement from ticket 002
      expect(result.reason).toContain('Phase: intake');
    });

    it('Scenario 8: Ignores epic tickets (type filtering)', () => {
      setupIssuesDirectory(shared.projectDirectory, [
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

      const result = runStopHookForPhase(shared.projectDirectory);

      // Should use intake from feature, not implement from epic
      expect(result.reason).toContain('Phase: intake');
    });

    it('Scenario 9: Falls back when no in_progress tickets', () => {
      setupIssuesDirectory(shared.projectDirectory, [
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

      const result = runStopHookForPhase(shared.projectDirectory);

      // Default implementation review (fallback)
      expect(result.reason).toContain('CONFIDENT');
    });

    it('Scenario 10: Falls back when issues directory empty', () => {
      clearIssuesDirectory(shared.projectDirectory);

      const result = runStopHookForPhase(shared.projectDirectory);

      // Default implementation review (fallback)
      expect(result.reason).toContain('CONFIDENT');
    });
  });

  describe('Cumulative Artifact Checks', () => {
    it('Scenario 11a: Soft blocks feature at plan-implementation without test-definitions.md', () => {
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'plan-implementation',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      // No test-definitions.md file exists

      const result = runStopHookForPhase(shared.projectDirectory);

      expect(result.exitCode).toBe(0); // Soft block uses exit 0
      expect(result.reason).toContain('test-definitions.md');
    });

    it('Scenario 11b: Allows stop at plan-implementation with ledger but no impl-plan yet', () => {
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'plan-implementation',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      writeTestFile(
        shared.projectDirectory,
        '.project/tickets/001/test-definitions.md',
        '# Test Definitions\n\n## Rule: Test rule\n\n- [ ] Scenario one\n',
      );
      writeTestFile(shared.projectDirectory, '.project/tickets/001/spec.md', '# Spec\n');
      // Deliberately no impl-plan.md — mid-planning stop must stay legal (decision 6)

      const result = runStopHookForPhase(shared.projectDirectory);

      expect(result.exitCode).toBe(0);
      expect(result.reason ?? '').not.toContain('requires impl-plan.md');
    });

    it('Scenario 11: Soft blocks feature at scenario-gate without test-definitions.md', () => {
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'scenario-gate',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      // No test-definitions.md file exists

      const result = runStopHookForPhase(shared.projectDirectory);

      // Should soft block with artifact requirement message
      expect(result.exitCode).toBe(0); // Soft block uses exit 0
      expect(result.reason).toContain('test-definitions.md');
    });

    it('Scenario 12: Allows feature at scenario-gate with test-definitions.md', () => {
      setupIssuesDirectory(shared.projectDirectory, [
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
        shared.projectDirectory,
        '.project/tickets/001/test-definitions.md',
        '# Test Definitions\n\n## Rule: Test rule\n\n- [ ] Scenario one\n',
      );

      const result = runStopHookForPhase(shared.projectDirectory);

      // Should show normal phase review, not artifact block
      expect(result.reason).toContain('Phase: scenario-gate');
      expect(result.reason).not.toContain('test-definitions.md');
    });

    it('Scenario 13: Tasks skip artifact checks (no test-definitions required)', () => {
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: '001',
          type: 'task',
          phase: 'implement',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      // No test-definitions.md - should be fine for tasks

      const result = runStopHookForPhase(shared.projectDirectory);

      // Should show normal implementation review, not artifact block
      expect(result.reason).toContain('CONFIDENT');
      expect(result.reason).not.toContain('test-definitions.md');
    });
  });

  describe('Type-Aware Done Gate', () => {
    it('Scenario 14: Feature done blocks without verify.md even with complete scenarios', () => {
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'done',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      writeTestFile(
        shared.projectDirectory,
        '.project/tickets/001/test-definitions.md',
        '# Test Definitions\n\n## Rule: Test rule\n\n- [x] Scenario one\n',
      );
      // No verify.md — blocks on missing artifact before checking scenarios

      const result = runStopHookForPhase(shared.projectDirectory);

      expect(result.exitCode).toBe(0);
      expect(result.reason).toContain('verify');
    });

    it('Scenario 15: Task done requires verify.md', () => {
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: '001',
          type: 'task',
          phase: 'done',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      writeTestFile(
        shared.projectDirectory,
        '.project/tickets/001/verify.md',
        createVerifyContent(),
      );

      const evidenceText = '## Done Checklist\n\n**Test Suite:** ✓ 42/42 tests pass';
      const result = runStopHookForPhase(shared.projectDirectory, evidenceText);

      expect(result.exitCode).toBe(0);
      expect(result.reason).toBe('');
    });

    it('Scenario 15b: Task done blocks when verify.md lacks PR scope evidence', () => {
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: '001',
          type: 'task',
          phase: 'done',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      writeTestFile(
        shared.projectDirectory,
        '.project/tickets/001/verify.md',
        'Verified: 2026-04-15T18:00:00Z\n\n**Test Suite:** ✓ 42/42 tests pass\n',
      );

      const evidenceText = '## Done Checklist\n\n**Test Suite:** ✓ 42/42 tests pass';
      const result = runStopHookForPhase(shared.projectDirectory, evidenceText);

      expect(result.exitCode).toBe(0);
      expect(result.reason).toContain('PR scope evidence');
    });

    it('Scenario 15c: Task done blocks when verify.md reports piggybacked changes', () => {
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: '001',
          type: 'task',
          phase: 'done',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      writeTestFile(
        shared.projectDirectory,
        '.project/tickets/001/verify.md',
        [
          'Verified: 2026-04-15T18:00:00Z',
          '',
          '**Test Suite:** ✓ 42/42 tests pass',
          '**PR Scope:** ❌ Piggybacked changes: docs/drive-by.md',
          '',
        ].join('\n'),
      );

      const evidenceText = '## Done Checklist\n\n**Test Suite:** ✓ 42/42 tests pass';
      const result = runStopHookForPhase(shared.projectDirectory, evidenceText);

      expect(result.exitCode).toBe(0);
      expect(result.reason).toContain('PR scope failed');
    });

    it('Scenario 16: Feature done with verify.md and complete scenarios passes', () => {
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'done',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      writeTestFile(
        shared.projectDirectory,
        '.project/tickets/001/test-definitions.md',
        '# Test Definitions\n\n## Rule: Test rule\n\n- [x] Scenario one\n',
      );
      writeTestFile(
        shared.projectDirectory,
        '.project/tickets/001/verify.md',
        createVerifyContent({ extraLines: ['Audit passed'] }),
      );

      const result = runStopHookForPhase(shared.projectDirectory);

      expect(result.exitCode).toBe(0);
      expect(result.reason).toBe('');
    });

    it('T7: Feature done blocks with incomplete scenarios even with verify.md', () => {
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'done',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      writeTestFile(
        shared.projectDirectory,
        '.project/tickets/001/test-definitions.md',
        '# Test Definitions\n\n## Rule: Test rule\n\n- [ ] Scenario one\n',
      );
      writeTestFile(
        shared.projectDirectory,
        '.project/tickets/001/verify.md',
        createVerifyContent(),
      );

      const result = runStopHookForPhase(shared.projectDirectory);

      expect(result.exitCode).toBe(0);
      expect(result.reason).toContain('scenarios');
    });

    it('T8: Feature done passes with verify.md and complete scenarios', () => {
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'done',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      writeTestFile(
        shared.projectDirectory,
        '.project/tickets/001/test-definitions.md',
        '# Test Definitions\n\n## Rule: Test rule\n\n- [x] Scenario one\n',
      );
      writeTestFile(
        shared.projectDirectory,
        '.project/tickets/001/verify.md',
        createVerifyContent({ extraLines: ['Audit passed'] }),
      );

      const result = runStopHookForPhase(shared.projectDirectory);

      expect(result.exitCode).toBe(0);
      expect(result.reason).toBe('');
    });

    it('T9: Feature done hard-blocks when test-definitions.md has content but no GFM checkboxes', () => {
      setupIssuesDirectory(shared.projectDirectory, [
        {
          id: '001',
          type: 'feature',
          phase: 'done',
          status: 'in_progress',
          lastModified: '2026-01-06T10:00:00Z',
        },
      ]);
      // Legacy / unrecognized format — has content but no GFM task list items.
      writeTestFile(
        shared.projectDirectory,
        '.project/tickets/001/test-definitions.md',
        [
          '# Test Definitions',
          '',
          '## Scenario: Legacy format',
          '',
          'Given some setup',
          'When action happens',
          'Then outcome is observed',
          '',
        ].join('\n'),
      );
      writeTestFile(
        shared.projectDirectory,
        '.project/tickets/001/verify.md',
        createVerifyContent({ extraLines: ['Audit passed'] }),
      );

      const result = runStopHookForPhase(shared.projectDirectory);

      // checkCumulativeArtifacts fires first for features and rejects zero-checkbox files
      // with "no scenarios defined". The GFM-specific hard-block (checkScenariosComplete)
      // is still reachable for tasks — covered by the next test.
      expect(result.exitCode).toBe(0);
      expect(result.reason).toContain('no scenarios defined');
    });
  });

  // Cleanup after all phase tests
  afterAll(() => {
    clearIssuesDirectory(shared.projectDirectory);
  });
});

describe('E2E: Stop Hook', () => {
  describe('stop-quality.ts', () => {
    it('returns the concise correction through the installed Stop entry point', () => {
      const transcriptPath = createMultiMessageTranscript(shared.projectDirectory, [
        { text: 'Let me edit that file.', toolUse: 'Edit' },
      ]);

      const result = runStopHook(shared.projectDirectory, transcriptPath, {
        last_assistant_message: 'Implemented and checked the requested change.',
      });
      const output = parseStopOutput(result);

      expect(result.exitCode).toBe(0);
      expect(output.decision).toBe('block');
      expect(output.reason).toContain('no recognized verdict');
      expect(output.reason).not.toContain('Apply SAFEWORD.md');
      expect(output.reason).not.toContain('Phase: implement');
    });

    it('repairs a null quality-state root so the next Stop review is deduplicated', () => {
      const sessionId = 'malformed-root-review';
      const statePath = `.project/quality-state-${sessionId}.json`;
      const transcriptPath = createMultiMessageTranscript(shared.projectDirectory, [
        { text: 'Let me edit that file.', toolUse: 'Edit' },
      ]);
      writeTestFile(shared.projectDirectory, statePath, 'null');

      try {
        const first = runStopHook(shared.projectDirectory, transcriptPath, {
          session_id: sessionId,
          last_assistant_message: 'Implemented and checked the requested change.',
        });
        const repairedState = JSON.parse(readTestFile(shared.projectDirectory, statePath));
        const second = runStopHook(shared.projectDirectory, transcriptPath, {
          session_id: sessionId,
          last_assistant_message: 'Implemented and checked the requested change.',
        });

        expect(parseStopOutput(first).decision).toBe('block');
        expect(repairedState).toMatchObject({ stopQualityReviewAwaitingUserPrompt: true });
        expect(second.exitCode).toBe(0);
        expect(second.stdout.trim()).toBe('');
      } finally {
        rmSync(`${shared.projectDirectory}/${statePath}`, { force: true });
      }
    });

    it('repairs malformed quality-state JSON so the next Stop review is deduplicated', () => {
      const sessionId = 'malformed-json-review';
      const statePath = `.project/quality-state-${sessionId}.json`;
      const transcriptPath = createMultiMessageTranscript(shared.projectDirectory, [
        { text: 'Let me edit that file.', toolUse: 'Edit' },
      ]);
      writeTestFile(shared.projectDirectory, statePath, '{not valid json');

      try {
        const first = runStopHook(shared.projectDirectory, transcriptPath, {
          session_id: sessionId,
          last_assistant_message: 'Implemented and checked the requested change.',
        });
        const repairedState = JSON.parse(readTestFile(shared.projectDirectory, statePath));
        const second = runStopHook(shared.projectDirectory, transcriptPath, {
          session_id: sessionId,
          last_assistant_message: 'Implemented and checked the requested change.',
        });

        expect(parseStopOutput(first).decision).toBe('block');
        expect(repairedState).toMatchObject({ stopQualityReviewAwaitingUserPrompt: true });
        expect(second.exitCode).toBe(0);
        expect(second.stdout.trim()).toBe('');
      } finally {
        rmSync(`${shared.projectDirectory}/${statePath}`, { force: true });
      }
    });

    it('triggers quality review when edit tools are used', () => {
      const transcriptPath = createMultiMessageTranscript(shared.projectDirectory, [
        { text: 'Let me edit that file.', toolUse: 'Edit' },
      ]);

      const result = runStopHook(shared.projectDirectory, transcriptPath);
      const output = parseStopOutput(result);

      expect(result.exitCode).toBe(0);
      expect(output.decision).toBe('block');
      expect(output.reason).toContain('CONFIDENT');
    });

    it('exits silently when no edit tools are used', () => {
      const text = 'I answered a question without making any changes.';
      const transcriptPath = createMockTranscript(shared.projectDirectory, text);

      const result = runStopHook(shared.projectDirectory, transcriptPath);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('');
    });

    it('exits silently for non-safeword project', () => {
      const nonSafewordDirectory = createTemporaryDirectory();
      try {
        const result = spawnSync('bun', ['.safeword/hooks/stop-quality.ts'], {
          input: JSON.stringify({
            transcript_path: nodePath.join(nonSafewordDirectory, 'fake.jsonl'),
          }),
          cwd: shared.projectDirectory,
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
      const transcriptPath = createMultiMessageTranscript(shared.projectDirectory, [
        { text: 'Let me edit that file.', toolUse: 'Edit' },
        { text: 'Done with the changes.' },
      ]);

      const result = runStopHook(shared.projectDirectory, transcriptPath);
      const output = parseStopOutput(result);

      expect(result.exitCode).toBe(0);
      expect(output.decision).toBe('block');
      expect(output.reason).toContain('CONFIDENT');
    });

    it('exits with error when usage limit reached in last message', () => {
      const text = '5-hour limit reached - resets in 2 hours';
      const transcriptPath = createMockTranscript(shared.projectDirectory, text);

      const result = runStopHook(shared.projectDirectory, transcriptPath);

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
      const transcriptPath = createMockTranscript(shared.projectDirectory, text);

      const result = runStopHook(shared.projectDirectory, transcriptPath);

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
  describe('Test 2.1: Routes .py files to Ruff', () => {
    it('should handle Python files without error', () => {
      writeTestFile(shared.projectDirectory, 'test.py', 'x = 1\n');
      const result = runLintHook(shared.projectDirectory, `${shared.projectDirectory}/test.py`);
      expect(result.status).toBe(0);
    });

    it('should handle .pyi stub files', () => {
      writeTestFile(shared.projectDirectory, 'test.pyi', 'def foo() -> int: ...\n');
      const result = runLintHook(shared.projectDirectory, `${shared.projectDirectory}/test.pyi`);
      expect(result.status).toBe(0);
    });
  });

  describe('Test 2.2: Continues running ESLint for JS/TS files', () => {
    it('should run ESLint for TypeScript files', () => {
      writeTestFile(shared.projectDirectory, 'test.ts', 'const x = 1\n');
      const result = runLintHook(shared.projectDirectory, `${shared.projectDirectory}/test.ts`);
      // ESLint runs and exits successfully
      expect(result.status).toBe(0);
    });
  });

  describe('Test 2.3: Skips Ruff gracefully if not installed', () => {
    it('should not error when Ruff is missing from PATH', () => {
      writeTestFile(shared.projectDirectory, 'test.py', 'print("hello")\n');

      // Find actual bun path (process.execPath gives node when running via vitest)
      const bunPath = execSync('which bun', { encoding: 'utf8' }).trim();
      const bunDirectory = nodePath.dirname(bunPath);

      // Run with PATH that has bun but likely not ruff
      const result = spawnSync(
        'bash',
        [
          '-c',
          `PATH=/bin:/usr/bin:${bunDirectory} bun .safeword/hooks/lib/lint.ts "${shared.projectDirectory}/test.py"`,
        ],
        {
          cwd: shared.projectDirectory,
          env: { ...process.env, CLAUDE_PROJECT_DIR: shared.projectDirectory },
          encoding: 'utf8',
        },
      );

      // Should exit 0 (graceful skip via .nothrow())
      expect(result.status).toBe(0);
    });
  });

  describe('Test 2.4: Ruff fixes Python files via lint hook', () => {
    it.skipIf(!IS_RUFF_AVAILABLE)('should format Python files when run through lint hook', () => {
      // Create badly formatted Python file
      const badCode = 'x=1;y=2';
      writeTestFile(shared.projectDirectory, 'format-test.py', badCode);

      // Run lint hook on the file
      const result = runPostToolLint(
        shared.projectDirectory,
        `${shared.projectDirectory}/format-test.py`,
      );
      expect(result.status).toBe(0);

      // File should now be formatted
      const formatted = readTestFile(shared.projectDirectory, 'format-test.py');
      expect(formatted).toContain('x = 1');
      expect(formatted).toContain('y = 2');
    });

    it.skipIf(!IS_RUFF_AVAILABLE)('should fix auto-fixable lint issues', () => {
      // Create file with unused import (auto-fixable with --fix)
      const codeWithUnusedImport = 'import os\nx = 1\n';
      writeTestFile(shared.projectDirectory, 'fix-test.py', codeWithUnusedImport);

      // Run lint hook on the file
      const result = runPostToolLint(
        shared.projectDirectory,
        `${shared.projectDirectory}/fix-test.py`,
      );
      expect(result.status).toBe(0);

      // Unused import should be removed
      const fixed = readTestFile(shared.projectDirectory, 'fix-test.py');
      expect(fixed).not.toContain('import os');
      expect(fixed).toContain('x = 1');
    });

    it.skipIf(!IS_RUFF_AVAILABLE)(
      'should output additionalContext JSON when unfixable errors remain',
      () => {
        // F841 (unused variable after return) is not auto-fixable without --unsafe-fixes
        const codeWithUnfixable = 'def foo():\n    return\n    x = 1\n';
        writeTestFile(shared.projectDirectory, 'unfixable-test.py', codeWithUnfixable);

        const result = runPostToolLint(
          shared.projectDirectory,
          `${shared.projectDirectory}/unfixable-test.py`,
        );
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

    it.skipIf(!IS_RUFF_AVAILABLE)('should output no JSON when all errors are auto-fixed', () => {
      // Unused import is fully auto-fixable — no remaining errors
      const autoFixable = 'import os\nx = 1\n';
      writeTestFile(shared.projectDirectory, 'clean-after-fix.py', autoFixable);

      const result = runPostToolLint(
        shared.projectDirectory,
        `${shared.projectDirectory}/clean-after-fix.py`,
      );
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

describe('session-safeword-context.ts', () => {
  it('emits a compact Claude bootstrap that points to SAFEWORD.md', () => {
    const result = spawnSync(
      'bun',
      ['.safeword/hooks/session-safeword-context.ts', '--agent=claude'],
      {
        cwd: shared.projectDirectory,
        input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: shared.projectDirectory }),
        encoding: 'utf8',
      },
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(output.hookSpecificOutput.additionalContext).toContain('Safeword session bootstrap');
    expect(output.hookSpecificOutput.additionalContext).toContain('.safeword/SAFEWORD.md');
    expect(output.hookSpecificOutput.additionalContext).not.toContain('## Workflow');
    expect(output.hookSpecificOutput.additionalContext.length).toBeLessThanOrEqual(1000);
  });

  it('emits a compact Cursor bootstrap that points to SAFEWORD.md', () => {
    const result = spawnSync(
      'bun',
      ['.safeword/hooks/session-safeword-context.ts', '--agent=cursor'],
      {
        cwd: shared.projectDirectory,
        input: JSON.stringify({ workspace_root: shared.projectDirectory }),
        encoding: 'utf8',
      },
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.additional_context).toContain('Safeword session bootstrap');
    expect(output.additional_context).toContain('.safeword/SAFEWORD.md');
    expect(output.additional_context).not.toContain('## Workflow');
    expect(output.additional_context.length).toBeLessThanOrEqual(1000);
  });

  it('uses hook stdin cwd when the process starts from a subdirectory', () => {
    const nestedDirectory = nodePath.join(shared.projectDirectory, 'src/nested');
    mkdirSync(nestedDirectory, { recursive: true });

    const result = spawnSync(
      'bun',
      [
        nodePath.join(shared.projectDirectory, '.safeword/hooks/session-safeword-context.ts'),
        '--agent=codex',
      ],
      {
        cwd: nestedDirectory,
        input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: shared.projectDirectory }),
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(output.hookSpecificOutput.additionalContext).toContain('Safeword session bootstrap');
  });

  it('falls back to hook stdin cwd when CLAUDE_PROJECT_DIR is stale', () => {
    const staleDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-stale-project-dir-'));
    try {
      const result = spawnSync(
        'bun',
        [
          nodePath.join(shared.projectDirectory, '.safeword/hooks/session-safeword-context.ts'),
          '--agent=codex',
        ],
        {
          cwd: staleDirectory,
          env: { ...process.env, CLAUDE_PROJECT_DIR: staleDirectory },
          input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: shared.projectDirectory }),
          encoding: 'utf8',
        },
      );

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.hookSpecificOutput.hookEventName).toBe('SessionStart');
      expect(output.hookSpecificOutput.additionalContext).toContain('Safeword session bootstrap');
    } finally {
      rmSync(staleDirectory, { recursive: true, force: true });
    }
  });
});

describe('session-codex-start.ts', () => {
  it('runs the Codex SessionStart dispatcher and emits a compact bootstrap', () => {
    const result = spawnSync('bun', [TEMPLATE_CODEX_SESSION_START], {
      cwd: shared.projectDirectory,
      env: { ...process.env, SAFEWORD_NO_AUTO_UPGRADE: '1' },
      input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: shared.projectDirectory }),
      encoding: 'utf8',
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(output.hookSpecificOutput.additionalContext).toContain('Safeword session bootstrap');
    expect(output.hookSpecificOutput.additionalContext).toContain('.safeword/SAFEWORD.md');
    expect(output.hookSpecificOutput.additionalContext).not.toContain('## Workflow');
    expect(output.hookSpecificOutput.additionalContext.length).toBeLessThanOrEqual(1000);
  });
});

describe('session-cursor-auto-upgrade.ts', () => {
  it('runs silently and exits successfully when no upgrade should apply', () => {
    const result = spawnSync('bun', ['.safeword/hooks/session-cursor-auto-upgrade.ts'], {
      cwd: shared.projectDirectory,
      env: { ...process.env, SAFEWORD_NO_AUTO_UPGRADE: '1' },
      input: JSON.stringify({ workspace_root: shared.projectDirectory }),
      encoding: 'utf8',
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });
});

describe('Cursor auto-upgrade lock', () => {
  it(
    'blocks Cursor writes and shell commands while silent auto-upgrade is running',
    async () => {
      const projectDirectory = createTemporaryDirectory();

      try {
        createTypeScriptPackageJson(projectDirectory);
        initGitRepo(projectDirectory);
        await setupOrThrow(projectDirectory, ['setup', '--agents', 'cursor']);

        const lockPath = acquireAutoUpgradeLock({ projectDir: projectDirectory });
        expect(lockPath).toBeDefined();

        try {
          const result = spawnSync('bun', ['.safeword/hooks/cursor/pre-tool-quality.ts'], {
            cwd: projectDirectory,
            input: JSON.stringify({
              workspace_roots: [projectDirectory],
              conversation_id: 'conversation-1',
              tool_name: 'Write',
              tool_input: {
                file_path: nodePath.join(projectDirectory, 'src/index.ts'),
                content: 'export const value = 1;\n',
              },
            }),
            encoding: 'utf8',
          });

          expect(result.status, result.stderr || result.stdout).toBe(0);
          expect(JSON.parse(result.stdout)).toEqual({
            permission: 'deny',
            user_message: AUTO_UPGRADE_LOCK_MESSAGE,
            agent_message: AUTO_UPGRADE_LOCK_MESSAGE,
          });

          const shellResult = spawnSync(
            'bun',
            ['.safeword/hooks/cursor/before-shell-execution.ts'],
            {
              cwd: projectDirectory,
              input: JSON.stringify({
                workspace_roots: [projectDirectory],
                conversation_id: 'conversation-1',
                command: 'printf "changed" > .project/tickets/example.md',
              }),
              encoding: 'utf8',
            },
          );

          expect(shellResult.status, shellResult.stderr || shellResult.stdout).toBe(0);
          expect(JSON.parse(shellResult.stdout)).toEqual({
            permission: 'deny',
            user_message: AUTO_UPGRADE_LOCK_MESSAGE,
            agent_message: AUTO_UPGRADE_LOCK_MESSAGE,
          });
        } finally {
          releaseAutoUpgradeLock({ lockPath });
        }
      } finally {
        removeTemporaryDirectory(projectDirectory);
      }
    },
    TIMEOUT_SETUP_HOOK,
  );
});
