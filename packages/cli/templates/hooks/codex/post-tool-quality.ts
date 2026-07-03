#!/usr/bin/env bun
// Safeword: Codex PostToolUse adapter — maintains quality state.
//
// The LOC blast-radius gate and the review-stamp/session-context plumbing read
// per-session state (LOC since last commit, active ticket binding,
// commit-clears-gate) that is written by the Claude post-tool-quality.ts
// accumulator. Codex doesn't run that Claude hook, so this adapter translates
// the Codex payload (notably apply_patch, whose target paths are embedded in
// the patch text) and spawns it as the source of truth after each edit/shell.
// Mirrors the Cursor postToolUse adapter; keyed on session_id to match the
// PreToolUse adapter's `codex-<id>` state key.
//
// Every translated target runs (each updates state); any review nudge the
// accumulator emits is forwarded verbatim — Codex PostToolUse shares Claude's
// hookSpecificOutput.additionalContext output shape.

import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type ClaudeHookInput,
  type CodexHookInput,
  translateCodexInputToClaudeInputs,
} from './pre-tool-quality-helpers.ts';
import { installCrashCapture } from '../lib/self-report.ts';

installCrashCapture('codex-post-tool-quality', undefined, 'codex');

async function readInput(): Promise<CodexHookInput | undefined> {
  try {
    return JSON.parse(await Bun.stdin.text()) as CodexHookInput;
  } catch {
    return undefined;
  }
}

function runClaudeHook(claudeHookPath: string, translated: ClaudeHookInput) {
  return spawnSync('bun', [claudeHookPath], {
    cwd: process.cwd(),
    input: JSON.stringify(translated),
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
      SAFEWORD_AGENT_RUNTIME: 'codex',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

const input = await readInput();
if (!input) process.exit(0);

const translatedInputs = translateCodexInputToClaudeInputs(input);
if (translatedInputs.length === 0) process.exit(0);

const hookDirectory = nodePath.dirname(fileURLToPath(import.meta.url));
const claudeHookPath = nodePath.join(hookDirectory, '..', 'post-tool-quality.ts');

// Run ALL targets — each spawn accumulates state — then forward the first
// non-empty additionalContext payload.
const outputs = translatedInputs.map(
  translated => runClaudeHook(claudeHookPath, translated).stdout ?? '',
);
const firstOutput = outputs.find(output => output.trim() !== '');
if (firstOutput !== undefined) {
  process.stdout.write(firstOutput);
}

process.exit(0);
