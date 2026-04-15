/**
 * Integration Test: Failure Memory (#111)
 *
 * Three-layer failure learning:
 * - Layer 1: Session-scoped failure detection (recentFailures in quality-state)
 * - Layer 2: Persistent pattern counters (failure-counts.json)
 * - Layer 3: CLAUDE.md escalation suggestion (prompt hook injection)
 *
 * Runs hooks from source tree (same pattern as quality-gates.test.ts).
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
const STOP_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/stop-quality.ts');
const PRE_TOOL_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/pre-tool-quality.ts');
const PROMPT_QUESTIONS = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/prompt-questions.ts');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stateFilePath(sessionId = 'test-session'): string {
  return `.safeword-project/quality-state-${sessionId}.json`;
}

function counterFilePath(): string {
  return '.safeword-project/failure-counts.json';
}

function writeState(cwd: string, state: Record<string, unknown>, sessionId = 'test-session'): void {
  writeTestFile(cwd, stateFilePath(sessionId), JSON.stringify(state, null, 2));
}

function readState(cwd: string, sessionId = 'test-session'): Record<string, unknown> {
  return JSON.parse(readTestFile(cwd, stateFilePath(sessionId)));
}

function writeCounterFile(cwd: string, counters: Record<string, unknown>): void {
  writeTestFile(cwd, counterFilePath(), JSON.stringify(counters, null, 2));
}

function readCounterFile(cwd: string): Record<string, unknown> {
  const filePath = nodePath.join(cwd, counterFilePath());
  if (!existsSync(filePath)) return {};
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function createTestProject(): string {
  const dir = createTemporaryDirectory();
  initGitRepo(dir);
  writeTestFile(dir, '.safeword-project/.gitkeep', '');
  writeTestFile(dir, '.safeword/hooks/.gitkeep', '');
  writeTestFile(dir, 'init.txt', 'init');
  execSync('git add . && git commit -m "init"', { cwd: dir, stdio: 'pipe' });
  return dir;
}

function getHead(cwd: string): string {
  return execSync('git rev-parse --short HEAD', { cwd, encoding: 'utf8' }).trim();
}

/** Create a transcript with an Edit tool_use so stop hook sees edits */
function createTranscript(directory: string): string {
  const transcriptPath = nodePath.join(directory, 'transcript.jsonl');
  const line = JSON.stringify({
    type: 'assistant',
    message: {
      content: [
        { type: 'tool_use', name: 'Edit', id: 'toolu_1' },
        { type: 'text', text: 'Made changes.' },
      ],
    },
  });
  writeFileSync(transcriptPath, line);
  return transcriptPath;
}

