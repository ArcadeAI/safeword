#!/usr/bin/env bun
// Safeword: Codex Stop adapter for turn-end work.
//
// Three behaviors share one Stop hook:
//   1. Architecture-drift advisory: may emit a Codex continuation
//      (`decision:"block"`) during done-phase work.
//   2. Retro extraction: runs synchronously and invisibly for substantial Codex
//      sessions; any unfiled drafts surface later through UserPromptSubmit.
//   3. Retro FILING gate (#628/GH628F): when extraction (this stop or an earlier
//      one) left unfiled drafts spooled, emit the sanctioned continuation that
//      invokes the packaged safeword:retro-filer skill — extraction itself stays
//      invisible (CDX602); only the rare, attempt-capped filing dispatch may
//      block a stop. The architecture advisory keeps precedence; filing retries
//      at the next stop.
//
// No-op and fail-open paths return valid JSON `{}` so Codex sees no continuation.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { getActiveTicket } from '../lib/active-ticket.ts';
import { architectureDocumentNudgeForProject } from '../lib/architecture-document-nudge.ts';
import { readSessionActiveTicket } from '../lib/quality-state.ts';
import { recordRetroDebugEvent } from '../lib/retro-debug.ts';
import { decideRetroFilingGate, formatCodexFilingDispatch } from '../lib/retro-filing-gate.ts';
import { RETRO_CHILD_ENV, retroChildArgs } from '../lib/retro-extract.ts';
import { resolveRunIdentity } from '../lib/run-identity.ts';
import { installCrashCapture, readSelfReportConfig } from '../lib/self-report.ts';
import {
  countToolUsesCodex,
  decideRetroRun,
  type OffsetState,
  resolveCodexSessionId,
  type RetroTriggerInput,
  writeOffsetState,
} from '../lib/retro-trigger.ts';

installCrashCapture('codex-stop', undefined, 'codex');

interface CodexStopInput extends RetroTriggerInput {
  cwd?: string;
  stop_hook_active?: boolean;
  last_assistant_message?: string | null;
}

// Codex Stop requires valid JSON output; `{}` is the valid "no continuation" response.
const SILENT = '{}';

function isDonePhaseWork(projectDirectory: string, input: CodexStopInput): boolean {
  const runIdentity = resolveRunIdentity(input, { runtime: 'codex' });
  const ticket = readSessionActiveTicket(projectDirectory, runIdentity);
  if (ticket) {
    return ticket.status === 'in_progress' && ticket.phase === 'done';
  }
  return getActiveTicket(projectDirectory).phase === 'done';
}

function architectureNudge(projectDirectory: string, input: CodexStopInput): string | null {
  if (!isDonePhaseWork(projectDirectory, input)) return null;
  return architectureDocumentNudgeForProject(projectDirectory);
}

/**
 * The command that runs the extraction CLI. Prefer the dogfood local CLI, else
 * `bunx safeword@latest`; the spawned CLI then launches `codex exec` through the
 * shared auto-extract boundary.
 */
function resolveExtractCommand(
  projectDirectory: string,
  decision: { transcriptPath: string; windowStart: number; sessionId: string },
): [string, string[]] {
  const retroArgs = retroChildArgs(decision);
  const localCli = nodePath.join(projectDirectory, 'packages/cli/src/cli.ts');
  return existsSync(localCli)
    ? ['bun', [localCli, ...retroArgs]]
    : ['bunx', ['safeword@latest', ...retroArgs]];
}

function argvShape(args: readonly string[]): string[] {
  return args.map(arg => (arg === 'retro' || arg.startsWith('--') ? arg : '<value>'));
}

function runRetroExtraction(projectDirectory: string, input: CodexStopInput): void {
  if (!readSelfReportConfig(projectDirectory).surface) {
    recordRetroDebugEvent({
      event: 'codex_stop_retro_decision',
      outcome: 'skip',
      reason: 'surface_disabled',
    });
    return;
  }

  let pendingOffsetState:
    { sessionId: string; state: OffsetState; baseDirectory: string | undefined } | undefined;
  const decision = decideRetroRun(input, {
    env: process.env,
    countToolUses: countToolUsesCodex,
    resolveSessionId: resolveCodexSessionId,
    onDecision: trace => {
      recordRetroDebugEvent({ event: 'codex_stop_retro_decision', ...trace });
    },
    writeOffsetState: (sessionId, state, baseDirectory) => {
      pendingOffsetState = { sessionId, state, baseDirectory };
    },
  });
  if (!decision) return;

  const [command, args] = resolveExtractCommand(projectDirectory, decision);
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: projectDirectory,
    env: {
      ...process.env,
      SAFEWORD_RETRO_AGENT: 'codex',
      [RETRO_CHILD_ENV]: '1',
    },
    stdio: 'ignore',
    timeout: 600_000,
  });
  const error = result.error as (Error & { code?: string }) | undefined;
  const ok = result.status === 0 && !result.error && pendingOffsetState !== undefined;
  recordRetroDebugEvent({
    event: 'codex_stop_child_exit',
    command: nodePath.basename(command),
    argvShape: argvShape(args),
    status: result.status,
    signal: result.signal,
    errorName: error?.name,
    errorCode: error?.code,
    elapsedMs: Date.now() - startedAt,
    timedOut: error?.code === 'ETIMEDOUT',
    pendingOffsetState: pendingOffsetState !== undefined,
    ok,
  });
  if (!ok) return;

  try {
    writeOffsetState(
      pendingOffsetState.sessionId,
      pendingOffsetState.state,
      pendingOffsetState.baseDirectory,
    );
    recordRetroDebugEvent({
      event: 'codex_stop_offset_write',
      sessionId: pendingOffsetState.sessionId,
      ok: true,
    });
  } catch {
    recordRetroDebugEvent({
      event: 'codex_stop_offset_write',
      sessionId: pendingOffsetState.sessionId,
      ok: false,
    });
    // A state-write failure must not make Stop visible or blocking.
  }
}

async function main(): Promise<string> {
  let input: CodexStopInput;
  try {
    input = (await Bun.stdin.json()) as CodexStopInput;
  } catch {
    return SILENT; // malformed stdin / no stdin -> fail open with valid JSON
  }

  if (input.stop_hook_active === true) return SILENT;

  const projectDirectory = input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  if (!existsSync(`${projectDirectory}/.safeword`)) return SILENT;

  runRetroExtraction(projectDirectory, input);

  const reason = architectureNudge(projectDirectory, input);
  if (reason) return JSON.stringify({ decision: 'block', reason });

  // Filing gate (#628): extraction above is synchronous, so drafts it spooled are
  // already on disk — the same stop can dispatch the filer. Yields to the
  // architecture advisory (one continuation per stop); the gate's attempt budget
  // lets it retry at the next stop.
  // The gate reads selfReport config itself (GH644A): capture gates the
  // tripwire, file gates the dispatch — evaluate unconditionally.
  const sessionId = resolveCodexSessionId(input, process.env);
  const dispatch = sessionId
    ? decideRetroFilingGate(projectDirectory, sessionId, {
        formatDispatch: formatCodexFilingDispatch,
      })
    : undefined;
  recordRetroDebugEvent({
    event: 'codex_stop_filing_gate',
    sessionId,
    dispatch: dispatch !== undefined,
  });
  if (dispatch) return JSON.stringify({ decision: 'block', reason: dispatch });

  return SILENT;
}

let output = SILENT;
try {
  output = await main();
} catch {
  output = SILENT; // self-observation must never break the Codex turn
}
process.stdout.write(`${output}\n`);
process.exit(0);
