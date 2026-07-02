#!/usr/bin/env bun
// Safeword: Codex Stop adapter — composes the two turn-end continuation nudges
// that each PR wired onto Codex Stop (merge of #601 retro + #605 architecture drift):
//   1. architecture-drift advisory: when done-phase work moved the generated
//      architecture doc, point the agent at the drift.
//   2. retro auto-trigger (53DQJZ): at most once per SUBSTANTIAL session, point the
//      agent at the retro pipeline.
// Codex Stop is a continuation surface (`decision:"block"` opens a follow-up prompt)
// and only ONE continuation fits per turn, so when both fire their reasons are JOINED
// into a single block rather than one clobbering the other. Silent and fail-open
// paths emit valid JSON `{}` (no decision) — never empty — so any downstream parse of
// the Stop output holds; `{}` and empty are equivalent "no continuation" to Codex.
//
// Reuses the shared retro core via injection seams:
//   - countToolUsesCodex — Codex rollout shape (function_call / exec_command_begin /
//     mcp_tool_call_begin), NOT Claude's tool_use.
//   - resolveCodexSessionId — session-stable id (payload session_id / CODEX_THREAD_ID).

import { existsSync } from 'node:fs';

import { getActiveTicket } from '../lib/active-ticket.ts';
import { architectureDocumentNudgeForProject } from '../lib/architecture-document-nudge.ts';
import { readSessionActiveTicket } from '../lib/quality-state.ts';
import { resolveRunIdentity } from '../lib/run-identity.ts';
import { installCrashCapture, readSelfReportConfig } from '../lib/self-report.ts';
import {
  countToolUsesCodex,
  decideRetroAvailableNudge,
  resolveCodexSessionId,
  type RetroTriggerInput,
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

/** Architecture-drift advisory when done-phase work moved the generated doc, else null. */
function architectureNudge(projectDirectory: string, input: CodexStopInput): string | null {
  if (!isDonePhaseWork(projectDirectory, input)) return null;
  return architectureDocumentNudgeForProject(projectDirectory);
}

/** Retro-available nudge for a substantial session (self-report surfacing on), else undefined. */
function retroNudge(projectDirectory: string, input: CodexStopInput): string | undefined {
  if (!readSelfReportConfig(projectDirectory).surface) return undefined;
  return decideRetroAvailableNudge(input, {
    env: process.env,
    countToolUses: countToolUsesCodex,
    resolveSessionId: resolveCodexSessionId,
  });
}

async function main(): Promise<string> {
  let input: CodexStopInput;
  try {
    input = (await Bun.stdin.json()) as CodexStopInput;
  } catch {
    return SILENT; // malformed stdin → fail open with valid JSON
  }

  // Re-entry guard (from the drift nudge). Intentionally covers BOTH nudges: if a
  // retro first becomes substantial only on a continuation-created re-entry stop it
  // is skipped this turn, but retro's per-session sentinel + cross-session ledger
  // self-heal on the next no-edit stop (same accepted trade-off as cursor/stop.ts).
  if (input.stop_hook_active === true) return SILENT;

  const projectDirectory = input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  if (!existsSync(`${projectDirectory}/.safeword`)) return SILENT;

  const reasons = [
    architectureNudge(projectDirectory, input),
    retroNudge(projectDirectory, input),
  ].filter((reason): reason is string => Boolean(reason));
  if (reasons.length === 0) return SILENT;

  return JSON.stringify({ decision: 'block', reason: reasons.join('\n\n') });
}

let output = SILENT;
try {
  output = await main();
} catch {
  output = SILENT; // self-observation must never break the Codex turn
}
process.stdout.write(`${output}\n`);
process.exit(0);
