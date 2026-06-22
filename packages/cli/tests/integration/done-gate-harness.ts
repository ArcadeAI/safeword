/**
 * Shared harness for the done-gate (stop-quality.ts) integration tests.
 *
 * Builds a feature ticket parked at done-phase and drives the real Stop hook,
 * returning its block decision. Used by skill-gate-integration.test.ts and the
 * Codex/Cursor fallback E2E test so the ticket scaffold and hook-invocation
 * plumbing live in one place.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { writeTestFile } from '../helpers.js';

/**
 * A feature ticket at done-phase with verify.md + test-definitions.md present,
 * so only the skill-invocation gate is in play (other done-gate checks pass).
 */
export function writeFeatureTicketAtDone(directory: string, ticketId: string): void {
  const folder = `.project/tickets/${ticketId}`;
  mkdirSync(nodePath.join(directory, folder), { recursive: true });
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

/**
 * Run the real stop-quality.ts done-gate against a project for a session, and
 * return its exit code + block reason. `environment` defaults to the ambient
 * env with CLAUDE_PROJECT_DIR set; pass a scrubbed env to simulate a non-Claude
 * runtime.
 */
export function runDoneGate(
  projectDirectory: string,
  sessionId: string,
  environment?: NodeJS.ProcessEnv,
): { exitCode: number; reason: string } {
  const resolvedEnvironment = environment ?? {
    ...process.env,
    CLAUDE_PROJECT_DIR: projectDirectory,
  };
  const transcriptPath = nodePath.join(projectDirectory, 'transcript.jsonl');
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
    cwd: projectDirectory,
    env: resolvedEnvironment,
    encoding: 'utf8',
  });
  try {
    return { exitCode: result.status ?? 0, reason: JSON.parse(result.stdout.trim()).reason ?? '' };
  } catch {
    return { exitCode: result.status ?? 0, reason: '' };
  }
}
