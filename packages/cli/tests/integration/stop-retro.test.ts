/**
 * Integration test: the stop-retro hook runs the retro retrospective OUT OF BAND
 * and emits NOTHING to the conversation (ticket 7D8PJP — supersedes FTCQGD's
 * additionalContext nudge).
 *
 * Spawns the real dogfood hook under bun with a seeded transcript, and asserts the
 * wiring end-to-end: substantial → no additionalContext + exit 0 + sentinel set
 * (it decided to run); trivial / already-run / retro-child / surface=false /
 * malformed → silent. The extraction CLI itself is neutralized via the
 * SAFEWORD_RETRO_EXTRACT_CMD seam (spawns `true`) so no real `claude -p` launches.
 * The decision logic is unit-tested in tests/hooks/retro-trigger.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hasNudged, sentinelPath } from '../../templates/hooks/lib/retro-trigger.js';
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

function runHook(directory: string, input: unknown, extraEnvironment: Record<string, string> = {}) {
  return spawnSync('bun', [HOOK], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    cwd: directory,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: directory,
      // Neutralize the real extraction CLI so no headless claude -p launches.
      SAFEWORD_RETRO_EXTRACT_CMD: 'true',
      ...extraEnvironment,
    },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

describe('stop-retro hook — invisible out-of-band run (7D8PJP)', () => {
  let dir: string;
  const sessionIds: string[] = [];

  function freshSession(tag: string): string {
    const id = `inv-retro-${tag}-${process.pid}-${sessionIds.length}`;
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

  it('TB1.AC1: a substantial session runs but emits NO conversation context', () => {
    writeConfig(dir, { surface: true });
    const transcript = writeTranscript(dir, 'big.jsonl', 8);
    const id = freshSession('big');

    const result = runHook(dir, { session_id: id, transcript_path: transcript });

    expect(result.status).toBe(0);
    // The invisibility guarantee: nothing reaches the conversation.
    expect(result.stdout.trim()).toBe('');
    expect(result.stdout).not.toContain('additionalContext');
    // It DID decide to run (sentinel armed), so silence is a real run, not a skip.
    expect(hasNudged(id)).toBe(true);
  });

  it('stays silent on a trivial session', () => {
    writeConfig(dir, { surface: true });
    const transcript = writeTranscript(dir, 'small.jsonl', 1);
    const id = freshSession('small');

    const result = runHook(dir, { session_id: id, transcript_path: transcript });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('SM1.AC2: stays silent on the second Stop for the same session (sentinel set)', () => {
    writeConfig(dir, { surface: true });
    const transcript = writeTranscript(dir, 'big.jsonl', 8);
    const id = freshSession('twice');

    const first = runHook(dir, { session_id: id, transcript_path: transcript });
    expect(first.status).toBe(0);
    const second = runHook(dir, { session_id: id, transcript_path: transcript });
    expect(second.status).toBe(0);
    expect(second.stdout.trim()).toBe('');
  });

  it('NTB1.AC2: stays silent for a retro headless child (SAFEWORD_RETRO_CHILD set)', () => {
    writeConfig(dir, { surface: true });
    const transcript = writeTranscript(dir, 'big.jsonl', 8);
    const id = freshSession('child');

    const result = runHook(
      dir,
      { session_id: id, transcript_path: transcript },
      { SAFEWORD_RETRO_CHILD: '1' },
    );

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
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