/** Run stop hook with session_id */
function runStopHook(
  cwd: string,
  transcriptPath: string,
  sessionId = 'test-session',
  lastMessage = 'Made changes.',
) {
  return spawnSync('bun', [STOP_QUALITY], {
    input: JSON.stringify({
      session_id: sessionId,
      transcript_path: transcriptPath,
      last_assistant_message: lastMessage,
    }),
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

/** Run pre-tool hook */
function runPreTool(cwd: string, sessionId = 'test-session') {
  return spawnSync('bun', [PRE_TOOL_QUALITY], {
    input: JSON.stringify({
      session_id: sessionId,
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: nodePath.join(cwd, 'src/foo.ts') },
    }),
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

/** Run prompt hook */
function runPromptHook(cwd: string, sessionId = 'test-session') {
  return spawnSync('bun', [PROMPT_QUESTIONS], {
    input: JSON.stringify({
      session_id: sessionId,
      prompt: 'Continue working.',
    }),
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Failure Memory (#111)', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTestProject();
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  // =========================================================================
  // Layer 1: Session-scoped failure detection
  // =========================================================================
  describe('Layer 1: Session-scoped failure detection', () => {
    it('pre-tool writes recentFailures when LOC gate fires', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 450,
        lastCommitHash: head,
        activeTicket: null,
        lastKnownPhase: 'implement',
        gate: 'loc',
        lastKnownTddStep: null,
        locAtLastReview: 0,
      });

      runPreTool(projectDirectory);

      const state = readState(projectDirectory);
      const failures = state.recentFailures as { pattern: string; timestamp: string }[];
      expect(failures).toBeDefined();
      expect(failures.length).toBeGreaterThan(0);
      expect(failures[0].pattern).toBe('loc-exceeded');
      expect(failures[0].timestamp).toBeDefined();
    });

    it('stop hook writes recentFailures when done gate blocks for test failure', () => {
      // Create a done-phase feature ticket (id without quotes — regex extracts literal)
      const ticketFolder = '.safeword-project/tickets/099-test';
      writeTestFile(
        projectDirectory,
        `${ticketFolder}/ticket.md`,
        ['---', 'id: 099', 'status: in_progress', 'type: feature', 'phase: done', '---'].join('\n'),
      );
      writeTestFile(
        projectDirectory,
        `${ticketFolder}/test-definitions.md`,
        '## Rule: Test\n\n- [x] Scenario one\n',
      );

      // Session state bound to this ticket (phase derived from ticket.md, not cached)
      writeState(projectDirectory, {
        locSinceCommit: 10,
        lastCommitHash: getHead(projectDirectory),
        activeTicket: '099',
        gate: null,
        locAtLastReview: 0,
      });

      const transcriptPath = createTranscript(projectDirectory);
      // No test evidence in last_assistant_message → done gate should block
      runStopHook(projectDirectory, transcriptPath, 'test-session', 'I updated the code.');

      const state = readState(projectDirectory);
      const failures = state.recentFailures as { pattern: string }[];
      expect(failures).toBeDefined();
      expect(failures.some(f => f.pattern === 'done-gate-tests-failed')).toBe(true);
    });

    it('prompt hook injects failure parenthetical when recentFailures has entries', () => {
      // Create ticket so getTicketInfo() resolves (phase derived from file, not cache)
      writeTestFile(
        projectDirectory,
        '.safeword-project/tickets/099-test/ticket.md',
        ['---', 'id: 099', 'status: in_progress', 'type: feature', 'phase: implement', '---'].join(
          '\n',
        ),
      );

      writeState(projectDirectory, {
        locSinceCommit: 100,
        lastCommitHash: getHead(projectDirectory),
        activeTicket: '099',
        gate: null,
        locAtLastReview: 0,
        recentFailures: [{ pattern: 'loc-exceeded', timestamp: new Date().toISOString() }],
      });

      const result = runPromptHook(projectDirectory);
      const output = result.stdout;

      expect(output).toContain('LOC gate');
      expect(output).toContain('commit');
    });
  });

  // =========================================================================
  // Layer 2: Persistent pattern counters
  // =========================================================================
  describe('Layer 2: Persistent pattern counters', () => {
    it('pre-tool increments counter file when LOC gate fires', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 450,
        lastCommitHash: head,
        activeTicket: null,
        lastKnownPhase: 'implement',
        gate: 'loc',
        lastKnownTddStep: null,
        locAtLastReview: 0,
      });

      runPreTool(projectDirectory);

      const counters = readCounterFile(projectDirectory);
      const locCounter = counters['loc-exceeded'] as { count: number; lastSeen: string };
      expect(locCounter).toBeDefined();
      expect(locCounter.count).toBe(1);
      expect(locCounter.lastSeen).toBeDefined();
    });

    it('counter only increments once per pattern per session (dedup)', () => {
      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 450,
        lastCommitHash: head,
        activeTicket: null,
        lastKnownPhase: 'implement',
        gate: 'loc',
        lastKnownTddStep: null,
        locAtLastReview: 0,
      });

      // Fire LOC gate twice in same session
      runPreTool(projectDirectory);

      // Re-set gate (normally post-tool does this, but we're simulating)
      const state = readState(projectDirectory);
      state.gate = 'loc';
      writeState(projectDirectory, state);

      runPreTool(projectDirectory);

      const counters = readCounterFile(projectDirectory);
      const locCounter = counters['loc-exceeded'] as { count: number };
      expect(locCounter.count).toBe(1); // Only 1, not 2
    });

    it('counter file is created on first failure', () => {
      const counterPath = nodePath.join(projectDirectory, counterFilePath());
      expect(existsSync(counterPath)).toBe(false);

      const head = getHead(projectDirectory);
      writeState(projectDirectory, {
        locSinceCommit: 450,
        lastCommitHash: head,
        activeTicket: null,
        lastKnownPhase: 'implement',
        gate: 'loc',
        lastKnownTddStep: null,
        locAtLastReview: 0,
      });

      runPreTool(projectDirectory);

      expect(existsSync(counterPath)).toBe(true);
    });
  });

  // =========================================================================
  // Layer 3: CLAUDE.md escalation suggestion
  // =========================================================================
  describe('Layer 3: CLAUDE.md escalation suggestion', () => {
    it('prompt hook suggests CLAUDE.md when counter exceeds threshold', () => {
      writeState(projectDirectory, {
        locSinceCommit: 100,
        lastCommitHash: getHead(projectDirectory),
        activeTicket: '099',
        lastKnownPhase: 'implement',
        gate: null,
        lastKnownTddStep: null,
        locAtLastReview: 0,
      });

      writeCounterFile(projectDirectory, {
        'loc-exceeded': { count: 3, lastSeen: '2026-04-12', countAtLastSuggestion: null },
      });

      const result = runPromptHook(projectDirectory);
      const output = result.stdout;

      expect(output).toContain('loc-exceeded');
      expect(output).toContain('CLAUDE.md');
    });

    it('prompt hook suppresses suggestion when countAtLastSuggestion is current', () => {
      writeState(projectDirectory, {
        locSinceCommit: 100,
        lastCommitHash: getHead(projectDirectory),
        activeTicket: '099',
        lastKnownPhase: 'implement',
        gate: null,
        lastKnownTddStep: null,
        locAtLastReview: 0,
      });

      // Count is 3 but countAtLastSuggestion is also 3 → already suggested
      writeCounterFile(projectDirectory, {
        'loc-exceeded': { count: 3, lastSeen: '2026-04-12', countAtLastSuggestion: 3 },
      });

      const result = runPromptHook(projectDirectory);
      const output = result.stdout;

      expect(output).not.toContain('CLAUDE.md');
    });

    it('prompt hook re-suggests when count increases past threshold since last suggestion', () => {
      writeState(projectDirectory, {
        locSinceCommit: 100,
        lastCommitHash: getHead(projectDirectory),
        activeTicket: '099',
        lastKnownPhase: 'implement',
        gate: null,
        lastKnownTddStep: null,
        locAtLastReview: 0,
      });

      // Last suggested at count=3, now at count=6 → 3 new occurrences → re-suggest
      writeCounterFile(projectDirectory, {
        'loc-exceeded': { count: 6, lastSeen: '2026-04-12', countAtLastSuggestion: 3 },
      });

      const result = runPromptHook(projectDirectory);
      const output = result.stdout;

      expect(output).toContain('loc-exceeded');
      expect(output).toContain('CLAUDE.md');
    });

    it('prompt hook updates countAtLastSuggestion when suggestion fires', () => {
      writeState(projectDirectory, {
        locSinceCommit: 100,
        lastCommitHash: getHead(projectDirectory),
        activeTicket: '099',
        lastKnownPhase: 'implement',
        gate: null,
        lastKnownTddStep: null,
        locAtLastReview: 0,
      });

      writeCounterFile(projectDirectory, {
        'loc-exceeded': { count: 3, lastSeen: '2026-04-12', countAtLastSuggestion: null },
      });

      runPromptHook(projectDirectory);

      const counters = readCounterFile(projectDirectory);
      const locCounter = counters['loc-exceeded'] as { countAtLastSuggestion: number };
      expect(locCounter.countAtLastSuggestion).toBe(3);
    });
  });
});

/* eslint-enable unicorn/no-null */
