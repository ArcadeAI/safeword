#!/usr/bin/env bun
// Safeword: Codex PostToolUse adapter for the language-skill nudge.
//
// Codex PostToolUse supports hookSpecificOutput.additionalContext (GA) — the
// SAME output shape the standalone post-tool-skill-nudge.ts hook already emits.
// So this adapter only translates Codex INPUT (notably apply_patch, whose target
// path is embedded in the patch text) into the Claude-shaped input the hook
// understands, runs it per target, and forwards the first non-empty nudge
// verbatim. Fail-open: no target / no nudge → exit 0 with no output.

import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type ClaudeHookInput,
  type CodexHookInput,
  translateCodexInputToClaudeInputs,
} from './pre-tool-quality-helpers.ts';

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
const claudeHookPath = nodePath.join(hookDirectory, '..', 'post-tool-skill-nudge.ts');

// Run per target; the hook dedups per scenario, so at most one fires. Forward the
// first non-empty additionalContext payload (Codex shares Claude's output shape).
for (const translated of translatedInputs) {
  const result = runClaudeHook(claudeHookPath, translated);
  if ((result.stdout ?? '').trim() !== '') {
    process.stdout.write(result.stdout ?? '');
    process.exit(0);
  }
}

process.exit(0);
