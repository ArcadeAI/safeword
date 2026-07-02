/**
 * Integration test: the Codex stop.ts adapter fires the retro pipeline invisibly
 * on a substantial Codex session (ticket CDX602 / issue #602).
 *
 * Spawns the real dogfood hook under bun with a seeded Codex rollout, asserting
 * the wiring: substantial Codex rollout → silent synchronous child; below-threshold
 * / wrong-shape / malformed / unreadable → silent no-op; recursion sentinel →
 * no child. Decision logic is unit-tested in tests/hooks/retro-trigger-codex.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { offsetStatePath, sentinelPath } from '../../templates/hooks/lib/retro-trigger.js';
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

function installFakeLocalCli(directory: string, options: { exitCode?: number } = {}): void {
  const exitCode = options.exitCode ?? 0;
  const cliPath = nodePath.join(directory, 'packages/cli/src/cli.ts');
  mkdirSync(nodePath.dirname(cliPath), { recursive: true });
  writeFileSync(
    cliPath,
    `#!/usr/bin/env bun
import { writeFileSync } from 'node:fs';
writeFileSync(process.env.RECORD_PATH!, JSON.stringify({
  argv: Bun.argv.slice(2),
  cwd: process.cwd(),
  env: {
    SAFEWORD_RETRO_AGENT: process.env.SAFEWORD_RETRO_AGENT,
    SAFEWORD_RETRO_CHILD: process.env.SAFEWORD_RETRO_CHILD,
	  },
	}));
	${exitCode === 0 ? '' : `process.exit(${exitCode});`}
	`,
  );
}

function readRecord(path: string): {
  argv: string[];
  cwd: string;
  env: { SAFEWORD_RETRO_AGENT?: string; SAFEWORD_RETRO_CHILD?: string };
} {
  return JSON.parse(readFileSync(path, 'utf8')) as {
    argv: string[];
    cwd: string;
    env: { SAFEWORD_RETRO_AGENT?: string; SAFEWORD_RETRO_CHILD?: string };
  };
}

function runHook(directory: string, input: unknown, env: Record<string, string | undefined> = {}) {
  return spawnSync('bun', [HOOK], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    cwd: directory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory, ...env },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

describe('codex/stop.ts retro adapter (CDX602)', () => {
  let dir: string;
  let recordPath: string;
  const sessionIds: string[] = [];

  function freshSession(tag: string): string {
    const id = `codex-53dqjz-${tag}-${process.pid}-${sessionIds.length}`;
    sessionIds.push(id);
    return id;
  }

  beforeEach(() => {
    dir = createTemporaryDirectory();
    recordPath = nodePath.join(dir, 'child-record.json');
  });
  afterEach(() => {
    removeTemporaryDirectory(dir);
    for (const id of sessionIds) {
      rmSync(sentinelPath(id), { force: true });
      rmSync(offsetStatePath(id), { force: true });
    }
    sessionIds.length = 0;
  });

  it('codex-retro-parity.SM1.AC1.silently_spawns_sync_retro_child_on_substantial_codex_session', () => {
    writeConfig(dir, { surface: true });
    installFakeLocalCli(dir);
    const transcript = writeCodexRollout(dir, 'big.jsonl', 8);
    const id = freshSession('big');

    const result = runHook(
      dir,
      { session_id: id, transcript_path: transcript, cwd: dir },
      {
        RECORD_PATH: recordPath,
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');

    expect(existsSync(recordPath)).toBe(true);
    const record = readRecord(recordPath);
    expect(record.cwd).toBe(realpathSync(dir));
    expect(record.env.SAFEWORD_RETRO_AGENT).toBe('codex');
    expect(record.env.SAFEWORD_RETRO_CHILD).toBe('1');
    expect(record.argv).toContain('retro');
    expect(record.argv).toContain('--auto-extract');
    expect(record.argv[record.argv.indexOf('--transcript') + 1]).toBe(transcript);
    expect(record.argv[record.argv.indexOf('--window-start') + 1]).toBe('0');
    expect(record.argv[record.argv.indexOf('--session-id') + 1]).toBe(id);
  });

  it('codex-retro-parity.SM2.AC1.stays_silent_without_child_on_below_threshold_codex_session', () => {
    writeConfig(dir, { surface: true });
    installFakeLocalCli(dir);
    const transcript = writeCodexRollout(dir, 'small.jsonl', 1);
    const id = freshSession('small');

    const result = runHook(
      dir,
      { session_id: id, transcript_path: transcript, cwd: dir },
      {
        RECORD_PATH: recordPath,
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(existsSync(recordPath)).toBe(false);
  });

  it('does not fire on a rollout of Claude-shaped tool_use lines (zero Codex events)', () => {
    writeConfig(dir, { surface: true });
    installFakeLocalCli(dir);
    const transcript = writeClaudeShapedRollout(dir, 'claude-shaped.jsonl');
    const id = freshSession('wrongshape');

    const result = runHook(
      dir,
      { session_id: id, transcript_path: transcript, cwd: dir },
      {
        RECORD_PATH: recordPath,
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(existsSync(recordPath)).toBe(false);
  });

  it('does not fire again on the second Stop without enough new growth', () => {
    writeConfig(dir, { surface: true });
    installFakeLocalCli(dir);
    const transcript = writeCodexRollout(dir, 'big.jsonl', 8);
    const id = freshSession('twice');

    const first = runHook(
      dir,
      { session_id: id, transcript_path: transcript, cwd: dir },
      {
        RECORD_PATH: recordPath,
      },
    );
    expect(first.status).toBe(0);
    expect(first.stdout).toBe('');
    expect(existsSync(recordPath)).toBe(true);

    rmSync(recordPath, { force: true });
    const second = runHook(
      dir,
      { session_id: id, transcript_path: transcript, cwd: dir },
      {
        RECORD_PATH: recordPath,
      },
    );
    expect(second.status).toBe(0);
    expect(second.stdout).toBe('');
    expect(existsSync(recordPath)).toBe(false);
  });

  it('does not advance offset state when the retro child exits non-zero', () => {
    writeConfig(dir, { surface: true });
    installFakeLocalCli(dir, { exitCode: 1 });
    const transcript = writeCodexRollout(dir, 'big.jsonl', 8);
    const id = freshSession('childfail');

    const first = runHook(
      dir,
      { session_id: id, transcript_path: transcript, cwd: dir },
      {
        RECORD_PATH: recordPath,
      },
    );
    expect(first.status).toBe(0);
    expect(first.stdout).toBe('');
    expect(existsSync(recordPath)).toBe(true);
    expect(existsSync(offsetStatePath(id))).toBe(false);

    rmSync(recordPath, { force: true });
    installFakeLocalCli(dir);
    const second = runHook(
      dir,
      { session_id: id, transcript_path: transcript, cwd: dir },
      {
        RECORD_PATH: recordPath,
      },
    );
    expect(second.status).toBe(0);
    expect(second.stdout).toBe('');
    expect(existsSync(recordPath)).toBe(true);
    expect(existsSync(offsetStatePath(id))).toBe(true);
  });

  it('fails open silently on malformed stdin', () => {
    writeConfig(dir, { surface: true });
    installFakeLocalCli(dir);

    const result = runHook(dir, 'not json at all', { RECORD_PATH: recordPath });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(existsSync(recordPath)).toBe(false);
  });

  it('fails open silently when the transcript_path is unreadable', () => {
    writeConfig(dir, { surface: true });
    installFakeLocalCli(dir);
    const id = freshSession('unreadable');

    const result = runHook(
      dir,
      {
        session_id: id,
        transcript_path: nodePath.join(dir, 'does-not-exist.jsonl'),
        cwd: dir,
      },
      {
        RECORD_PATH: recordPath,
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(existsSync(recordPath)).toBe(false);
  });

  it('codex-retro-parity.SM3.AC1.recursion_guard_suppresses_child_spawn', () => {
    writeConfig(dir, { surface: true });
    installFakeLocalCli(dir);
    const transcript = writeCodexRollout(dir, 'big.jsonl', 8);
    const id = freshSession('child');

    const result = runHook(
      dir,
      { session_id: id, transcript_path: transcript, cwd: dir },
      {
        RECORD_PATH: recordPath,
        SAFEWORD_RETRO_CHILD: '1',
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(existsSync(recordPath)).toBe(false);
  });
});
