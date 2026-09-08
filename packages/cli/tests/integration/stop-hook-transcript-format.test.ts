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

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DECISION_BRIEF_CONTRACT } from '../../templates/hooks/lib/quality.js';
import { createTemporaryDirectory, removeTemporaryDirectory, writeGateConfig } from '../helpers';
import {
  createEditTranscript,
  createStopHookTicket,
  runStopHook,
  writeSessionState,
} from '../helpers/stop-hook';

// Run the hook directly from the safeword source tree — no runCli(['setup']) needed.
// This matches the pattern used in quality-gates.test.ts.
const FIXTURE_PATH = nodePath.join(import.meta.dirname, '../fixtures/stop-hook-transcript.jsonl');
const REAL_ENVELOPE = {
  isSidechain: false,
  userType: 'external',
  cwd: '/test/project',
  sessionId: 'fixture-session-001',
  version: '2.1.42',
  gitBranch: 'main',
};

// Module-scope helpers — pure (no closure over describe-local state).

function runStopHookDonePhase(directory: string, lastAssistantMessage: string) {
  const transcriptPath = createEditTranscript(directory);
  createStopHookTicket(directory, {
    id: '099',
    slug: 'done-task',
    phase: 'done',
    status: 'in_progress',
  });
  return runStopHook(directory, transcriptPath, undefined, lastAssistantMessage);
}

function assistantToolUseLine(id: string): string {
  return JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'tool_use', name: 'Edit', id }],
    },
  });
}

function assistantTextLine(text: string): string {
  return JSON.stringify({
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text }] },
  });
}

const state: { projectDirectory: string } = { projectDirectory: '' };

