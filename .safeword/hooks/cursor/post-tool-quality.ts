#!/usr/bin/env bun
// Safeword: Cursor postToolUse adapter — maintains quality state.
//
// Wired with a `Write|Shell` matcher. The LOC blast-radius gate enforced by
// pre-tool-quality.ts reads per-session state (LOC since last commit, active
// ticket binding, commit-clears-gate) that is written by post-tool-quality.ts.
// Cursor doesn't run that Claude hook, so this adapter spawns it as the source of
// truth after each edit/shell so the blocking gate has fuel. Keyed on
// conversation_id (stable across turns) to match the preToolUse adapter's key.
// Any review nudge the accumulator emits is forwarded as Cursor additional_context.

import { existsSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type ClaudeGateInput,
  type CursorPreToolInput,
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

function emitAndExit(payload: Record<string, unknown>): never {
  process.stdout.write(JSON.stringify(payload) + '\n');
  process.exit(0);
}

// Translate a Claude PostToolUse additionalContext payload into Cursor's
// additional_context field; returns {} when there is nothing to inject.
function translatePostOutput(stdout: string): Record<string, unknown> {
  if (stdout.trim() === '') return {};
  try {
    const parsed = JSON.parse(stdout) as {
      hookSpecificOutput?: { additionalContext?: unknown };
    };
    const context = parsed.hookSpecificOutput?.additionalContext;
    return typeof context === 'string' && context !== '' ? { additional_context: context } : {};
  } catch {
    return {};
  }
}

const input = await readInput();
const workspace = input.workspace_roots?.[0];
if (workspace) process.chdir(workspace);

const claudeTool = mapCursorToolName(input.tool_name);
if (!claudeTool || !existsSync('.safeword')) emitAndExit({});

const filePath = extractFilePath(input.tool_input);
const translated: ClaudeGateInput = {
  session_id: input.conversation_id,
  hook_event_name: 'PreToolUse',
  tool_name: claudeTool,
  tool_input: filePath ? { ...input.tool_input, file_path: filePath } : { ...input.tool_input },
};

const hookDirectory = nodePath.dirname(fileURLToPath(import.meta.url));
const claudeHookPath = nodePath.join(hookDirectory, '..', 'post-tool-quality.ts');

emitAndExit(translatePostOutput(runClaudeHook(claudeHookPath, translated)));
