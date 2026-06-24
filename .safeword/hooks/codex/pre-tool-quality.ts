#!/usr/bin/env bun
// Safeword: Codex PreToolUse adapter for the existing quality gate.
//
// This spike keeps pre-tool-quality.ts as the source of truth and translates
// supported Codex edit payloads into the Claude-shaped hook input it already
// understands.

import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type ClaudeHookInput,
  type CodexHookInput,
  denialReasonFromHookOutput,
  translateCodexInputToClaudeInputs,
} from './pre-tool-quality-helpers.ts';

const EXIT_CODE_DENY_MODE = 'exit-code';

async function readInput(): Promise<CodexHookInput | undefined> {
  try {
    return JSON.parse(await Bun.stdin.text()) as CodexHookInput;
  } catch {
    return undefined;
  }
}

function writeHookOutput(result: { stdout?: string | null; stderr?: string | null }): void {
  if (result.stdout !== '') process.stdout.write(result.stdout ?? '');
  if (result.stderr !== '') process.stderr.write(result.stderr ?? '');
}

function runClaudeHook(claudeHookPath: string, translated: ClaudeHookInput) {
  return spawnSync('bun', [claudeHookPath], {
    cwd: process.cwd(),
    input: JSON.stringify(translated),
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

const input = await readInput();
if (!input) process.exit(0);

const translatedInputs = translateCodexInputToClaudeInputs(input);
if (translatedInputs.length === 0) process.exit(0);

const hookDirectory = nodePath.dirname(fileURLToPath(import.meta.url));
const claudeHookPath = nodePath.join(hookDirectory, '..', 'pre-tool-quality.ts');

const results = translatedInputs.map(translated => runClaudeHook(claudeHookPath, translated));

for (const result of results) {
  const reason = denialReasonFromHookOutput(result.stdout ?? '');
  if (reason === undefined) continue;

  if (process.env.SAFEWORD_CODEX_DENY_MODE === EXIT_CODE_DENY_MODE) {
    console.error(reason);
    process.exit(2);
  }

  writeHookOutput(result);
  process.exit(result.status ?? 0);
}

for (const result of results) {
  writeHookOutput(result);
}

const failedResult = results.find(result => (result.status ?? 0) !== 0);
process.exit(failedResult?.status ?? 0);
