/**
 * Integration coverage for the Claude Stop-hook generic-review quiet period
 * (issue #1492). These tests use real hook processes, a real transcript, and
 * a real session state file.
 */

import { mkdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory, writeGateConfig } from '../helpers';
import {
  createEditTranscript,
  createStopHookTicket,
  runPromptQuestionsHook,
  runStopHook,
  stateFilePath,
  writeSessionState,
} from '../helpers/stop-hook';

describe('Stop Hook: Idle Review Suppression (1492)', () => {
  let projectDirectory = '';

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
    writeGateConfig(projectDirectory, { stopQualityReview: true });
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('persists the first generic review without a seeded state file, then silences the idle repeat', () => {
    const sessionId = 'idle-stop-session';
    const transcriptPath = createEditTranscript(projectDirectory);

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
    const transcriptPath = createEditTranscript(projectDirectory);

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
    createStopHookTicket(projectDirectory, {
      id: '099',
      slug: 'done-task',
      phase: 'done',
      status: 'in_progress',
    });
    writeSessionState(projectDirectory, sessionId, {
      activeTicket: '099',
      stopQualityReviewAwaitingUserPrompt: true,
    });

    const result = runStopHook(projectDirectory, createEditTranscript(projectDirectory), sessionId);

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout.trim()) as { decision?: string; reason?: string };
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toMatch(/verify/i);
  });
});
