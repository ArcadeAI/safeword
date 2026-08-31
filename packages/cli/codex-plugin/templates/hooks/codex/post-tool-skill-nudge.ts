#!/usr/bin/env bun
// Safeword: Codex PostToolUse adapter for the language-skill nudge.
//
// Codex PostToolUse supports hookSpecificOutput.additionalContext (GA) — the
// SAME output shape the standalone post-tool-skill-nudge.ts hook already emits.
// So this adapter only translates Codex INPUT (notably apply_patch, whose target
// path is embedded in the patch text) into the Claude-shaped input the hook
// understands, runs it per target, and aggregates every valid nudge. Fail-open:
// no target / no nudge → exit 0 with no output.

import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type CodexHookInput,
  runClaudeHookAsCodex,
  translateCodexInputToClaudeInputs,
} from './pre-tool-quality-helpers.ts';

async function readInput(): Promise<CodexHookInput | undefined> {
  try {
    return JSON.parse(await Bun.stdin.text()) as CodexHookInput;
  } catch {
    return undefined;
  }
}

function postToolAdditionalContext(stdout: string | undefined): string | undefined {
  try {
    const output = JSON.parse(stdout ?? '') as {
      hookSpecificOutput?: { hookEventName?: string; additionalContext?: unknown };
    };
    const context = output.hookSpecificOutput?.additionalContext;
    return output.hookSpecificOutput?.hookEventName === 'PostToolUse' && typeof context === 'string'
      ? context
      : undefined;
  } catch {
    return undefined;
  }
}

const input = await readInput();
if (!input) process.exit(0);

const translatedInputs = translateCodexInputToClaudeInputs(input);
if (translatedInputs.length === 0) process.exit(0);

const hookDirectory = nodePath.dirname(fileURLToPath(import.meta.url));
const claudeHookPath = nodePath.join(hookDirectory, '..', 'post-tool-skill-nudge.ts');

const contexts: string[] = [];
for (const translated of translatedInputs) {
  const result = runClaudeHookAsCodex(claudeHookPath, translated);
  const context = postToolAdditionalContext(result.stdout);
  if (context !== undefined) contexts.push(context);
}

if (contexts.length > 0) {
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: contexts.join('\n\n'),
      },
    })}\n`,
  );
}
