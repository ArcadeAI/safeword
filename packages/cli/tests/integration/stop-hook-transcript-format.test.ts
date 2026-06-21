/**
 * Frozen Transcript Fixture Test: Stop Hook Format Compatibility
 *
 * Runs the stop-quality hook against a frozen real-format transcript.
 * Purpose: catch format drift if Anthropic changes the Claude Code transcript
 * JSONL structure (field names, nesting, content block types, etc.).
 *
 * The fixture captures the actual transcript format as of Claude Code v2.1.42:
 * - Top-level fields: type, parentUuid, isSidechain, userType, cwd, sessionId,
 *   version, gitBranch, requestId, uuid, timestamp
 * - Nested message: { model, role, content: ContentItem[] }
 * - Content types: text, tool_use, tool_result, thinking
 *
 * If the hook silently fails to parse new-format transcripts, this test will
 * catch it (the hook would exit 0 without a block decision, but we verify it
 * does block on a transcript where edits were made).
 *
 * To update: capture a real session transcript, strip sensitive fields, save to
 * packages/cli/tests/fixtures/stop-hook-transcript.jsonl.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory, TIMEOUT_QUICK } from '../helpers';

// Run the hook directly from the safeword source tree — no runCli(['setup']) needed.
// This matches the pattern used in quality-gates.test.ts.
const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const STOP_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/stop-quality.ts');
const FIXTURE_PATH = nodePath.join(import.meta.dirname, '../fixtures/stop-hook-transcript.jsonl');

// Module-scope helpers — pure (no closure over describe-local state).

function runStopHookDonePhase(directory: string, lastAssistantMessage: string) {
  const transcriptLine = JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'tool_use', name: 'Edit', id: 'toolu_1' }],
    },
  });
  const transcriptPath = nodePath.join(directory, 'transcript.jsonl');
  writeFileSync(transcriptPath, transcriptLine);

  const ticketFolder = nodePath.join(directory, '.safeword-project', 'tickets', '099-done-task');
  mkdirSync(ticketFolder, { recursive: true });
  writeFileSync(
    nodePath.join(ticketFolder, 'ticket.md'),
    ['---', 'id: 099', 'status: in_progress', 'type: task', 'phase: done', '---'].join('\n'),
  );

  return spawnSync('bun', [STOP_QUALITY], {
    input: JSON.stringify({
      transcript_path: transcriptPath,
      last_assistant_message: lastAssistantMessage,
    }),
    cwd: directory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

function createTranscript(directory: string): string {
  const transcriptLine = JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'tool_use', name: 'Edit', id: 'toolu_1' }],
    },
  });
  const transcriptPath = nodePath.join(directory, 'transcript.jsonl');
  writeFileSync(transcriptPath, transcriptLine);
  return transcriptPath;
}

function createTicket(
  directory: string,
  id: string,
  slug: string,
  options: { phase: string; status: string; type?: string },
): void {
  const ticketFolder = nodePath.join(directory, '.safeword-project', 'tickets', `${id}-${slug}`);
  mkdirSync(ticketFolder, { recursive: true });
  writeFileSync(
    nodePath.join(ticketFolder, 'ticket.md'),
    [
      '---',
      `id: ${id}`,
      `status: ${options.status}`,
      `type: ${options.type ?? 'task'}`,
      `phase: ${options.phase}`,
      `last_modified: ${new Date().toISOString()}`,
      '---',
    ].join('\n'),
  );
}

function writeSessionState(
  directory: string,
  sessionId: string,
  state: Record<string, unknown>,
): void {
  const statePath = nodePath.join(
    directory,
    '.safeword-project',
    `quality-state-${sessionId}.json`,
  );
  mkdirSync(nodePath.join(directory, '.safeword-project'), { recursive: true });
  // eslint-disable-next-line unicorn/no-null -- JSON.stringify replacer parameter
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function runStopHook(directory: string, transcriptPath: string, sessionId?: string) {
  return spawnSync('bun', [STOP_QUALITY], {
    input: JSON.stringify({
      session_id: sessionId,
      transcript_path: transcriptPath,
      last_assistant_message: 'Here is what I changed.',
    }),
    cwd: directory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

const state: { projectDirectory: string } = { projectDirectory: '' };

beforeEach(() => {
  state.projectDirectory = createTemporaryDirectory();
  // Hook only requires .safeword/ to exist (checked with existsSync)
  mkdirSync(nodePath.join(state.projectDirectory, '.safeword'), { recursive: true });
});

afterEach(() => {
  removeTemporaryDirectory(state.projectDirectory);
});

describe('Stop Hook: Done-phase verify.md artifact gate', () => {
  it('hard blocks done-phase without verify.md regardless of transcript content', () => {
    const result = runStopHookDonePhase(
      state.projectDirectory,
      'I updated the configuration file.',
    );
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout.trim()) as { decision?: string; reason?: string };
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toMatch(/verify/i);
  });
});

describe('Stop Hook: Done-gate fires without recent edit tools (AP3FGJ)', () => {
  /** A transcript whose only tool use is Bash (e.g. git commit) — no edit tools. */
  function writeNoEditTranscript(directory: string): string {
    const transcriptLine = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'Bash', id: 'b1' },
          { type: 'text', text: 'committed and done' },
        ],
      },
    });
    const transcriptPath = nodePath.join(directory, 'transcript.jsonl');
    writeFileSync(transcriptPath, transcriptLine);
    return transcriptPath;
  }

  it('evaluates the done-gate on a no-edit transcript (blocks on missing verify.md)', () => {
    const transcriptPath = writeNoEditTranscript(state.projectDirectory);
    createTicket(state.projectDirectory, '099', 'done-task', {
      phase: 'done',
      status: 'in_progress',
      type: 'task',
    });

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout.trim()) as { decision?: string; reason?: string };
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toMatch(/verify/i);
  });

  it('still exits silently on a no-edit transcript at a non-done phase (review path unchanged)', () => {
    const transcriptPath = writeNoEditTranscript(state.projectDirectory);
    createTicket(state.projectDirectory, '098', 'impl-task', {
      phase: 'implement',
      status: 'in_progress',
      type: 'task',
    });

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});

