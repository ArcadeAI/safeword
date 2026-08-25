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
import { evaluateDoneEvidence } from '../lib/done-gate.ts';
import { updateTicketStatus } from '../lib/hierarchy.ts';
import { resolveNamespaceRoot } from '../lib/namespace-root.ts';
import { readSessionActiveTicket } from '../lib/quality-state.ts';
import { recordRetroDebugEvent } from '../lib/retro-debug.ts';
import { decideRetroFilingGate, formatCodexFilingDispatch } from '../lib/retro-filing-gate.ts';
import { RETRO_CHILD_ENV, retroChildArgs } from '../lib/retro-extract.ts';
import { resolveRunIdentity } from '../lib/run-identity.ts';
import { installCrashCapture, readSelfReportConfig } from '../lib/self-report.ts';
import {
  countCompletedToolUsesCodex,
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

interface DoneTransitionResult {
  completed: boolean;
  /** A failed shared evidence verdict that must take response precedence. */
  blockReason?: string;
  /** Captured before the ticket moves out of the advisory's done-phase predicate. */
  architectureAdvisory: string | null;
}

/**
 * Complete only the ticket explicitly bound to this Codex session. The
 * architecture advisory keeps its separate global fallback below; using it here
 * would let an unbound session close another builder's most-recent ticket.
 */
function completeSessionDoneTicket(
  projectDirectory: string,
  input: CodexStopInput,
): DoneTransitionResult {
  const runIdentity = resolveRunIdentity(input, { runtime: 'codex' });
  // No session id and no CODEX_THREAD_ID means no identity at all, and the state
  // path would collapse to the unscoped `quality-state-undefined.json` every
  // id-less hook run shares — whatever ticket it names belongs to some other
  // session. Stop before the read: an unbound session keeps the architecture
  // advisory's global fallback (isDonePhaseWork, above) but is never a
  // lifecycle-mutation fallback. Issue #1425; spec SWM1.R1.
  if (runIdentity.sessionKey === null) {
    return { completed: false, architectureAdvisory: null };
  }
  const ticket = readSessionActiveTicket(projectDirectory, runIdentity);
  if (!ticket?.folder || ticket.status !== 'in_progress' || ticket.phase !== 'done') {
    return { completed: false, architectureAdvisory: null };
  }

  // The advisory is eligible only while the ticket is still in_progress/done.
  // Cache it now, then discard it if evidence fails rather than letting an
  // advisory obscure the remediation the builder must act on.
  const architectureAdvisory = architectureNudge(projectDirectory, input);
  const ticketDirectory = nodePath.join(
    resolveNamespaceRoot(projectDirectory),
    'tickets',
    ticket.folder,
  );
  const verdict = evaluateDoneEvidence({
    projectDir: projectDirectory,
    ticketDir: ticketDirectory,
    ticketType: ticket.type,
  });
  if (!verdict.ok) {
    return {
      completed: false,
      blockReason: verdict.reason ?? 'Done evidence could not be verified.',
      architectureAdvisory: null,
    };
  }

  updateTicketStatus(ticketDirectory, 'done', 'done');
  return { completed: true, architectureAdvisory };
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
    countCompletedToolUses: countCompletedToolUsesCodex,
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
  const offsetState = pendingOffsetState;
  const ok = result.status === 0 && !result.error && offsetState !== undefined;
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
  if (!ok || !offsetState) return;

  try {
    writeOffsetState(offsetState.sessionId, offsetState.state, offsetState.baseDirectory);
    recordRetroDebugEvent({
      event: 'codex_stop_offset_write',
      sessionId: offsetState.sessionId,
      ok: true,
    });
  } catch {
    recordRetroDebugEvent({
      event: 'codex_stop_offset_write',
      sessionId: offsetState.sessionId,
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

  const completion = completeSessionDoneTicket(projectDirectory, input);
  if (completion.blockReason) {
    return JSON.stringify({ decision: 'block', reason: completion.blockReason });
  }

  // A successful completion uses the advisory captured before status changed;
  // unbound/noneligible sessions keep the adapter's existing advisory fallback.
  const reason = completion.completed
    ? completion.architectureAdvisory
    : architectureNudge(projectDirectory, input);
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

let output: string;
try {
  output = await main();
} catch {
  output = SILENT; // self-observation must never break the Codex turn
}
process.stdout.write(`${output}\n`);
process.exit(0);