beforeEach(() => {
  state.projectDirectory = createTemporaryDirectory();
  writeGateConfig(state.projectDirectory, { stopQualityReview: true });
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
    createStopHookTicket(state.projectDirectory, {
      id: '099',
      slug: 'done-task',
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
    createStopHookTicket(state.projectDirectory, {
      id: '098',
      slug: 'impl-task',
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
    // Simulate hook runtime providing last_assistant_message directly.
    // combinedText reads from this field instead of the transcript.
    const result = runStopHook(
      state.projectDirectory,
      FIXTURE_PATH,
      undefined,
      'Here is what I did: updated the file.',
    );

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
  it('keeps an injected meta message inside the current edited-work turn', () => {
    const transcriptPath = nodePath.join(state.projectDirectory, 'transcript.jsonl');
    writeFileSync(
      transcriptPath,
      [
        JSON.stringify({
          ...REAL_ENVELOPE,
          type: 'assistant',
          uuid: 'assistant-edit',
          message: {
            role: 'assistant',
            content: [{ type: 'tool_use', name: 'Edit', id: 'edit-1' }],
          },
        }),
        JSON.stringify({
          ...REAL_ENVELOPE,
          type: 'user',
          uuid: 'meta-message',
          isMeta: true,
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Base directory for this skill: /test/project' }],
          },
        }),
        JSON.stringify({
          ...REAL_ENVELOPE,
          type: 'assistant',
          uuid: 'assistant-final',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'The hook was updated.' }],
          },
        }),
      ].join('\n'),
    );

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as { decision?: string }).toMatchObject({ decision: 'block' });
  });

  it('reviews conservatively when the current-turn boundary exceeds the record cap', () => {
    const transcriptPath = nodePath.join(state.projectDirectory, 'transcript.jsonl');
    const edit = assistantToolUseLine('edit-before-noise');
    const noise = Array.from({ length: 600 }, (_, index) =>
      JSON.stringify({ type: 'tool_result', index }),
    );
    const finalAssistant = assistantTextLine('No recent edit.');
    writeFileSync(transcriptPath, [edit, ...noise, finalAssistant].join('\n'));

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout.trim())).toMatchObject({ decision: 'block' });
  });

  it('preserves a recent edit inside the bounded current-turn record window', () => {
    const transcriptPath = nodePath.join(state.projectDirectory, 'transcript.jsonl');
    const staleNoise = Array.from({ length: 100 }, (_, index) =>
      JSON.stringify({ type: 'tool_result', index: `stale-${index}` }),
    );
    const edit = assistantToolUseLine('recent-edit');
    const recentNoise = Array.from({ length: 150 }, (_, index) =>
      JSON.stringify({ type: 'tool_result', index: `recent-${index}` }),
    );
    const finalAssistant = assistantTextLine('Edited recently.');
    writeFileSync(transcriptPath, [...staleNoise, edit, ...recentNoise, finalAssistant].join('\n'));

    const result = runStopHook(
      state.projectDirectory,
      transcriptPath,
      undefined,
      'Edited recently.',
    );

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout.trim())).toMatchObject({ decision: 'block' });
  });

  it('bounds current-turn detection before parsing an oversized transcript record', () => {
    const transcriptPath = nodePath.join(state.projectDirectory, 'transcript.jsonl');
    const edit = assistantToolUseLine('edit-before-large-record');
    const finalAssistant = assistantTextLine('No recent edit.');
    writeFileSync(transcriptPath, [edit, 'x'.repeat(300_000), finalAssistant].join('\n'));

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('reviews conservatively when a bounded large-transcript tail has no turn boundary', () => {
    const transcriptPath = nodePath.join(state.projectDirectory, 'transcript.jsonl');
    const edit = assistantToolUseLine('edit-before-large-transcript');
    const noise = Array.from({ length: 20_000 }, (_, index) =>
      JSON.stringify({ type: 'tool_result', index, content: 'x'.repeat(80) }),
    );
    const finalAssistant = assistantTextLine('No recent edit.');
    writeFileSync(transcriptPath, [edit, ...noise, finalAssistant].join('\n'));

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout.trim())).toMatchObject({ decision: 'block' });
  });

  it('retains a complete JSONL record aligned with the bounded-tail start', () => {
    const transcriptPath = nodePath.join(state.projectDirectory, 'transcript.jsonl');
    const alignedEdit = assistantToolUseLine('aligned-edit');
    const finalAssistant = assistantTextLine('Edited at the start of the bounded tail.');
    const tailWithoutPadding = [alignedEdit, '', finalAssistant].join('\n');
    const paddingSize = 256 * 1024 - Buffer.byteLength(tailWithoutPadding);
    expect(paddingSize).toBeGreaterThan(0);
    const alignedTail = [alignedEdit, 'x'.repeat(paddingSize), finalAssistant].join('\n');
    expect(Buffer.byteLength(alignedTail)).toBe(256 * 1024);

    writeFileSync(transcriptPath, `${assistantTextLine('Older record.')}\n${alignedTail}`);

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout.trim())).toMatchObject({ decision: 'block' });
  });

  it('skips the review prompt after a string-form user follow-up', () => {
    const transcriptPath = nodePath.join(state.projectDirectory, 'transcript.jsonl');
    writeFileSync(
      transcriptPath,
      [
        JSON.stringify({
          ...REAL_ENVELOPE,
          type: 'assistant',
          uuid: 'assistant-edit',
          message: {
            role: 'assistant',
            content: [{ type: 'tool_use', name: 'Edit', id: 'edit-1' }],
          },
        }),
        JSON.stringify({
          ...REAL_ENVELOPE,
          type: 'tool_result',
          uuid: 'tool-result',
          message: {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'edit-1', content: 'Updated.' }],
          },
        }),
        JSON.stringify({
          ...REAL_ENVELOPE,
          type: 'user',
          uuid: 'user-follow-up',
          message: { role: 'user', content: 'Explain that in plain English.' },
        }),
        JSON.stringify({
          ...REAL_ENVELOPE,
          type: 'assistant',
          uuid: 'assistant-final',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'It makes the hook quieter.' }],
          },
        }),
      ].join('\n'),
    );

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('keeps a system reminder inside the current edited-work turn', () => {
    const transcriptPath = nodePath.join(state.projectDirectory, 'transcript.jsonl');
    writeFileSync(
      transcriptPath,
      [
        JSON.stringify({
          ...REAL_ENVELOPE,
          type: 'assistant',
          uuid: 'assistant-edit',
          message: {
            role: 'assistant',
            content: [{ type: 'tool_use', name: 'Edit', id: 'edit-1' }],
          },
        }),
        JSON.stringify({
          ...REAL_ENVELOPE,
          type: 'user',
          uuid: 'system-reminder',
          message: {
            role: 'user',
            content: [{ type: 'text', text: '<system-reminder>Task complete.</system-reminder>' }],
          },
        }),
        JSON.stringify({
          ...REAL_ENVELOPE,
          type: 'assistant',
          uuid: 'assistant-final',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'The hook was updated.' }],
          },
        }),
      ].join('\n'),
    );

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as { decision?: string }).toMatchObject({ decision: 'block' });
  });

  it('skips the review prompt after a genuine user follow-up to an earlier edit', () => {
    const transcriptPath = nodePath.join(state.projectDirectory, 'transcript.jsonl');
    writeFileSync(
      transcriptPath,
      [
        JSON.stringify({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'tool_use', name: 'Edit', id: 'edit-1' }],
          },
        }),
        JSON.stringify({
          type: 'user',
          message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'edit-1' }] },
        }),
        JSON.stringify({
          type: 'user',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Explain that in plain English.' }],
          },
        }),
        JSON.stringify({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'It makes the hook quieter.' }],
          },
        }),
      ].join('\n'),
    );

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('treats tag-shaped text typed by the user as a new-turn boundary', () => {
    const transcriptPath = nodePath.join(state.projectDirectory, 'transcript.jsonl');
    writeFileSync(
      transcriptPath,
      [
        assistantToolUseLine('edit-1'),
        JSON.stringify({
          type: 'user',
          message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'edit-1' }] },
        }),
        assistantTextLine('The hook was updated.'),
        JSON.stringify({
          type: 'user',
          message: {
            role: 'user',
            content: [
              { type: 'text', text: '<system-reminder>Explain this markup.</system-reminder>' },
            ],
          },
        }),
        assistantTextLine('That is an XML-like reminder block.'),
      ].join('\n'),
    );

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('skips the review prompt when the user follow-up leads with a system reminder', () => {
    // The harness prepends reminder blocks to a real prompt (SessionStart
    // project instructions, UserPromptSubmit hook output). The turn boundary
    // must still be found, or the scan reaches into the previous turn and
    // demands a review for a turn that edited nothing.
    const transcriptPath = nodePath.join(state.projectDirectory, 'transcript.jsonl');
    writeFileSync(
      transcriptPath,
      [
        JSON.stringify({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'tool_use', name: 'Edit', id: 'edit-1' }],
          },
        }),
        JSON.stringify({
          type: 'user',
          message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'edit-1' }] },
        }),
        JSON.stringify({
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '<system-reminder>\nProject instructions.\n</system-reminder>',
              },
              { type: 'text', text: 'Explain that in plain English.' },
            ],
          },
        }),
        JSON.stringify({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'It makes the hook quieter.' }],
          },
        }),
      ].join('\n'),
    );

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it.each(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])(
    'still reviews a turn with %s when its tool result carries a trailing note (S0RYNS)',
    editToolName => {
      // A user message may legally carry text blocks after its tool_result blocks,
      // and the harness uses that to append notes to tool output. Those notes are
      // not a human prompt: reading one as a turn start ends the turn early and
      // skips the review on a turn that did edit files.
      const transcriptPath = nodePath.join(state.projectDirectory, 'transcript.jsonl');
      writeFileSync(
        transcriptPath,
        [
          JSON.stringify({
            type: 'user',
            message: { role: 'user', content: [{ type: 'text', text: 'Refactor the parser.' }] },
          }),
          JSON.stringify({
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [{ type: 'tool_use', name: editToolName, id: 'edit-1' }],
            },
          }),
          JSON.stringify({
            type: 'user',
            message: {
              role: 'user',
              content: [
                { type: 'tool_result', tool_use_id: 'edit-1' },
                { type: 'text', text: 'Shell cwd was reset to /home/user/project' },
              ],
            },
          }),
          JSON.stringify({
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: 'Parser refactored.' }],
            },
          }),
        ].join('\n'),
      );

      const result = runStopHook(state.projectDirectory, transcriptPath);

      expect(result.status).toBe(0);
      const block = JSON.parse(result.stdout.trim()) as { decision?: string; reason?: string };
      expect(block.decision).toBe('block');
      expect(block.reason).toMatch(/quality review|\*\*CONFIDENT\*\*/i);
      expect(block.reason).not.toMatch(/verify\.md/i);
    },
  );

  it('skips the review prompt when the user follow-up leads with a task notification', () => {
    const transcriptPath = nodePath.join(state.projectDirectory, 'transcript.jsonl');
    writeFileSync(
      transcriptPath,
      [
        JSON.stringify({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'tool_use', name: 'Edit', id: 'edit-1' }],
          },
        }),
        JSON.stringify({
          type: 'user',
          message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'edit-1' }] },
        }),
        JSON.stringify({
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '<task-notification>Background task completed.</task-notification>',
              },
              { type: 'text', text: 'Explain that in plain English.' },
            ],
          },
        }),
        JSON.stringify({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'It makes the hook quieter.' }],
          },
        }),
      ].join('\n'),
    );

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('shows quality review when active ticket at implement phase', () => {
    createStopHookTicket(state.projectDirectory, {
      id: '099',
      slug: 'test',
      phase: 'implement',
      status: 'in_progress',
    });
    const transcriptPath = createEditTranscript(state.projectDirectory);
    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    // Should soft-block with quality review (edits were made)
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toMatch(/\*\*CONFIDENT\*\*|decision brief/i);
  });

  it('corrects a generic reply without repeating the full contract or inventing an implementation phase', () => {
    // No ticket created — just .safeword/ dir (from beforeEach)
    const transcriptPath = createEditTranscript(state.projectDirectory);
    const result = runStopHook(
      state.projectDirectory,
      transcriptPath,
      undefined,
      'Defined the upload scope and checked its edge cases.',
    );

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toContain('no recognized verdict');
    expect(parsed.reason).toContain('**CONFIDENT**');
    expect(parsed.reason).toContain('**BLOCKED**');
    expect(parsed.reason).toContain('what changed, what was checked, and the concrete result');
    expect(parsed.reason).not.toContain('Apply SAFEWORD.md');
    expect(parsed.reason).not.toContain('Phase: implement');
    expect(parsed.reason.length).toBeLessThan(DECISION_BRIEF_CONTRACT.length);
  });

  it('rejects prototype property names as verdicts without crashing', () => {
    const transcriptPath = createEditTranscript(state.projectDirectory);
    const result = runStopHook(
      state.projectDirectory,
      transcriptPath,
      undefined,
      '**toString** — Looks plausible.',
    );

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout.trim()) as { decision?: string; reason?: string };
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toContain('no recognized verdict');
  });

  it('uses the active phase evidence and only the recognized verdict shape', () => {
    createStopHookTicket(state.projectDirectory, {
      id: '099',
      slug: 'define-upload-behavior',
      phase: 'define-behavior',
      status: 'in_progress',
    });
    writeSessionState(state.projectDirectory, 'test-session', { activeTicket: '099' });
    const transcriptPath = createEditTranscript(state.projectDirectory);
    const result = runStopHook(
      state.projectDirectory,
      transcriptPath,
      'test-session',
      [
        '**CONFIDENT** — The scenarios are ready.',
        '',
        '**Open:** none.',
        '',
        '**Decided:** Cover valid and malformed uploads.',
        '',
        '**Next:** Review the scenarios.',
      ].join('\n'),
    );

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout.trim()) as { decision?: string; reason?: string };
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toContain('CONFIDENT has missing, extra, or out-of-order');
    expect(parsed.reason).toContain('Phase: define-behavior');
    expect(parsed.reason).toContain('**CONFIDENT**');
    expect(parsed.reason).not.toContain('**BLOCKED**');
  });

  it('keeps the full review contract when a disqualification requires reconsideration', () => {
    writeSessionState(state.projectDirectory, 'test-session', {
      learningsNudgesPending: ['novel-claim.md'],
    });
    const transcriptPath = createEditTranscript(state.projectDirectory);
    const result = runStopHook(
      state.projectDirectory,
      transcriptPath,
      'test-session',
      'Defined the upload scope.',
    );

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout.trim()) as { decision?: string; reason?: string };
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toContain('Apply SAFEWORD.md');
    expect(parsed.reason).toContain('Novel-claim nudge pending');
  });

  it('shows done-phase hard block when active ticket at done phase', () => {
    createStopHookTicket(state.projectDirectory, {
      id: '099',
      slug: 'test',
      phase: 'done',
      status: 'in_progress',
    });
    const transcriptPath = createEditTranscript(state.projectDirectory);
    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    // Should hard-block requiring evidence (done phase)
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toMatch(/evidence|verify/i);
  });

  it('uses session binding when session_id and state file exist', () => {
    // Create two tickets — session is bound to 099
    createStopHookTicket(state.projectDirectory, {
      id: '099',
      slug: 'session-ticket',
      phase: 'implement',
      status: 'in_progress',
    });
    createStopHookTicket(state.projectDirectory, {
      id: '100',
      slug: 'other-ticket',
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

    const transcriptPath = createEditTranscript(state.projectDirectory);
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
    createStopHookTicket(state.projectDirectory, {
      id: '099',
      slug: 'done-ticket',
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

    const transcriptPath = createEditTranscript(state.projectDirectory);
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
