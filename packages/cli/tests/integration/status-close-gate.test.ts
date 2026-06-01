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
  removeTemporaryDirectory,
  setupOrThrow,
  writeTestFile,
} from '../helpers.js';

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

/** A feature closed by the sidestep: status:done but phase still intake, with
 * complete scenarios and (deliberately) NO verify.md. */
function writeFeatureClosedByStatus(directory: string, ticketId: string): void {
  const folder = `.safeword-project/tickets/${ticketId}`;
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

/** Bind the session's active ticket so the session-scoped resolution path runs
 * (the sidestep only drops the ticket from the global in_progress scan). */
function writeSessionState(directory: string, sessionId: string, ticketId: string): void {
  writeFileSync(
    nodePath.join(directory, '.safeword-project', `quality-state-${sessionId}.json`),
    JSON.stringify({ activeTicket: ticketId }),
  );
}

function runStopHook(targetDirectory: string, sessionId: string): { reason: string } {
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
    input: JSON.stringify({ transcript_path: transcriptPath, session_id: sessionId }),
    cwd: targetDirectory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: targetDirectory },
    encoding: 'utf8',
  });
  try {
    return { reason: JSON.parse(result.stdout.trim()).reason ?? '' };
  } catch {
    return { reason: '' };
  }
}

describe('status-close done-gate (2JMQMX)', () => {
  it('blocks a feature closed by status:done with no verify.md', () => {
    writeFeatureClosedByStatus(projectDirectory, '910');
    writeSessionState(projectDirectory, 'session-910', '910');

    const result = runStopHook(projectDirectory, 'session-910');

    // The surfaced phase:'done' reached the real done-gate, which blocked on the
    // missing evidence — the sidestep is closed.
    expect(result.reason.toLowerCase()).toContain('verify.md');
  });
});
