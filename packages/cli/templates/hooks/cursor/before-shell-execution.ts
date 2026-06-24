#!/usr/bin/env bun
// Safeword: Cursor beforeShellExecution adapter — blocking commit gate.
//
// Fires before any shell command. Translates the command into the Claude gate's
// `Bash` shape, spawns pre-tool-quality.ts as the source of truth, and maps a
// denial onto Cursor's { permission: 'deny' } decision. The gate's Bash branch
// enforces the REFACTOR commit gate (a refactor commit may not touch test files).

import { existsSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type ClaudeGateInput,
  type CursorShellInput,
  claudeDenialReason,
  runClaudeHook,
  toCursorDecision,
} from './gate-adapter.ts';

async function readInput(): Promise<CursorShellInput> {
  try {
    return (await Bun.stdin.json()) as CursorShellInput;
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

const command = input.command ?? '';
if (command === '' || !existsSync('.safeword')) {
  emitAllowAndExit();
}

const translated: ClaudeGateInput = {
  session_id: input.conversation_id,
  hook_event_name: 'PreToolUse',
  tool_name: 'Bash',
  tool_input: { command },
};

const hookDirectory = nodePath.dirname(fileURLToPath(import.meta.url));
const claudeHookPath = nodePath.join(hookDirectory, '..', 'pre-tool-quality.ts');

const reason = claudeDenialReason(runClaudeHook(claudeHookPath, translated));
process.stdout.write(JSON.stringify(toCursorDecision(reason)) + '\n');
process.exit(0);
