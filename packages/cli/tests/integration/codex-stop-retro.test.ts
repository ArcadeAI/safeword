/**
 * Integration test: the Codex stop.ts adapter fires the retro pipeline invisibly
 * on a substantial Codex session (ticket CDX602 / issue #602).
 *
 * Spawns the real dogfood hook under bun with a seeded Codex rollout, asserting
 * the wiring: substantial Codex rollout → silent synchronous child; below-threshold
 * / wrong-shape / malformed / unreadable → silent no-op; recursion sentinel →
 * no child. Decision logic is unit-tested in tests/hooks/retro-trigger-codex.
 */

import { execSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { evaluateDoneEvidence } from '../../templates/hooks/lib/done-gate.js';
import { spoolDrafts } from '../../templates/hooks/lib/retro-draft-spool.js';
import {
  CODEX_FILER_SKILL_NAME,
  FILING_ATTEMPT_CAP,
} from '../../templates/hooks/lib/retro-filing-gate.js';
import { offsetStatePath, sentinelPath } from '../../templates/hooks/lib/retro-trigger.js';
import { readSessionReports } from '../../templates/hooks/lib/self-report.js';
import {
  createTemporaryDirectory,
  initGitRepo,
  readJsonlFile,
  removeTemporaryDirectory,
  retroDraft,
  TIMEOUT_QUICK,
  writeSelfReportConfig as writeConfig,
  writeTestFile,
} from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const HOOK = nodePath.join(SAFEWORD_ROOT, 'packages/cli/templates/hooks/codex/stop.ts');
const POST_TOOL_HOOK = nodePath.join(
  SAFEWORD_ROOT,
  'packages/cli/templates/hooks/codex/post-tool-quality.ts',
);

/** A Codex rollout JSONL with `n` function_call tool events. */
function writeCodexRollout(directory: string, name: string, toolEvents: number): string {
  const lines = Array.from({ length: toolEvents }, () =>
    JSON.stringify({ type: 'function_call', payload: {} }),
  );
  const file = nodePath.join(directory, name);
  writeFileSync(file, lines.join('\n'));
  return file;
}

function writeCompletedCodexRollout(directory: string, name: string, pairs: number): string {
  const lines = Array.from({ length: pairs }, (_, index) => [
    JSON.stringify({
      type: 'response_item',
      payload: { type: 'function_call', call_id: `call_${index}` },
    }),
    JSON.stringify({
      type: 'response_item',
      payload: { type: 'function_call_output', call_id: `call_${index}` },
    }),
  ]).flat();
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
import { readFileSync, writeFileSync } from 'node:fs';
writeFileSync(process.env.RECORD_PATH!, JSON.stringify({
  argv: Bun.argv.slice(2),
  cwd: process.cwd(),
  env: {
    SAFEWORD_RETRO_AGENT: process.env.SAFEWORD_RETRO_AGENT,
    SAFEWORD_RETRO_CHILD: process.env.SAFEWORD_RETRO_CHILD,
	  },
	ticketContent: process.env.TICKET_PATH ? readFileSync(process.env.TICKET_PATH, 'utf8') : undefined,
	}));
	${exitCode === 0 ? '' : `process.exit(${exitCode});`}
	`,
  );
}

function readRecord(path: string): {
  argv: string[];
  cwd: string;
  env: { SAFEWORD_RETRO_AGENT?: string; SAFEWORD_RETRO_CHILD?: string };
  ticketContent?: string;
} {
  return JSON.parse(readFileSync(path, 'utf8')) as {
    argv: string[];
    cwd: string;
    env: { SAFEWORD_RETRO_AGENT?: string; SAFEWORD_RETRO_CHILD?: string };
    ticketContent?: string;
  };
}

function generatedArchitectureDocument(fingerprint: string): string {
  return `---\ngenerator: safeword-architecture\nfingerprint: ${fingerprint}\n---\n\n# Architecture\n`;
}

function enableArchitectureAdvisory(directory: string): void {
  initGitRepo(directory);
  writeTestFile(directory, 'ARCHITECTURE.md', '# Architecture\n\nHuman narrative.\n');
  writeTestFile(
    directory,
    '.project/architecture.generated.md',
    generatedArchitectureDocument('base-fingerprint'),
  );
  execSync('git add . && git commit -qm base', { cwd: directory, stdio: 'pipe' });
  const baseBranch = execSync('git branch --show-current', {
    cwd: directory,
    encoding: 'utf8',
  }).trim();
  execSync('git checkout -q -b feature-architecture-advisory', { cwd: directory, stdio: 'pipe' });
  execSync(`git branch --set-upstream-to=${baseBranch} feature-architecture-advisory`, {
    cwd: directory,
    stdio: 'pipe',
  });
  writeTestFile(
    directory,
    '.project/architecture.generated.md',
    generatedArchitectureDocument('moved-fingerprint'),
  );
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

function runPostToolHook(
  directory: string,
  input: unknown,
  env: Record<string, string | undefined> = {},
) {
  return spawnSync('bun', [POST_TOOL_HOOK], {
    input: JSON.stringify(input),
    cwd: directory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory, ...env },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

function writeTicket(
  directory: string,
  id: string,
  options: { phase?: string; status?: string; type?: string; verify?: boolean } = {},
): string {
  const folder = `${id.toUpperCase()}-ticket`;
  const ticketDirectory = nodePath.join(directory, '.project', 'tickets', folder);
  mkdirSync(ticketDirectory, { recursive: true });
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    [
      '---',
      `id: ${id}`,
      `type: ${options.type ?? 'task'}`,
      `phase: ${options.phase ?? 'done'}`,
      `status: ${options.status ?? 'in_progress'}`,
      'last_modified: 2026-07-24T00:00:00Z',
      '---',
      '',
      '# Test ticket',
    ].join('\n'),
  );
  if (options.verify ?? true) {
    writeFileSync(
      nodePath.join(ticketDirectory, 'verify.md'),
      '# Verify\n\n**PR Scope:** ✅ Diff matches ticket scope\n',
    );
  }
  return ticketDirectory;
}

function evaluateFixtureEvidence(
  projectDirectory: string,
  ticketDirectory: string,
  ticketType: string,
) {
  const previousCli = process.env.SAFEWORD_CLI;
  process.env.SAFEWORD_CLI = nodePath.join(SAFEWORD_ROOT, 'packages/cli/src/cli.ts');
  try {
    return evaluateDoneEvidence({
      projectDir: projectDirectory,
      ticketDir: ticketDirectory,
      ticketType,
    });
  } finally {
    if (previousCli === undefined) delete process.env.SAFEWORD_CLI;
    else process.env.SAFEWORD_CLI = previousCli;
  }
}

function bindCodexTicket(directory: string, sessionId: string, ticketId: string): void {
  mkdirSync(nodePath.join(directory, '.project'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, '.project', `quality-state-codex-${sessionId}.json`),
    JSON.stringify({
      locSinceCommit: 0,
      lastCommitHash: '',
      activeTicket: ticketId,
      recentFailures: [],
      incrementedPatterns: [],
    }),
  );
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

  it('forwards public eligibility established by completed Codex event pairs', () => {
    writeConfig(dir, { surface: true });
    installFakeLocalCli(dir);
    const transcript = writeCompletedCodexRollout(dir, 'completed.jsonl', 3);
    const id = freshSession('completed');

    runHook(
      dir,
      { session_id: id, transcript_path: transcript, cwd: dir },
      {
        RECORD_PATH: recordPath,
      },
    );

    expect(readRecord(recordPath).argv).toContain('--public-retro');
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

  describe('done transition (QRX2DN)', () => {
    it('codex-done-gate.TBU1.R1.closes_only_the_verified_session_ticket', () => {
      writeConfig(dir, { surface: false, file: false });
      const sessionId = freshSession('done-pass');
      const boundTicket = writeTicket(dir, 'CODONE');
      const otherTicket = writeTicket(dir, 'OTHER1');
      bindCodexTicket(dir, sessionId, 'CODONE');

      const result = runHook(dir, { session_id: sessionId, cwd: dir });

      expect(result.status).toBe(0);
      expect(readFileSync(nodePath.join(boundTicket, 'ticket.md'), 'utf8')).toMatch(
        /^status: done$/m,
      );
      expect(readFileSync(nodePath.join(otherTicket, 'ticket.md'), 'utf8')).toMatch(
        /^status: in_progress$/m,
      );
    });

    it('codex-done-gate.TBU1.R1.binds_desktop_post_tool_work_to_the_same_stop_session', () => {
      writeConfig(dir, { surface: false, file: false });
      const threadId = freshSession('desktop-thread');
      const ticket = writeTicket(dir, 'DESKTOP');
      initGitRepo(dir);
      execSync('git add . && git commit -qm fixture', { cwd: dir, stdio: 'pipe' });

      const postTool = runPostToolHook(
        dir,
        {
          tool_name: 'Edit',
          tool_input: { file_path: nodePath.join(ticket, 'ticket.md') },
        },
        { CODEX_THREAD_ID: threadId },
      );
      expect(postTool.status).toBe(0);
      const statePath = nodePath.join(dir, '.project', `quality-state-codex-${threadId}.json`);
      const state = JSON.parse(readFileSync(statePath, 'utf8')) as { activeTicket?: string };
      expect(state.activeTicket).toBe('DESKTOP');

      const stop = runHook(dir, { cwd: dir }, { CODEX_THREAD_ID: threadId });

      expect(stop.status).toBe(0);
      expectNoContinuation(stop);
      expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toMatch(/^status: done$/m);
      expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toMatch(/^phase: done$/m);
    });

    it.each([
      {
        name: 'no verify artifact',
        type: 'task',
        setup: (ticketDirectory: string) => {
          rmSync(nodePath.join(ticketDirectory, 'verify.md'));
        },
      },
      {
        name: 'failed PR scope',
        type: 'task',
        setup: (ticketDirectory: string) => {
          writeFileSync(
            nodePath.join(ticketDirectory, 'verify.md'),
            '# Verify\n\n**PR Scope:** ❌ piggybacked changes\n',
          );
        },
      },
      {
        name: 'incomplete feature scenarios',
        type: 'feature',
        setup: (ticketDirectory: string) => {
          writeFileSync(
            nodePath.join(ticketDirectory, 'test-definitions.md'),
            '## Rule\n- [x] passing case\n- [ ] remaining case\n',
          );
        },
      },
      {
        name: 'missing dependencies',
        type: 'task',
        setup: () => {
          writeFileSync(nodePath.join(dir, 'package.json'), '{"packageManager":"bun@1.3.14"}\n');
          writeFileSync(nodePath.join(dir, 'bun.lock'), '\n');
        },
      },
      {
        name: 'stale dependencies',
        type: 'task',
        setup: () => {
          mkdirSync(nodePath.join(dir, 'node_modules'));
          writeFileSync(nodePath.join(dir, 'package.json'), '{"packageManager":"bun@1.3.14"}\n');
          writeFileSync(nodePath.join(dir, 'bun.lock'), '\n');
          const past = new Date(Date.now() - 60_000);
          utimesSync(nodePath.join(dir, 'node_modules'), past, past);
        },
      },
      {
        name: 'failed test execution',
        type: 'task',
        setup: () => {
          writeFileSync(
            nodePath.join(dir, 'package.json'),
            '{"packageManager":"bun@1.3.14","scripts":{"test":"false"}}\n',
          );
          writeFileSync(nodePath.join(dir, 'bun.lock'), '\n');
          mkdirSync(nodePath.join(dir, 'node_modules'));
        },
      },
    ])('codex-done-gate.TBU1.R2.blocks_and_preserves_state_for $name', ({ type, setup }) => {
      writeConfig(dir, { surface: false, file: false });
      const sessionId = freshSession('done-evidence-failure');
      const ticket = writeTicket(dir, 'BLOCKED', { type });
      bindCodexTicket(dir, sessionId, 'BLOCKED');
      setup(ticket);
      const verdict = evaluateFixtureEvidence(dir, ticket, type);

      const result = runHook(
        dir,
        { session_id: sessionId, cwd: dir },
        { SAFEWORD_CLI: nodePath.join(SAFEWORD_ROOT, 'packages/cli/src/cli.ts') },
      );
      const output = JSON.parse(result.stdout.trim()) as { decision?: string; reason?: string };

      expect(verdict.ok).toBe(false);
      expect(output).toEqual({ decision: 'block', reason: verdict.reason });
      expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toMatch(
        /^status: in_progress$/m,
      );
      expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toMatch(/^phase: done$/m);
    });

    it.each([
      {
        name: 'no session-bound ticket',
        setup: () => {
          writeTicket(dir, 'OTHER1');
          return { boundId: undefined, expectedStatus: undefined };
        },
      },
      {
        name: 'a session-bound implement-phase ticket',
        setup: (sessionId: string) => {
          writeTicket(dir, 'OTHER1');
          writeTicket(dir, 'NONDONE', { phase: 'implement' });
          bindCodexTicket(dir, sessionId, 'NONDONE');
          return { sessionId, boundId: 'NONDONE', expectedStatus: 'in_progress' };
        },
      },
      {
        name: 'an already-done session-bound ticket',
        setup: (sessionId: string) => {
          writeTicket(dir, 'OTHER1');
          writeTicket(dir, 'ALREADY', { status: 'done' });
          bindCodexTicket(dir, sessionId, 'ALREADY');
          return { sessionId, boundId: 'ALREADY', expectedStatus: 'done' };
        },
      },
    ])('codex-done-gate.TBU1.R1.never_uses_a_fallback_for $name', ({ setup }) => {
      writeConfig(dir, { surface: false, file: false });
      const sessionId = freshSession('done-noneligible');
      const fixture = setup(sessionId);

      const result = runHook(dir, { session_id: sessionId, cwd: dir });

      expectNoContinuation(result);
      expect(
        readFileSync(nodePath.join(dir, '.project/tickets/OTHER1-ticket/ticket.md'), 'utf8'),
      ).toMatch(/^status: in_progress$/m);
      if (fixture.boundId) {
        const boundTicket = readFileSync(
          nodePath.join(dir, '.project', 'tickets', `${fixture.boundId}-ticket`, 'ticket.md'),
          'utf8',
        );
        expect(boundTicket.split('\n')).toContain(`status: ${fixture.expectedStatus}`);
      }
    });

    // The rows above all carry a session id, so their "unbound" means "no state
    // for THIS id". A Codex payload with neither `session_id` nor
    // CODEX_THREAD_ID has no identity at all: `getRunStorageKey` returns null
    // and the state path collapses to the unscoped `quality-state-undefined.json`
    // bucket every id-less hook run shares. Reading another session's active
    // ticket from there and closing it is the lifecycle-mutation fallback
    // spec SWM1.R1 forbids (issue #1425).
    it('codex-done-gate.TBU1.R1.never_mutates_from_the_unscoped_state_bucket', () => {
      writeConfig(dir, { surface: false, file: false });
      const ticket = writeTicket(dir, 'FOREIGN');
      writeFileSync(
        nodePath.join(dir, '.project', 'quality-state-undefined.json'),
        JSON.stringify({
          locSinceCommit: 0,
          lastCommitHash: '',
          activeTicket: 'FOREIGN',
          recentFailures: [],
          incrementedPatterns: [],
        }),
      );

      const result = runHook(dir, { cwd: dir }, { CODEX_THREAD_ID: undefined });

      expect(result.status).toBe(0);
      expectNoContinuation(result);
      expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toMatch(
        /^status: in_progress$/m,
      );
      expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toMatch(/^phase: done$/m);
    });

    it('codex-done-gate.SWM1.R1.keeps_evidence_failure_ahead_of_architecture_and_filing', () => {
      writeConfig(dir, { surface: true, file: true });
      const sessionId = freshSession('done-priority');
      const ticket = writeTicket(dir, 'PRIORITY', { verify: false });
      bindCodexTicket(dir, sessionId, 'PRIORITY');
      spoolDrafts(dir, sessionId, [retroDraft('retro:aaaaaaaaaaaa')]);
      enableArchitectureAdvisory(dir);
      const verdict = evaluateFixtureEvidence(dir, ticket, 'task');

      const result = runHook(dir, { session_id: sessionId, cwd: dir });
      const output = JSON.parse(result.stdout.trim()) as { decision?: string; reason?: string };

      expect(output).toEqual({ decision: 'block', reason: verdict.reason });
      expect(output.reason).not.toContain('Architecture narrative');
      expect(output.reason).not.toContain(CODEX_FILER_SKILL_NAME);
      expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toMatch(
        /^status: in_progress$/m,
      );
    });

    it('codex-done-gate.SWM1.R1.returns_filing_after_success_without_an_advisory', () => {
      writeConfig(dir, { surface: true, file: true });
      const sessionId = freshSession('done-filing-success');
      const ticket = writeTicket(dir, 'FILEOK');
      bindCodexTicket(dir, sessionId, 'FILEOK');
      spoolDrafts(dir, sessionId, [retroDraft('retro:aaaaaaaaaaaa')]);

      const result = runHook(dir, { session_id: sessionId, cwd: dir });
      const output = JSON.parse(result.stdout.trim()) as { decision?: string; reason?: string };

      expect(output.decision).toBe('block');
      expect(output.reason).toContain(CODEX_FILER_SKILL_NAME);
      expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toMatch(/^status: done$/m);
    });

    it('codex-done-gate.SWM1.R1.caches_architecture_advisory_before_success_and_prioritizes_it', () => {
      writeConfig(dir, { surface: true, file: true });
      const sessionId = freshSession('done-architecture-success');
      const ticket = writeTicket(dir, 'ARCHOK');
      bindCodexTicket(dir, sessionId, 'ARCHOK');
      spoolDrafts(dir, sessionId, [retroDraft('retro:aaaaaaaaaaaa')]);
      enableArchitectureAdvisory(dir);

      const result = runHook(dir, { session_id: sessionId, cwd: dir });
      const output = JSON.parse(result.stdout.trim()) as { decision?: string; reason?: string };

      expect(output).toMatchObject({ decision: 'block' });
      expect(output.reason).toContain('Architecture narrative');
      expect(output.reason).not.toContain(CODEX_FILER_SKILL_NAME);
      expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toMatch(/^status: done$/m);
    });

    it('codex-done-gate.SWM1.R1.retains_unbound_architecture_advice_without_transition', () => {
      writeConfig(dir, { surface: false, file: false });
      const ticket = writeTicket(dir, 'GLOBAL1');
      enableArchitectureAdvisory(dir);

      const result = runHook(dir, { session_id: freshSession('unbound-advisory'), cwd: dir });
      const output = JSON.parse(result.stdout.trim()) as { decision?: string; reason?: string };

      expect(output).toMatchObject({ decision: 'block' });
      expect(output.reason).toContain('Architecture narrative');
      expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toMatch(
        /^status: in_progress$/m,
      );
      expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toMatch(/^phase: done$/m);
    });

    it.each([
      { name: 'successful transition', verify: true },
      { name: 'evidence-failure block', verify: false },
    ])('codex-done-gate.SWM1.R1.extracts_before_the_$name', ({ verify }) => {
      writeConfig(dir, { surface: true, file: false });
      installFakeLocalCli(dir);
      const sessionId = freshSession('done-extraction-order');
      const ticket = writeTicket(dir, 'RETROORD', { verify });
      bindCodexTicket(dir, sessionId, 'RETROORD');
      const transcript = writeCodexRollout(dir, 'substantial.jsonl', 8);
      const result = runHook(
        dir,
        { session_id: sessionId, transcript_path: transcript, cwd: dir },
        { RECORD_PATH: recordPath, TICKET_PATH: nodePath.join(ticket, 'ticket.md') },
      );

      const record = readRecord(recordPath);
      expect(record.ticketContent).toMatch(/^status: in_progress$/m);
      expect(record.ticketContent).toMatch(/^phase: done$/m);
      if (verify) {
        expectNoContinuation(result);
        expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toMatch(/^status: done$/m);
      } else {
        const verdict = evaluateFixtureEvidence(dir, ticket, 'task');
        expect(JSON.parse(result.stdout.trim())).toEqual({
          decision: 'block',
          reason: verdict.reason,
        });
        expect(readFileSync(nodePath.join(ticket, 'ticket.md'), 'utf8')).toMatch(
          /^status: in_progress$/m,
        );
      }
    });

    it('codex-done-gate.SWM1.R2.changes_only_ticket_lifecycle_without_git_ownership', () => {
      writeConfig(dir, { surface: false, file: false });
      const sessionId = freshSession('done-git-boundary');
      writeTicket(dir, 'GITSAFE');
      bindCodexTicket(dir, sessionId, 'GITSAFE');
      initGitRepo(dir);
      execSync('git add . && git commit -qm base', { cwd: dir, stdio: 'pipe' });
      const headBefore = execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8' }).trim();

      const result = runHook(dir, { session_id: sessionId, cwd: dir });
      const changedPaths = execSync('git diff --name-only', { cwd: dir, encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(Boolean);

      expectNoContinuation(result);
      expect(changedPaths).toEqual(['.project/tickets/GITSAFE-ticket/ticket.md']);
      expect(execSync('git diff --cached --name-only', { cwd: dir, encoding: 'utf8' }).trim()).toBe(
        '',
      );
      expect(execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8' }).trim()).toBe(
        headBefore,
      );
      const ticketDiff = execSync('git diff -- .project/tickets/GITSAFE-ticket/ticket.md', {
        cwd: dir,
        encoding: 'utf8',
      });
      expect(ticketDiff).toContain('-status: in_progress');
      expect(ticketDiff).toContain('+status: done');
      expect(ticketDiff).not.toContain('-phase:');
      expect(ticketDiff).not.toContain('+phase:');
    });
  });
});
