/**
 * Integration: skill-invocation gate end-to-end (147)
 *
 * Exercises the wired path: stop-quality.ts hard-blocks feature done-phase
 * when /verify and /audit log entries are missing in the current session.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  initGitRepo,
  removeTemporaryDirectory,
  setupOrThrow,
} from '../helpers.js';
import { runDoneGate, writeFeatureTicketAtDone } from './done-gate-harness.js';

function writeSkillLog(directory: string, entries: string[]): void {
  const safewordDirectory = nodePath.join(directory, '.project');
  mkdirSync(safewordDirectory, { recursive: true });
  writeFileSync(
    nodePath.join(safewordDirectory, 'skill-invocations.log'),
    entries.length > 0 ? `${entries.join('\n')}\n` : '',
  );
}

describe('skill-invocation gate: end-to-end (147)', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createTypeScriptPackageJson(projectDirectory);
    initGitRepo(projectDirectory);
    await setupOrThrow(projectDirectory);
  });

  afterAll(() => {
    if (projectDirectory) removeTemporaryDirectory(projectDirectory);
  });

  it('feature done blocks when /verify and /audit log entries are missing in this session', () => {
    writeFeatureTicketAtDone(projectDirectory, '901');
    writeSkillLog(projectDirectory, []);

    const result = runDoneGate(projectDirectory, 'session-901');

    expect(result.exitCode).toBe(0);
    expect(result.reason).toContain('/verify');
    expect(result.reason).toContain('/audit');
    expect(result.reason.toLowerCase()).toContain('missing');
    expect(result.reason).toContain('session-scoped proof');
    expect(result.reason).not.toContain('CLAUDE_SESSION_ID');
  });

  it('feature done blocks with only /audit missing', () => {
    writeFeatureTicketAtDone(projectDirectory, '902');
    writeSkillLog(projectDirectory, ['2026-05-15T00:00:00Z session-902 verify']);

    const result = runDoneGate(projectDirectory, 'session-902');

    expect(result.exitCode).toBe(0);
    expect(result.reason).toContain('/audit');
    expect(result.reason).not.toMatch(/Run \/verify/);
  });

  it('feature done passes (skill gate) when both /verify and /audit logged in this session', () => {
    writeFeatureTicketAtDone(projectDirectory, '903');
    writeSkillLog(projectDirectory, [
      '2026-05-15T00:00:00Z session-903 verify',
      '2026-05-15T00:00:01Z session-903 audit',
    ]);

    const result = runDoneGate(projectDirectory, 'session-903');

    // The skill gate passed; whether downstream gates also pass depends on
    // other ticket state. Asserting only on the skill-gate message absence.
    expect(result.reason).not.toMatch(/Required skill invocation/);
  });

  it('feature done with only OTHER session entries still blocks', () => {
    writeFeatureTicketAtDone(projectDirectory, '904');
    writeSkillLog(projectDirectory, [
      '2026-05-15T00:00:00Z some-other-session verify',
      '2026-05-15T00:00:01Z some-other-session audit',
    ]);

    const result = runDoneGate(projectDirectory, 'session-904');

    expect(result.exitCode).toBe(0);
    expect(result.reason).toContain('/verify');
    expect(result.reason).toContain('/audit');
  });
});