describe('Stop Hook: Frozen Transcript Format Compatibility', () => {
  it('detects edits and triggers quality review from real-format transcript', () => {
    const result = spawnSync('bun', [STOP_QUALITY], {
      input: JSON.stringify({
        transcript_path: FIXTURE_PATH,
        // Simulate hook runtime providing last_assistant_message directly.
        // combinedText now reads from this field instead of the transcript.
        last_assistant_message: 'Here is what I did: updated the file.',
      }),
      cwd: state.projectDirectory,
      env: { ...process.env, CLAUDE_PROJECT_DIR: state.projectDirectory },
      encoding: 'utf8',
      timeout: TIMEOUT_QUICK,
    });

    // Hook should soft-block (exit 0 with JSON decision) because:
    // Transcript has an Edit tool_use block → editToolsUsed = true
    const exitCode = result.status ?? 0;
    expect(exitCode).toBe(0);

    // Should produce a block decision (not silent exit).
    // If stdout is not valid JSON, the hook exited silently — likely a transcript format
    // change (e.g. renamed field) that caused the hook to find no assistant messages.
    let parsed: { decision?: string; reason?: string };
    try {
      parsed = JSON.parse(result.stdout.trim());
    } catch {
      throw new Error(
        `Hook exited silently (no JSON output) — transcript format may have changed.\nstderr: ${result.stderr}`,
      );
    }
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toMatch(/.+/);
  });

  it('fixture uses real transcript envelope fields (format regression guard)', () => {
    // Verify the fixture hasn't been accidentally simplified to our hand-crafted test
    // format ({"type":"assistant","message":{...}}). Real transcripts include routing
    // fields like parentUuid that are absent from the simplified format.
    const lines = readFileSync(FIXTURE_PATH, 'utf8').trim().split('\n');
    const hasRealEnvelope = lines.some(line => {
      try {
        return (JSON.parse(line) as Record<string, unknown>).parentUuid !== undefined;
      } catch {
        return false;
      }
    });
    expect(hasRealEnvelope).toBe(true);
  });
});

