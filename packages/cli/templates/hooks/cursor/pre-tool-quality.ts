#!/usr/bin/env bun
// Safeword: Cursor preToolUse adapter — blocking edit gate.
//
// Wired with a `Write` matcher so it only fires on file edits (Cursor has no
// Edit/MultiEdit — every edit is `Write`). Shell commands are gated separately by
// before-shell-execution.ts. Translates the Cursor payload into Claude's shape,
// spawns the real gate (pre-tool-quality.ts) as the source of truth, and maps any
// denial onto Cursor's { permission: 'deny' } decision. Enforces the
// implement-phase test-definitions gate and the LOC blast-radius gate.

import { existsSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type ClaudeGateInput,
  type CursorPreToolInput,
  decideFromGate,
  extractFilePath,
  mapCursorToolName,
  runClaudeHook,
} from './gate-adapter.ts';

async function readInput(): Promise<CursorPreToolInput> {
  try {
    return (await Bun.stdin.json()) as CursorPreToolInput;
  } catch {
    return {};
  }
}

function emitAllowAndExit(): never {
  process.stdout.write(JSON.stringify({ permission: 'allow' }) + '\n');
  process.exit(0);
}

const input = await readInput();
const workspace = input.workspace_roots?.[0];
if (workspace) process.chdir(workspace);

// Only the edit tool is gated here. Anything else (or no .safeword) is allowed.
const claudeTool = mapCursorToolName(input.tool_name);
if (claudeTool !== 'Write' || !existsSync('.safeword')) {
  emitAllowAndExit();
}

const filePath = extractFilePath(input.tool_input);
if (!filePath) emitAllowAndExit();

// Pass the original tool_input through (so content-aware checks still see their
// fields) with a normalized file_path the gate is guaranteed to read.
const translated: ClaudeGateInput = {
  session_id: input.conversation_id,
  hook_event_name: 'PreToolUse',
  tool_name: 'Write',
  tool_input: { ...input.tool_input, file_path: filePath },
};

const hookDirectory = nodePath.dirname(fileURLToPath(import.meta.url));
const claudeHookPath = nodePath.join(hookDirectory, '..', 'pre-tool-quality.ts');

// Fail-closed: a gate that crashed or never started denies the edit (ANAXG4).
const decision = decideFromGate(runClaudeHook(claudeHookPath, translated));
process.stdout.write(JSON.stringify(decision) + '\n');
process.exit(0);
