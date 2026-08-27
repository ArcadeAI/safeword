/**
 * Integration: status-close done-gate sidestep (ticket 2JMQMX)
 *
 * Proves the wired path: a feature ticket flipped to `status: done` while
 * `phase` stays `intake` is still routed into the done-gate (via
 * resolveStopPhase surfacing phase:'done' on the session-scoped path), so a
 * missing verify.md hard-blocks the stop — the sidestep no longer escapes.
 */

import { execSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  initGitRepo,
  INSTALL_DEPENDENCIES_ENV,
  removeTemporaryDirectory,
  setupOrThrow,
  writeTestFile,
} from '../helpers.js';

const fixture: { projectDirectory: string } = { projectDirectory: '' };

beforeAll(async () => {
  fixture.projectDirectory = createTemporaryDirectory();
  createTypeScriptPackageJson(fixture.projectDirectory);
  initGitRepo(fixture.projectDirectory);
  await setupOrThrow(fixture.projectDirectory, ['setup', '--yes'], {
    env: INSTALL_DEPENDENCIES_ENV,
  });
});

afterAll(() => {
  if (fixture.projectDirectory) removeTemporaryDirectory(fixture.projectDirectory);
});

/** A feature closed by the sidestep: status:done but phase still intake, with
 * complete scenarios and (deliberately) NO verify.md. */
function writeFeatureClosedByStatus(directory: string, ticketId: string): void {
  const folder = `.project/tickets/${ticketId}`;
  execSync(`mkdir -p "${directory}/${folder}"`, { cwd: directory });
  writeTestFile(
    directory,
    `${folder}/ticket.md`,
    `---\nid: ${ticketId}\ntype: feature\nphase: intake\nstatus: done\nlast_modified: 2026-01-06T10:00:00Z\n---\n# Test\n`,
  );
  writeTestFile(
    directory,
    `${folder}/test-definitions.md`,
    '# Test Definitions\n\n## Rule: Test rule\n\n- [x] Scenario one\n',
  );
}

function writeWipFeatureClosedByStatus(directory: string, ticketId: string): void {
  writeFeatureClosedByStatus(directory, ticketId);
  const folder = `.project/tickets/${ticketId}`;
  writeTestFile(
    directory,
    `${folder}/test-definitions.md`,
    `Feature source: \`features/${ticketId}.feature\`.\n\n## Rule: Test rule\n\n- [x] Scenario one\n`,
  );
  writeTestFile(
    directory,
    `${folder}/verify.md`,
    '# Verify\n\n**PR Scope:** ✅ Diff matches ticket scope\n',
  );
  writeTestFile(
    directory,
    `features/${ticketId}.feature`,
    '@wip\nFeature: Test\n\n  Scenario: one\n    Given it works\n',
  );
}

/** Bind the session's active ticket so the session-scoped resolution path runs
 * (the sidestep only drops the ticket from the global in_progress scan). */
function writeSessionState(directory: string, sessionId: string, ticketId: string): void {
  writeFileSync(
    nodePath.join(directory, '.project', `quality-state-${sessionId}.json`),
    JSON.stringify({ activeTicket: ticketId }),
  );
}

function runStopHook(
  targetDirectory: string,
  sessionId: string,
  stopHookActive = false,
): { reason: string; systemMessage: string } {
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
      stop_hook_active: stopHookActive,
    }),
    cwd: targetDirectory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: targetDirectory },
    encoding: 'utf8',
  });
  try {
    const parsed = JSON.parse(result.stdout.trim());
    return { reason: parsed.reason ?? '', systemMessage: parsed.systemMessage ?? '' };
  } catch {
    return { reason: '', systemMessage: '' };
  }
}

describe('status-close done-gate (2JMQMX)', () => {
  it('blocks a feature closed by status:done with no verify.md', () => {
    writeFeatureClosedByStatus(fixture.projectDirectory, '910');
    writeSessionState(fixture.projectDirectory, 'session-910', '910');

    const result = runStopHook(fixture.projectDirectory, 'session-910');

    // The surfaced phase:'done' reached the real done-gate, which blocked on the
    // missing evidence — the sidestep is closed.
    expect(result.reason.toLowerCase()).toContain('verify.md');
    // ZCYD5P: the done-gate block also points to /explain.
    expect(result.reason).toContain('Run `/explain` for a plain-English version');
    // 19E2XQ: the hint also rides systemMessage (the user-facing field).
    expect(result.systemMessage).toContain('Run `/explain` for a plain-English version');
  });

  it('blocks a feature closed by status:done while its Gherkin source is @wip', () => {
    writeWipFeatureClosedByStatus(fixture.projectDirectory, '911');
    writeSessionState(fixture.projectDirectory, 'session-911', '911');

    // Re-entry skips the session skill-invocation check so this fixture reaches the scenario verdict.
    const result = runStopHook(fixture.projectDirectory, 'session-911', true);

    expect(result.reason).toContain('features/911.feature');
    expect(result.reason).toContain('@wip');
    expect(result.reason).toContain('line 1');
  });
});
