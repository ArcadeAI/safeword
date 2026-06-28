/**
 * Integration test: the stop-retro hook surfaces a fact-phrased retro nudge via
 * hookSpecificOutput.additionalContext on a substantial session (ticket FTCQGD).
 *
 * Spawns the real dogfood hook under bun, with a seeded transcript file, and
 * asserts the wiring end-to-end: substantial → additionalContext + exit 0; trivial
 * → silent; already-nudged → silent; malformed input → silent; surface=false →
 * silent. The decision logic itself is unit-tested in tests/hooks/retro-trigger.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sentinelPath } from '../../templates/hooks/lib/retro-trigger.js';
import { createTemporaryDirectory, removeTemporaryDirectory, TIMEOUT_QUICK } from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const HOOK = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/stop-retro.ts');

function writeConfig(directory: string, selfReport: Record<string, boolean>): void {
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, '.safeword', 'config.json'),
    JSON.stringify({ selfReport }),
  );
}

// A transcript JSONL with `n` assistant tool_use items (the substance measure).
function writeTranscript(directory: string, name: string, toolUses: number): string {
  const lines: string[] = [];
  for (let i = 0; i < toolUses; i++) {
    lines.push(
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: `t${i}`, name: 'Bash', input: {} }],
        },
      }),
    );
  }
  const file = nodePath.join(directory, name);
  writeFileSync(file, lines.join('\n'));
  return file;
}

function runHook(directory: string, input: unknown) {
  return spawnSync('bun', [HOOK], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    cwd: directory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

describe('stop-retro hook (FTCQGD)', () => {
  let dir: string;
  // Unique session ids per run so the /tmp sentinel never collides across tests.
  const sessionIds: string[] = [];

  function freshSession(tag: string): string {
    const id = `ftcqgd-${tag}-${process.pid}-${sessionIds.length}`;
    sessionIds.push(id);
    return id;
  }

  beforeEach(() => {
    dir = createTemporaryDirectory();
  });
  afterEach(() => {
    removeTemporaryDirectory(dir);
    for (const id of sessionIds) rmSync(sentinelPath(id), { force: true });
    sessionIds.length = 0;
  });

  it('surfaces a retro nudge with the transcript path and guide on a substantial session', () => {
    writeConfig(dir, { surface: true });
    const transcript = writeTranscript(dir, 'big.jsonl', 8);
    const id = freshSession('big');

    const result = runHook(dir, { session_id: id, transcript_path: transcript });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.hookSpecificOutput.hookEventName).toBe('Stop');
    expect(payload.hookSpecificOutput.additionalContext).toContain(transcript);
    expect(payload.hookSpecificOutput.additionalContext.toLowerCase()).toContain('guide');
  });

  it('stays silent on a trivial session', () => {
    writeConfig(dir, { surface: true });
    const transcript = writeTranscript(dir, 'small.jsonl', 1);
    const id = freshSession('small');

    const result = runHook(dir, { session_id: id, transcript_path: transcript });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('stays silent on the second Stop for the same session (sentinel set)', () => {
    writeConfig(dir, { surface: true });
    const transcript = writeTranscript(dir, 'big.jsonl', 8);
    const id = freshSession('twice');

    const first = runHook(dir, { session_id: id, transcript_path: transcript });
    expect(first.stdout).toContain('additionalContext');
    const second = runHook(dir, { session_id: id, transcript_path: transcript });
    expect(second.stdout.trim()).toBe('');
  });

  it('stays silent when surfacing is disabled', () => {
    writeConfig(dir, { surface: false });
    const transcript = writeTranscript(dir, 'big.jsonl', 8);
    const id = freshSession('off');

    const result = runHook(dir, { session_id: id, transcript_path: transcript });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('fails open on malformed stdin (no output, exit 0)', () => {
    writeConfig(dir, { surface: true });

    const result = runHook(dir, 'this is not json');

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});
