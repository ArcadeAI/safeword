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
  commandInvokesWriteReviewStamp,
  parseRecordSkillInvocationCommands,
  rememberCursorReviewStampIdentity,
  rememberCursorRunIdentity,
} from '../lib/cursor-run-identity.ts';
import { stashCursorTranscript } from '../lib/cursor-state.ts';
import { AUTO_UPGRADE_LOCK_MESSAGE, isAutoUpgradeLockActive } from '../lib/auto-upgrade-lock.ts';
import {
  type ClaudeGateInput,
  type CursorShellInput,
  decideFromGate,
  requiresFailClosedShellGate,
  runClaudeHook,
  toCursorDecision,
} from './gate-adapter.ts';

const SHELL_GATE_TIMEOUT_MS = 8_000;

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

// Stash transcript_path for the user-invoked `/retro` command (RTSK9C / #624).
// This fires on `/retro`'s own bash, keeping THIS conversation's stash freshest.
stashCursorTranscript(input);

if (isAutoUpgradeLockActive({ projectDir: process.cwd() })) {
  process.stdout.write(JSON.stringify(toCursorDecision(AUTO_UPGRADE_LOCK_MESSAGE)) + '\n');
  process.exit(0);
}

// The stamp helper's process env has no run identity on Cursor; stash the
// conversation id right before the command runs (mirrors the proof bridge,
// separate cache — #630).
function stashReviewStampIdentity(): void {
  if (!commandInvokesWriteReviewStamp(command)) return;
  rememberCursorReviewStampIdentity({
    projectDirectory: process.cwd(),
    id: input.conversation_id,
  });
}

const proofCommands = parseRecordSkillInvocationCommands(command, process.cwd(), {
  claudeProjectDirectory: process.env.CLAUDE_PROJECT_DIR,
});
const needsFailClosedGate = requiresFailClosedShellGate({ command });
if (!needsFailClosedGate) {
  if (proofCommands.length > 0) {
    rememberCursorRunIdentity({
      projectDirectory: process.cwd(),
      conversationId: input.conversation_id,
      skillNames: proofCommands.map(proofCommand => proofCommand.skillName),
    });
  }
  stashReviewStampIdentity();
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

// Fail-closed with a local timeout: return Cursor-readable JSON before Cursor's
// own cancellation path can reduce the failure to "Canceled: Canceled".
const decision = decideFromGate(
  runClaudeHook({
    claudeHookPath,
    input: translated,
    timeoutMs: SHELL_GATE_TIMEOUT_MS,
  }),
);
if (decision.permission === 'allow') {
  if (proofCommands.length > 0) {
    rememberCursorRunIdentity({
      projectDirectory: process.cwd(),
      conversationId: input.conversation_id,
      skillNames: proofCommands.map(proofCommand => proofCommand.skillName),
    });
  }
  stashReviewStampIdentity();
}
process.stdout.write(JSON.stringify(decision) + '\n');
process.exit(0);
