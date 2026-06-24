#!/usr/bin/env bun
// Safeword: Cursor preToolUse adapter — blocking edit gate.
//
// Wired with a `Write` matcher so it only fires on file edits (Cursor has no
// Edit/MultiEdit — every edit is `Write`). Shell commands are gated separately by
// before-shell-execution.ts. Translates the Cursor payload into Claude's shape,
// spawns the real gate (pre-tool-quality.ts) as the source of truth, and maps any
// denial onto Cursor's { permission: 'deny' } decision. Enforces the
// implement-phase test-definitions gate and the LOC blast-radius gate.

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateDoneEvidence } from '../lib/done-gate.ts';
import {
  type ClaudeGateInput,
  type CursorDecision,
  type CursorPreToolInput,
  decideFromGate,
  detectDoneTransition,
  extractFilePath,
  extractWriteContent,
  mapCursorToolName,
  parseTicketType,
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

// Done-edit gate (AKNWZK): Cursor's `stop` cannot block, so the done gate that
// lives in Claude's Stop hook is enforced here instead — at the edit that flips a
// ticket.md to `status: done`. "Full" enforcement: evaluateDoneEvidence runs the
// test suite (the one artifact prose can't fake) plus the verify.md/scenario
// checks, sharing its logic with the Stop gate via lib/done-gate.ts (no drift).
if (nodePath.basename(filePath) === 'ticket.md') {
  const proposedContent = extractWriteContent(input.tool_input);
  if (detectDoneTransition(proposedContent)) {
    const ticketDir = nodePath.resolve(nodePath.dirname(filePath));
    // Type comes from the proposed frontmatter; fall back to the on-disk ticket
    // (the closing edit rarely changes `type`) so features still require scenarios.
    let ticketType = parseTicketType(proposedContent);
    if (!ticketType) {
      const onDiskTicket = nodePath.join(ticketDir, 'ticket.md');
      if (existsSync(onDiskTicket))
        ticketType = parseTicketType(readFileSync(onDiskTicket, 'utf8'));
    }

    const verdict = evaluateDoneEvidence({ projectDir: process.cwd(), ticketDir, ticketType });
    if (!verdict.ok) {
      const denial: CursorDecision = {
        permission: 'deny',
        user_message: verdict.reason,
        agent_message: verdict.reason,
      };
      process.stdout.write(JSON.stringify(denial) + '\n');
      process.exit(0);
    }
    // Evidence present — allow. ticket.md is a meta path the edit gate permits
    // anyway, so there is nothing further to check.
    emitAllowAndExit();
  }
}

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
