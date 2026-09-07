/**
 * Long agentic turns must still get their Stop quality review (ticket V8Z1NP).
 *
 * `detectEditToolsUsedInCurrentUserTurn` walks back looking for the user-prompt
 * boundary but gave up after MAX_MESSAGES_FOR_TOOLS assistant messages. On any
 * turn longer than that window the boundary is never found, the caller falls
 * back to a turn-blind scan of the same short window, and an edit made earlier
 * in the very same turn becomes invisible — the review is skipped on exactly
 * the largest turns.
 *
 * The silent cases below are load-bearing: without them, an implementation that
 * simply always reports "edits happened" would satisfy the firing cases.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory, writeGateConfig } from '../helpers';
import { createStopHookTicket, runStopHook } from '../helpers/stop-hook';

const state: { projectDirectory: string } = { projectDirectory: '' };

beforeEach(() => {
  state.projectDirectory = createTemporaryDirectory();
  writeGateConfig(state.projectDirectory, { stopQualityReview: true });
  mkdirSync(nodePath.join(state.projectDirectory, '.safeword'), { recursive: true });
  createStopHookTicket(state.projectDirectory, {
    id: '099',
    slug: 'long-turn',
    phase: 'implement',
    status: 'in_progress',
  });
});

afterEach(() => {
  removeTemporaryDirectory(state.projectDirectory);
});

function userPrompt(text: string): string {
  return JSON.stringify({
    type: 'user',
    message: { role: 'user', content: [{ type: 'text', text }] },
  });
}

function assistantToolUse(name: string, id: string): string {
  return JSON.stringify({
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'tool_use', name, id }] },
  });
}

function toolResult(id: string): string {
  return JSON.stringify({
    type: 'user',
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id }] },
  });
}

function assistantText(text: string): string {
  return JSON.stringify({
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text }] },
  });
}

/** `count` non-edit tool rounds, each an assistant tool_use plus its result. */
function bashRounds(count: number, prefix: string): string[] {
  return Array.from({ length: count }, (_unused, i) => [
    assistantToolUse('Bash', `${prefix}-${i}`),
    toolResult(`${prefix}-${i}`),
  ]).flat();
}

function writeTranscript(directory: string, lines: string[]): string {
  const transcriptPath = nodePath.join(directory, 'transcript.jsonl');
  writeFileSync(transcriptPath, lines.join('\n'));
  return transcriptPath;
}

/** One user turn whose edit is followed by `followUpToolCalls` non-edit rounds. */
function editThenToolCalls(followUpToolCalls: number): string[] {
  return [
    userPrompt('Refactor the parser and check it still builds.'),
    assistantToolUse('Edit', 'edit-1'),
    toolResult('edit-1'),
    ...bashRounds(followUpToolCalls, 'bash'),
    assistantText('Done — parser refactored and the build is clean.'),
  ];
}

function parseBlock(stdout: string): { decision?: string; reason?: string } {
  return JSON.parse(stdout.trim()) as { decision?: string; reason?: string };
}

describe('Stop review on long agentic turns (V8Z1NP)', () => {
  it('reviews a short edit turn — control, edit inside the old scan window', () => {
    const transcriptPath = writeTranscript(state.projectDirectory, editThenToolCalls(1));

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    const block = parseBlock(result.stdout);
    expect(block.decision).toBe('block');
    expect(block.reason).toContain('implement');
  });

  it('reviews a long edit turn — the edit is pushed out of the old scan window', () => {
    const transcriptPath = writeTranscript(state.projectDirectory, editThenToolCalls(12));

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    const block = parseBlock(result.stdout);
    expect(block.decision).toBe('block');
    expect(block.reason).toContain('implement');
  });

  it('reviews an edit turn longer than the former 400-line boundary cap', () => {
    const transcriptPath = writeTranscript(state.projectDirectory, editThenToolCalls(220));

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    const block = parseBlock(result.stdout);
    expect(block.decision).toBe('block');
    expect(block.reason).toContain('implement');
  });

  it('stays silent on a long turn that edited nothing', () => {
    const transcriptPath = writeTranscript(state.projectDirectory, [
      userPrompt('Walk me through how the parser resolves precedence.'),
      ...bashRounds(12, 'read'),
      assistantText('Precedence is resolved by the climbing loop in parse_expr.'),
    ]);

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('stays silent on a non-edit turn longer than the former 400-line boundary cap', () => {
    const transcriptPath = writeTranscript(state.projectDirectory, [
      userPrompt('Walk me through how the parser resolves precedence.'),
      ...bashRounds(220, 'read'),
      assistantText('Precedence is resolved by the climbing loop in parse_expr.'),
    ]);

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('stays silent on a background-notification turn whose own work edited nothing', () => {
    // A `<task-notification>` re-invokes the agent, so it starts a new turn.
    // Widening the boundary walk without treating it as one made the review
    // reach past it to the previous turn's edit and demand a decision brief
    // for a status check — the #1431 false positive.
    const transcriptPath = writeTranscript(state.projectDirectory, [
      userPrompt('Refactor the parser.'),
      assistantToolUse('Edit', 'edit-1'),
      toolResult('edit-1'),
      assistantText('Refactored; suite running in the background.'),
      userPrompt('<task-notification>\n<task-id>abc</task-id>\n</task-notification>'),
      ...bashRounds(8, 'poll'),
      assistantText('Suite finished: 1468/1468 green.'),
    ]);

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('keeps a system reminder inside the turn — it rides along, it does not start one', () => {
    // The mirror of the case above: unlike a task-notification, a
    // `<system-reminder>` is injected mid-turn, so the edit before it is still
    // this turn's work and must still be reviewed.
    const transcriptPath = writeTranscript(state.projectDirectory, [
      userPrompt('Refactor the parser.'),
      assistantToolUse('Edit', 'edit-1'),
      toolResult('edit-1'),
      JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'text', text: '<system-reminder>Task complete.</system-reminder>' }],
        },
      }),
      ...bashRounds(8, 'check'),
      assistantText('Parser refactored and verified.'),
    ]);

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    const block = parseBlock(result.stdout);
    expect(block.decision).toBe('block');
    expect(block.reason).toContain('implement');
  });

  it('stays silent when only a previous turn edited, however long this turn runs', () => {
    const transcriptPath = writeTranscript(state.projectDirectory, [
      userPrompt('Refactor the parser.'),
      assistantToolUse('Edit', 'edit-1'),
      toolResult('edit-1'),
      assistantText('Parser refactored.'),
      userPrompt('Thanks — now just explain what it does.'),
      ...bashRounds(12, 'read'),
      assistantText('It resolves precedence by climbing.'),
    ]);

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});
