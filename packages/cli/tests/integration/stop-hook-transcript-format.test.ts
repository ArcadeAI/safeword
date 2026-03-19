/**
 * Frozen Transcript Fixture Test: Stop Hook Format Compatibility
 *
 * Runs the stop-quality hook against a frozen real-format transcript.
 * Purpose: catch format drift if Anthropic changes the Claude Code transcript
 * JSONL structure (field names, nesting, content block types, etc.).
 *
 * The fixture captures the actual transcript format as of Claude Code v2.1.42:
 * - Top-level fields: type, parentUuid, isSidechain, userType, cwd, sessionId,
 *   version, gitBranch, requestId, uuid, timestamp
 * - Nested message: { model, role, content: ContentItem[] }
 * - Content types: text, tool_use, tool_result, thinking
 *
 * If the hook silently fails to parse new-format transcripts, this test will
 * catch it (the hook would exit 0 without a block decision, but we verify it
 * does block on a transcript where edits were made).
 *
 * To update: capture a real session transcript, strip sensitive fields, save to
 * packages/cli/tests/fixtures/stop-hook-transcript.jsonl.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory, TIMEOUT_QUICK } from '../helpers';

// Run the hook directly from the safeword source tree — no runCli(['setup']) needed.
// This matches the pattern used in quality-gates.test.ts.
const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const STOP_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/stop-quality.ts');
const FIXTURE_PATH = nodePath.join(import.meta.dirname, '../fixtures/stop-hook-transcript.jsonl');

let projectDirectory: string;

beforeEach(() => {
  projectDirectory = createTemporaryDirectory();
  // Hook only requires .safeword/ to exist (checked with existsSync)
  mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
});

afterEach(() => {
  removeTemporaryDirectory(projectDirectory);
});

describe('Stop Hook: Frozen Transcript Format Compatibility', () => {
  it('detects edits and triggers quality review from real-format transcript', () => {
    const input = JSON.stringify({ transcript_path: FIXTURE_PATH });
    const result = spawnSync('bash', ['-c', `echo '${input}' | bun "${STOP_QUALITY}"`], {
      cwd: projectDirectory,
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
      encoding: 'utf8',
      timeout: TIMEOUT_QUICK,
    });

    // Hook should soft-block (exit 0 with JSON decision) because:
    // Transcript has an Edit tool_use block → editToolsUsed = true
    const exitCode = result.status ?? 0;
    expect(exitCode).toBe(0);

    // Should produce a block decision (not silent exit).
    // If stdout is not valid JSON, the hook exited silently — likely a transcript format
    // change (e.g. renamed field) that caused the hook to find no assistant messages.
    let parsed: { decision?: string; reason?: string };
    try {
      parsed = JSON.parse(result.stdout.trim());
    } catch {
      throw new Error(
        `Hook exited silently (no JSON output) — transcript format may have changed.\nstderr: ${result.stderr}`,
      );
    }
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toBeTruthy();
  });

  it('fixture uses real transcript envelope fields (format regression guard)', () => {
    // Verify the fixture hasn't been accidentally simplified to our hand-crafted test
    // format ({"type":"assistant","message":{...}}). Real transcripts include routing
    // fields like parentUuid that are absent from the simplified format.
    const lines = readFileSync(FIXTURE_PATH, 'utf8').trim().split('\n');
    const hasRealEnvelope = lines.some(line => {
      try {
        return (JSON.parse(line) as Record<string, unknown>).parentUuid !== undefined;
      } catch {
        return false;
      }
    });
    expect(hasRealEnvelope).toBe(true);
  });
});
