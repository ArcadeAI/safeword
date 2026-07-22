/**
 * Integration coverage for the Claude Code Stop hook's decision-brief response
 * recognition. This drives the installed dogfood hook with its real JSON stdin
 * and a recent edit transcript, asserting only the observable stdout contract.
 */

import { execSync, spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  initGitRepo,
  removeTemporaryDirectory,
  writeTestFile,
} from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const STOP_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/stop-quality.ts');

const COMPLETE_CONFIDENT = `**CONFIDENT** — The change is ready.

**Decided:** Added the requested behavior.

**Open:** none.

**Next:** Review the change.`;

const COMPLETE_BLOCKED = `**BLOCKED** — The required service behavior is unknown.

**Tried:** Read the current hook contract.

**Need:** A decision about the desired behavior.`;

const INCOMPLETE_CONFIDENT = `**CONFIDENT** — The change is ready.

**Decided:** Added the requested behavior.

**Open:** none.`;

function buildProject(): string {
  const projectDirectory = createTemporaryDirectory();
  initGitRepo(projectDirectory);
  writeTestFile(projectDirectory, '.safeword/.gitkeep', '');
  writeTestFile(
    projectDirectory,
    'transcript.jsonl',
    JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Edit', id: 'toolu_1' }] },
    }),
  );
  execSync('git add . && git commit -qm baseline', { cwd: projectDirectory, stdio: 'pipe' });
  return projectDirectory;
}

function runStop(projectDirectory: string, lastAssistantMessage: string, sessionId?: string) {
  return spawnSync('bun', [STOP_QUALITY], {
    input: JSON.stringify({
      session_id: sessionId,
      transcript_path: nodePath.join(projectDirectory, 'transcript.jsonl'),
      last_assistant_message: lastAssistantMessage,
      stop_hook_active: false,
    }),
    cwd: projectDirectory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
    encoding: 'utf8',
    timeout: 60_000,
  });
}

function writeDoneTicket(projectDirectory: string): void {
  writeTestFile(
    projectDirectory,
    '.project/tickets/099-done/ticket.md',
    ['---', 'id: 099', 'status: in_progress', 'type: task', 'phase: done', '---'].join('\n'),
  );
}

function writeDisqualifiedImplementSession(projectDirectory: string): void {
  writeTestFile(
    projectDirectory,
    '.project/tickets/099-implement/ticket.md',
    ['---', 'id: 099', 'status: in_progress', 'type: task', 'phase: implement', '---'].join('\n'),
  );
  writeTestFile(
    projectDirectory,
    '.project/quality-state-test-session.json',
    JSON.stringify({
      activeTicket: '099',
      gate: undefined,
      incrementedPatterns: [],
      lastCommitHash: '',
      locSinceCommit: 0,
      recentFailures: [{ pattern: 'loc-exceeded', timestamp: '2026-07-22T00:00:00.000Z' }],
    }),
  );
}

describe('Stop Hook: complete decision brief recognition (P0D33P)', () => {
  let projectDirectory = '';

  afterEach(() => {
    if (projectDirectory) removeTemporaryDirectory(projectDirectory);
    projectDirectory = '';
  });

  it('allows a later ordinary edited-work stop with a complete CONFIDENT brief', () => {
    projectDirectory = buildProject();

    const result = runStop(projectDirectory, COMPLETE_CONFIDENT);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('allows a later ordinary edited-work stop with a complete BLOCKED brief', () => {
    projectDirectory = buildProject();

    const result = runStop(projectDirectory, COMPLETE_BLOCKED);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('keeps the existing quality continuation for a CONFIDENT brief missing Next', () => {
    projectDirectory = buildProject();

    const result = runStop(projectDirectory, INCOMPLETE_CONFIDENT);

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout) as { decision?: string; reason?: string };
    expect(output.decision).toBe('block');
    expect(output.reason).toContain('**Next:**');
  });

  it('keeps the done-gate block ahead of a complete CONFIDENT brief', () => {
    projectDirectory = buildProject();
    writeDoneTicket(projectDirectory);

    const result = runStop(projectDirectory, COMPLETE_CONFIDENT);

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout) as { decision?: string; reason?: string };
    expect(output.decision).toBe('block');
    expect(output.reason).toMatch(/verify/i);
  });

  it('keeps a phase-relevant disqualification ahead of a complete CONFIDENT brief', () => {
    projectDirectory = buildProject();
    writeDisqualifiedImplementSession(projectDirectory);

    const result = runStop(projectDirectory, COMPLETE_CONFIDENT, 'test-session');

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout) as { decision?: string; reason?: string };
    expect(output.decision).toBe('block');
    expect(output.reason).toContain('loc-exceeded');
  });
});
