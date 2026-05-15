/**
 * Integration: skill-invocation gate end-to-end (147)
 *
 * Exercises the wired path: stop-quality.ts hard-blocks feature done-phase
 * when /verify and /audit log entries are missing in the current session.
 */

import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  initGitRepo,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers.js';

let projectDirectory: string;

beforeAll(async () => {
  projectDirectory = createTemporaryDirectory();
  createTypeScriptPackageJson(projectDirectory);
  initGitRepo(projectDirectory);
  await runCli(['setup', '--yes'], { cwd: projectDirectory });
});

afterAll(() => {
  if (projectDirectory) removeTemporaryDirectory(projectDirectory);
});

function writeFeatureTicketAtDone(directory: string, ticketId: string): void {
  const folder = `.safeword-project/tickets/${ticketId}`;
  execSync(`mkdir -p "${directory}/${folder}"`, { cwd: directory });
  writeTestFile(
    directory,
    `${folder}/ticket.md`,
    `---\nid: ${ticketId}\ntype: feature\nphase: done\nstatus: in_progress\nlast_modified: 2026-01-06T10:00:00Z\n---\n# Test\n`,
  );
  writeTestFile(
    directory,
    `${folder}/test-definitions.md`,
    '# Test Definitions\n\n## Rule: Test rule\n\n- [x] Scenario one\n',
  );
  writeTestFile(
    directory,
    `${folder}/verify.md`,
    'Verified: 2026-01-06\n\n## Verify Checklist\n\n**Test Suite:** ✓ 1/1 tests pass\n',
  );
}

function writeSkillLog(directory: string, entries: string[]): void {
  const safewordDirectory = nodePath.join(directory, '.safeword-project');
  mkdirSync(safewordDirectory, { recursive: true });
  writeFileSync(
    nodePath.join(safewordDirectory, 'skill-invocations.log'),
    entries.length > 0 ? `${entries.join('\n')}\n` : '',
  );
}

function runStopHookWithSession(
  targetDirectory: string,
  sessionId: string,
): { exitCode: number; reason: string } {
  const transcriptPath = nodePath.join(targetDirectory, 'transcript.jsonl');
  writeFileSync(
    transcriptPath,
    `${JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'done' },
          { type: 'tool_use', name: 'Edit' },
        ],
      },
    })}\n`,
  );
  const result = spawnSync('bun', ['.safeword/hooks/stop-quality.ts'], {
    input: JSON.stringify({
      transcript_path: transcriptPath,
      session_id: sessionId,
    }),
    cwd: targetDirectory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: targetDirectory },
    encoding: 'utf8',
  });
  const exitCode = result.status ?? 0;
  try {
    const parsed = JSON.parse(result.stdout.trim());
    return { exitCode, reason: parsed.reason ?? '' };
  } catch {
    return { exitCode, reason: '' };
  }
}

describe('skill-invocation gate: end-to-end (147)', () => {
  it('feature done blocks when /verify and /audit log entries are missing in this session', () => {
    writeFeatureTicketAtDone(projectDirectory, '901');
    writeSkillLog(projectDirectory, []);

    const result = runStopHookWithSession(projectDirectory, 'session-901');

    expect(result.exitCode).toBe(0);
    expect(result.reason).toContain('/verify');
    expect(result.reason).toContain('/audit');
    expect(result.reason.toLowerCase()).toContain('missing');
  });

  it('feature done blocks with only /audit missing', () => {
    writeFeatureTicketAtDone(projectDirectory, '902');
    writeSkillLog(projectDirectory, ['2026-05-15T00:00:00Z session-902 verify']);

    const result = runStopHookWithSession(projectDirectory, 'session-902');

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

    const result = runStopHookWithSession(projectDirectory, 'session-903');

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

    const result = runStopHookWithSession(projectDirectory, 'session-904');

    expect(result.exitCode).toBe(0);
    expect(result.reason).toContain('/verify');
    expect(result.reason).toContain('/audit');
  });
});
