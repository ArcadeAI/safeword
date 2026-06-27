#!/usr/bin/env bun
// Safeword: Cursor postToolUse adapter for the language-skill nudge.
//
// Cursor's `afterFileEdit` is fire-and-forget (no output → can't inject context),
// so the nudge rides `postToolUse`, whose `additional_context` field is the
// documented way to inject context after a tool result. This adapter translates
// the Cursor postToolUse payload into the Claude-shaped input the standalone
// `post-tool-skill-nudge.ts` hook already understands, runs it, and forwards its
// `hookSpecificOutput.additionalContext` as Cursor `additional_context`.
// Fail-open: any miss emits {} (no context), never blocks the edit.

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

// Claude PostToolUse additionalContext → Cursor additional_context.
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
if (workspace) {
  process.chdir(workspace);
  // Pin the spawned Claude hook's project root to the Cursor workspace. Without
  // this, runClaudeHook falls back to `CLAUDE_PROJECT_DIR ?? cwd`, so a stale
  // CLAUDE_PROJECT_DIR exported in the environment would silently point the hook
  // at the wrong project and the nudge would never fire.
  process.env.CLAUDE_PROJECT_DIR = workspace;
}

const claudeTool = mapCursorToolName(input.tool_name);
if (!claudeTool || !existsSync('.safeword')) emitAndExit({});

const filePath = extractFilePath(input.tool_input);
const translated: ClaudeGateInput = {
  session_id: input.conversation_id,
  // ClaudeGateInput types this as the literal 'PreToolUse' (the skill-nudge hook
  // ignores the field); match the type rather than introduce a mismatch.
  hook_event_name: 'PreToolUse',
  tool_name: claudeTool,
  tool_input: filePath ? { ...input.tool_input, file_path: filePath } : { ...input.tool_input },
};

const hookDirectory = nodePath.dirname(fileURLToPath(import.meta.url));
const claudeHookPath = nodePath.join(hookDirectory, '..', 'post-tool-skill-nudge.ts');

emitAndExit(translatePostOutput(runClaudeHook({ claudeHookPath, input: translated }).stdout));
