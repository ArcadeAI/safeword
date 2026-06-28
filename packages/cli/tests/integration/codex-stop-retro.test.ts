/**
 * Integration test: the Codex stop.ts adapter fires the retro pipeline via a
 * {decision:"block"} continuation on a substantial Codex session (ticket 53DQJZ).
 *
 * Spawns the real dogfood hook under bun with a seeded Codex rollout, asserting
 * the wiring: substantial Codex rollout → block + path + guide; below-threshold →
 * valid {} (no decision); Claude-shaped lines → {} (zero Codex events); second
 * Stop → {}; malformed stdin → valid JSON, exit 0. Decision logic is unit-tested
 * in tests/hooks/retro-trigger-codex.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sentinelPath } from '../../templates/hooks/lib/retro-trigger.js';
import { createTemporaryDirectory, removeTemporaryDirectory, TIMEOUT_QUICK } from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const HOOK = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/codex/stop.ts');

function writeConfig(directory: string, selfReport: Record<string, boolean>): void {
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, '.safeword', 'config.json'),
    JSON.stringify({ selfReport }),
  );
}

/** A Codex rollout JSONL with `n` function_call tool events. */
function writeCodexRollout(directory: string, name: string, toolEvents: number): string {
  const lines = Array.from({ length: toolEvents }, () =>
    JSON.stringify({ type: 'function_call', payload: {} }),
  );
  const file = nodePath.join(directory, name);
  writeFileSync(file, lines.join('\n'));
  return file;
}

/** A rollout of Claude-shaped tool_use lines — zero Codex tool events. */
function writeClaudeShapedRollout(directory: string, name: string): string {
  const lines = Array.from({ length: 8 }, () =>
    JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'tool_use', name: 'x', input: {} }] },
    }),
  );
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

describe('codex/stop.ts retro adapter (53DQJZ)', () => {
  let dir: string;
  const sessionIds: string[] = [];

  function freshSession(tag: string): string {
    const id = `codex-53dqjz-${tag}-${process.pid}-${sessionIds.length}`;
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

  it('emits a block-continuation with path and guide on a substantial Codex session', () => {
    writeConfig(dir, { surface: true });
    const transcript = writeCodexRollout(dir, 'big.jsonl', 8);
    const id = freshSession('big');

    const result = runHook(dir, { session_id: id, transcript_path: transcript, cwd: dir });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.decision).toBe('block');
    expect(payload.reason).toContain(transcript);
    expect(payload.reason.toLowerCase()).toContain('guide');
  });

  it('emits valid JSON with no decision on a below-threshold Codex session', () => {
    writeConfig(dir, { surface: true });
    const transcript = writeCodexRollout(dir, 'small.jsonl', 1);
    const id = freshSession('small');

    const result = runHook(dir, { session_id: id, transcript_path: transcript, cwd: dir });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).decision).toBeUndefined();
  });

  it('does not fire on a rollout of Claude-shaped tool_use lines (zero Codex events)', () => {
    writeConfig(dir, { surface: true });
    const transcript = writeClaudeShapedRollout(dir, 'claude-shaped.jsonl');
    const id = freshSession('wrongshape');

    const result = runHook(dir, { session_id: id, transcript_path: transcript, cwd: dir });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).decision).toBeUndefined();
  });

  it('does not continue again on the second Stop for the same session', () => {
    writeConfig(dir, { surface: true });
    const transcript = writeCodexRollout(dir, 'big.jsonl', 8);
    const id = freshSession('twice');

    const first = runHook(dir, { session_id: id, transcript_path: transcript, cwd: dir });
    expect(JSON.parse(first.stdout).decision).toBe('block');
    const second = runHook(dir, { session_id: id, transcript_path: transcript, cwd: dir });
    expect(JSON.parse(second.stdout).decision).toBeUndefined();
  });

  it('fails open with valid JSON on malformed stdin', () => {
    writeConfig(dir, { surface: true });

    const result = runHook(dir, 'not json at all');

    expect(result.status).toBe(0);
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    expect(JSON.parse(result.stdout).decision).toBeUndefined();
  });
});
