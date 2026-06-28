#!/usr/bin/env bun
// Safeword: Codex Stop adapter for the retro auto-trigger (ticket 53DQJZ).
//
// Codex's Stop hook fires at turn-end while the session is alive and hands a
// turn-scoped payload that includes `transcript_path` (the Codex rollout JSONL).
// At most once per SUBSTANTIAL session, this emits a {decision:"block", reason}
// continuation whose reason points the agent at the retro pipeline — the Codex
// analogue of the Claude stop-retro additionalContext nudge.
//
// It reuses the shared core (sentinel, orchestration) via injection seams:
//   - countToolUsesCodex  — Codex rollout shape ({type,payload}: function_call /
//     exec_command_begin / mcp_tool_call_begin), NOT Claude's tool_use.
//   - resolveCodexSessionId — session-stable id (payload session_id / CODEX_THREAD_ID).
//
// Codex Stop requires valid JSON output, so the silent and fail-open paths emit
// `{}` (no decision) rather than nothing. Best-effort: never wrongly continues.

import { readSelfReportConfig } from '../lib/self-report.ts';
import {
  countToolUsesCodex,
  decideRetroNudge,
  resolveCodexSessionId,
  type RetroTriggerInput,
} from '../lib/retro-trigger.ts';

interface CodexStopInput extends RetroTriggerInput {
  cwd?: string;
}

// Codex Stop requires JSON output; `{}` is the valid "no continuation" response.
const SILENT = '{}';

async function main(): Promise<string> {
  let input: CodexStopInput;
  try {
    input = (await Bun.stdin.json()) as CodexStopInput;
  } catch {
    return SILENT; // malformed stdin → fail open with valid JSON
  }

  const projectDirectory = input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  if (!readSelfReportConfig(projectDirectory).surface) return SILENT;

  const reason = decideRetroNudge(input, {
    env: process.env,
    countToolUses: countToolUsesCodex,
    resolveSessionId: resolveCodexSessionId,
  });
  if (!reason) return SILENT;

  return JSON.stringify({ decision: 'block', reason });
}

let output = SILENT;
try {
  output = await main();
} catch {
  output = SILENT; // self-observation must never break the Codex turn
}
process.stdout.write(`${output}\n`);
process.exit(0);
