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

import { spoolDrafts } from '../../templates/hooks/lib/retro-draft-spool.js';
import {
  CODEX_FILER_SKILL_NAME,
  FILING_ATTEMPT_CAP,
} from '../../templates/hooks/lib/retro-filing-gate.js';
import { offsetStatePath, sentinelPath } from '../../templates/hooks/lib/retro-trigger.js';
import { readSessionReports } from '../../templates/hooks/lib/self-report.js';
import {
  createTemporaryDirectory,
  readJsonlFile,
  removeTemporaryDirectory,
  retroDraft,
  TIMEOUT_QUICK,
  writeSelfReportConfig as writeConfig,
} from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const HOOK = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/codex/stop.ts');

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

function expectNoContinuation(result: ReturnType<typeof runHook>): void {
  expect(JSON.parse(result.stdout.trim()).decision).toBeUndefined();
}

describe('codex/stop.ts retro adapter (CDX602)', () => {
  let dir: string;
  let recordPath: string;
  let debugLogPath: string;
  const sessionIds: string[] = [];

  function freshSession(tag: string): string {
    const id = `codex-53dqjz-${tag}-${process.pid}-${sessionIds.length}`;
    sessionIds.push(id);
    return id;
  }

  beforeEach(() => {
    dir = createTemporaryDirectory();
    recordPath = nodePath.join(dir, 'child-record.json');
    debugLogPath = nodePath.join(dir, 'retro-debug.jsonl');
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
    expectNoContinuation(result);

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
    expect(existsSync(offsetStatePath(id))).toBe(true);
  });

  it('writes opt-in sanitized diagnostics for Codex Stop child failures', () => {
    writeConfig(dir, { surface: true });
    installFakeLocalCli(dir, { exitCode: 7 });
    const transcript = writeCodexRollout(dir, 'big.jsonl', 8);
    const id = freshSession('debugfail');

    const result = runHook(
      dir,
      { session_id: id, transcript_path: transcript, cwd: dir },
      {
        RECORD_PATH: recordPath,
        SAFEWORD_RETRO_DEBUG_LOG: debugLogPath,
      },
    );

    expect(result.status).toBe(0);
    expectNoContinuation(result);
    expect(existsSync(offsetStatePath(id))).toBe(false);

    const events = readJsonlFile(debugLogPath);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'codex_stop_retro_decision',
          outcome: 'run',
          toolUses: 8,
          windowStart: 0,
        }),
        expect.objectContaining({
          event: 'codex_stop_child_exit',
          status: 7,
          ok: false,
          timedOut: false,
          pendingOffsetState: true,
        }),
      ]),
    );
    const rawTrace = readFileSync(debugLogPath, 'utf8');
    expect(rawTrace).not.toContain('function_call');
    expect(rawTrace).not.toContain(transcript);
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
    expectNoContinuation(result);
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
    expectNoContinuation(result);
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
    expectNoContinuation(first);
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
    expectNoContinuation(second);
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
    expectNoContinuation(first);
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
    expectNoContinuation(second);
    expect(existsSync(recordPath)).toBe(true);
    expect(existsSync(offsetStatePath(id))).toBe(true);
  });

  it('fails open silently on malformed stdin', () => {
    writeConfig(dir, { surface: true });
    installFakeLocalCli(dir);

    const result = runHook(dir, 'not json at all', { RECORD_PATH: recordPath });

    expect(result.status).toBe(0);
    expectNoContinuation(result);
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
    expectNoContinuation(result);
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
    expectNoContinuation(result);
    expect(existsSync(recordPath)).toBe(false);
  });

  // Filing gate (GH628F / #628): unfiled spooled drafts turn the stop into the
  // sanctioned dispatch continuation; extraction itself stays invisible (CDX602).
  describe('filing gate (GH628F)', () => {
    it('retro-filer-gate.SM1.AC1.dispatches_filer_for_unfiled_drafts', () => {
      writeConfig(dir, { surface: true, file: true });
      const id = freshSession('filing');
      spoolDrafts(dir, id, [retroDraft('retro:aaaaaaaaaaaa')]);

      const result = runHook(dir, { session_id: id, cwd: dir });

      expect(result.status).toBe(0);
      const out = JSON.parse(result.stdout.trim());
      expect(out.decision).toBe('block');
      expect(out.reason).toContain(CODEX_FILER_SKILL_NAME);
      expect(out.reason).toContain('.safeword/retro-drafts');
    });

    it('retro-filer-gate.SM1.AC1.silent_when_selfReport_file_off', () => {
      writeConfig(dir, { surface: true, file: false });
      const id = freshSession('filingoff');
      spoolDrafts(dir, id, [retroDraft('retro:aaaaaaaaaaaa')]);

      const result = runHook(dir, { session_id: id, cwd: dir });

      expect(result.status).toBe(0);
      expectNoContinuation(result);
    });

    it('filer-ack-tripwire.SM1.AC3.watch_only_install_still_trips_through_the_codex_hook', () => {
      // file:false sheds the dispatch but not the tripwire (GH644A): the shed
      // adapter guard means the shared gate still evaluates and captures.
      writeConfig(dir, { surface: false, file: false, capture: true });
      const id = freshSession('watchonly');
      mkdirSync(nodePath.join(dir, '.safeword', 'retro-drafts'), { recursive: true });
      writeFileSync(
        nodePath.join(dir, '.safeword', 'retro-drafts', `${id}.filing-attempts`),
        `${JSON.stringify({ key: 'k', attempts: 0, signatures: ['retro:aaaaaaaaaaaa'] })}\n`,
      );

      const result = runHook(dir, { session_id: id, cwd: dir });

      expect(result.status).toBe(0);
      expectNoContinuation(result);
      expect(readSessionReports(dir, id)).toHaveLength(1);
      expect(readSessionReports(dir, id)[0]?.errorClass).toBe('RetroBareDrain');
    });

    it('retro-filer-gate.SM1.AC2.goes_quiet_after_the_attempt_cap', () => {
      writeConfig(dir, { surface: true, file: true });
      const id = freshSession('filingcap');
      spoolDrafts(dir, id, [retroDraft('retro:aaaaaaaaaaaa')]);

      for (let attempt = 1; attempt <= FILING_ATTEMPT_CAP; attempt++) {
        const out = JSON.parse(runHook(dir, { session_id: id, cwd: dir }).stdout.trim());
        expect(out.decision).toBe('block');
      }
      expectNoContinuation(runHook(dir, { session_id: id, cwd: dir }));
    });
  });
});
