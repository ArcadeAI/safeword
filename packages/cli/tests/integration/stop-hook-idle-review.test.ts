/**
 * Integration coverage for the Claude Stop-hook generic-review quiet period
 * (issue #1492). These tests use real hook processes, a real transcript, and
 * a real session state file.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory, TIMEOUT_QUICK } from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const STOP_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/stop-quality.ts');
const PROMPT_QUESTIONS = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/prompt-questions.ts');

function stateFilePath(directory: string, sessionId: string): string {
  return nodePath.join(directory, '.project', `quality-state-${sessionId}.json`);
}

function createTranscript(directory: string): string {
  const transcriptPath = nodePath.join(directory, 'transcript.jsonl');
  writeFileSync(
    transcriptPath,
    JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Edit', id: 'toolu_1' }],
      },
    }),
  );
  return transcriptPath;
}

function createTicket(directory: string): void {
  const ticketFolder = nodePath.join(directory, '.project', 'tickets', '099-done-task');
  mkdirSync(ticketFolder, { recursive: true });
  writeFileSync(
    nodePath.join(ticketFolder, 'ticket.md'),
    ['---', 'id: 099', 'status: in_progress', 'type: task', 'phase: done', '---'].join('\n'),
  );
}

function writeSessionState(
  directory: string,
  sessionId: string,
  state: Record<string, unknown>,
): void {
  const statePath = stateFilePath(directory, sessionId);
  mkdirSync(nodePath.dirname(statePath), { recursive: true });
  // eslint-disable-next-line unicorn/no-null -- JSON.stringify replacer parameter
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function runStopHook(directory: string, transcriptPath: string, sessionId: string) {
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

function runPromptQuestionsHook(directory: string, sessionId: string) {
  return spawnSync('bun', [PROMPT_QUESTIONS], {
    input: JSON.stringify({ session_id: sessionId, prompt: 'Continue with the next change.' }),
    cwd: directory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

describe('Stop Hook: Idle Review Suppression (1492)', () => {
  let projectDirectory = '';

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('persists the first generic review without a seeded state file, then silences the idle repeat', () => {
    const sessionId = 'idle-stop-session';
    const transcriptPath = createTranscript(projectDirectory);

    const first = runStopHook(projectDirectory, transcriptPath, sessionId);

    expect(first.status).toBe(0);
    expect(JSON.parse(first.stdout) as { decision?: string }).toMatchObject({ decision: 'block' });
    const statePath = stateFilePath(projectDirectory, sessionId);
    const persistedState = JSON.parse(readFileSync(statePath, 'utf8'));
    expect(persistedState).toMatchObject({
      stopQualityReviewAwaitingUserPrompt: true,
    });

    const idleRepeat = runStopHook(projectDirectory, transcriptPath, sessionId);

    expect(idleRepeat.status).toBe(0);
    expect(idleRepeat.stdout.trim()).toBe('');
  });

  it('re-arms generic review after UserPromptSubmit', () => {
    const sessionId = 'rearm-stop-session';
    const transcriptPath = createTranscript(projectDirectory);

    const first = runStopHook(projectDirectory, transcriptPath, sessionId);
    expect(JSON.parse(first.stdout) as { decision?: string }).toMatchObject({ decision: 'block' });

    const prompt = runPromptQuestionsHook(projectDirectory, sessionId);
    expect(prompt.status).toBe(0);
    const statePath = stateFilePath(projectDirectory, sessionId);
    const persistedState = JSON.parse(readFileSync(statePath, 'utf8'));
    expect(persistedState).toMatchObject({
      stopQualityReviewAwaitingUserPrompt: false,
    });

    const nextTurn = runStopHook(projectDirectory, transcriptPath, sessionId);
    expect(nextTurn.status).toBe(0);
    expect(JSON.parse(nextTurn.stdout) as { decision?: string }).toMatchObject({
      decision: 'block',
    });
  });

  it('does not let an idle-review marker bypass the done-phase verify gate', () => {
    const sessionId = 'done-gate-session';
    createTicket(projectDirectory);
    writeSessionState(projectDirectory, sessionId, {
      activeTicket: '099',
      stopQualityReviewAwaitingUserPrompt: true,
    });

    const result = runStopHook(projectDirectory, createTranscript(projectDirectory), sessionId);

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout.trim()) as { decision?: string; reason?: string };
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toMatch(/verify/i);
  });
});