describe('Stop Hook: Ticket Resolution Context', () => {
  it('shows quality review when active ticket at implement phase', () => {
    createTicket(state.projectDirectory, '099', 'test', {
      phase: 'implement',
      status: 'in_progress',
    });
    const transcriptPath = createTranscript(state.projectDirectory);
    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    // Should soft-block with quality review (edits were made)
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toMatch(/\*\*CONFIDENT\*\*|decision brief/i);
  });

  it('shows generic quality review when no ticket exists', () => {
    // No ticket created — just .safeword/ dir (from beforeEach)
    const transcriptPath = createTranscript(state.projectDirectory);
    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    // Should still soft-block with generic quality review (edits were made, no ticket context)
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toMatch(/\*\*CONFIDENT\*\*|decision brief/i);
  });

  it('shows done-phase hard block when active ticket at done phase', () => {
    createTicket(state.projectDirectory, '099', 'test', {
      phase: 'done',
      status: 'in_progress',
    });
    const transcriptPath = createTranscript(state.projectDirectory);
    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    // Should hard-block requiring evidence (done phase)
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toMatch(/evidence|verify/i);
  });

  it('uses session binding when session_id and state file exist', () => {
    // Create two tickets — session is bound to 099
    createTicket(state.projectDirectory, '099', 'session-ticket', {
      phase: 'implement',
      status: 'in_progress',
    });
    createTicket(state.projectDirectory, '100', 'other-ticket', {
      phase: 'done',
      status: 'in_progress',
    });
    writeSessionState(state.projectDirectory, 'test-session', {
      locSinceCommit: 100,
      lastCommitHash: '',
      activeTicket: '099',
      lastKnownPhase: 'implement',
      // eslint-disable-next-line unicorn/no-null -- QualityState interface uses null
      lastKnownTddStep: null,
      gate: null, // eslint-disable-line unicorn/no-null -- QualityState interface uses null
      locAtLastReview: 0,
    });

    const transcriptPath = createTranscript(state.projectDirectory);
    const result = runStopHook(state.projectDirectory, transcriptPath, 'test-session');

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.decision).toBe('block');
    // Should show implement-phase quality review (session's ticket), not done-phase hard block
    expect(parsed.reason).toMatch(/quality review|CONFIDENT/i);
    // Should NOT be the done-phase hard-block message (which references verify.md missing)
    expect(parsed.reason).not.toMatch(/verify\.md/i);
  });

  it('shows no ticket context when session ticket is done status', () => {
    createTicket(state.projectDirectory, '099', 'done-ticket', {
      phase: 'done',
      status: 'done',
    });
    writeSessionState(state.projectDirectory, 'test-session', {
      locSinceCommit: 0,
      lastCommitHash: '',
      activeTicket: '099',
      lastKnownPhase: 'done',
      // eslint-disable-next-line unicorn/no-null -- QualityState interface uses null
      lastKnownTddStep: null,
      gate: null, // eslint-disable-line unicorn/no-null -- QualityState interface uses null
      locAtLastReview: 0,
    });

    const transcriptPath = createTranscript(state.projectDirectory);
    const result = runStopHook(state.projectDirectory, transcriptPath, 'test-session');

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.decision).toBe('block');
    // Done-status ticket = no ticket context → generic quality review, not done-phase hard block
    expect(parsed.reason).toMatch(/quality review|CONFIDENT/i);
    // Should NOT be the done-phase hard-block message (which references verify.md missing)
    expect(parsed.reason).not.toMatch(/verify\.md/i);
  });
});
