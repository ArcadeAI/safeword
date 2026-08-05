/**
 * Long agentic turns must still get their Stop quality review (ticket V8Z1NP).
 *
 * `detectEditToolsUsedInCurrentUserTurn` walks back looking for the user-prompt
 * boundary but gives up after MAX_MESSAGES_FOR_TOOLS assistant messages. On any
 * turn longer than that window the boundary is never found, the caller falls
 * back to a turn-blind scan of the same short window, and an edit made earlier
 * in the very same turn becomes invisible — the review is skipped on exactly
 * the largest turns.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers';
import { createStopHookTicket, runStopHook } from '../helpers/stop-hook';

const state: { projectDirectory: string } = { projectDirectory: '' };

beforeEach(() => {
  state.projectDirectory = createTemporaryDirectory();
  mkdirSync(nodePath.join(state.projectDirectory, '.safeword'), { recursive: true });
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

function assistantEdit(id: string): string {
  return JSON.stringify({
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Edit', id }] },
  });
}

function assistantBash(id: string): string {
  return JSON.stringify({
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', id }] },
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

/**
 * One user turn: the edit lands first, then `followUpToolCalls` non-edit tool
 * rounds push it outside the short scan window before the turn's final reply.
 */
function writeLongEditTurn(directory: string, followUpToolCalls: number): string {
  const transcriptPath = nodePath.join(directory, 'transcript.jsonl');
  const followUps = Array.from({ length: followUpToolCalls }, (_unused, i) => [
    assistantBash(`bash-${i}`),
    toolResult(`bash-${i}`),
  ]).flat();

  const lines = [
    userPrompt('Refactor the parser and check it still builds.'),
    assistantEdit('edit-1'),
    toolResult('edit-1'),
    ...followUps,
    assistantText('Done — parser refactored and the build is clean.'),
  ];

  writeFileSync(transcriptPath, lines.join('\n'));
  return transcriptPath;
}

describe('Stop review on long agentic turns (V8Z1NP)', () => {
  it('reviews a short edit turn (control — edit inside the scan window)', () => {
    createStopHookTicket(state.projectDirectory, {
      id: '099',
      slug: 'long-turn',
      phase: 'implement',
      status: 'in_progress',
    });
    const transcriptPath = writeLongEditTurn(state.projectDirectory, 1);

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).not.toBe('');
  });

  it('still reviews when the edit is pushed out of the scan window by tool calls', () => {
    createStopHookTicket(state.projectDirectory, {
      id: '099',
      slug: 'long-turn',
      phase: 'implement',
      status: 'in_progress',
    });
    const transcriptPath = writeLongEditTurn(state.projectDirectory, 12);

    const result = runStopHook(state.projectDirectory, transcriptPath);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).not.toBe('');
  });
});
