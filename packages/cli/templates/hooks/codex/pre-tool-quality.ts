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
import {
  commandInvokesWriteReviewStamp,
  parseRecordSkillInvocationCommand,
  rememberCodexReviewStampIdentity,
  rememberCodexRunIdentity,
} from '../lib/cursor-run-identity.ts';
import { installCrashCapture } from '../lib/self-report.ts';

installCrashCapture('codex-pre-tool-quality', undefined, 'codex');

const EXIT_CODE_DENY_MODE = 'exit-code';
const CLAUDE_EXPLAIN_HINT = 'Run `/explain` for a plain-English version of this block.';
const CODEX_EXPLAIN_HINT = 'Run `$explain` for a plain-English version of this block.';

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

function formatCodexReason(reason: string): string {
  return reason.replaceAll(CLAUDE_EXPLAIN_HINT, CODEX_EXPLAIN_HINT);
}

function runClaudeHook(claudeHookPath: string, translated: ClaudeHookInput) {
  return spawnSync('bun', [claudeHookPath], {
    cwd: process.cwd(),
    input: JSON.stringify(translated),
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
      // Authoritative agent attribution for the spawned hook: it runs under Codex,
      // not Claude, even though we set CLAUDE_PROJECT_DIR for its path resolution.
      // This same var is what self-report's detectAgent reads.
      SAFEWORD_AGENT_RUNTIME: 'codex',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

// Resolve the project root the same way the record-skill-invocation.ts fallback
// command does (`${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel || pwd)}`),
// so the cache the helper reads back lands at the matching namespace root even
// when Codex runs this hook from a subdirectory of the repo.
function resolveProjectRoot(): string {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  const toplevel = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  const root = toplevel.status === 0 ? (toplevel.stdout ?? '').trim() : '';
  return root.length > 0 ? root : process.cwd();
}

const input = await readInput();
if (!input) process.exit(0);

// Gate-proof bridge: Codex exposes session_id only to this hook, not to the
// record-skill-invocation.ts command it precedes. Stash it in a short-lived,
// per-skill cache so the helper can bind the gate proof to the current session
// (mirrors the Cursor beforeShellExecution bridge). The cache must land at the
// SAME namespace root the helper resolves from, so derive the project root the
// way the helper command does — CLAUDE_PROJECT_DIR, else the git toplevel, else
// cwd — never the raw hook cwd, which can be a subdirectory of the repo.
const proofCommand = parseRecordSkillInvocationCommand(input.tool_input?.command ?? '');
if (proofCommand !== undefined) {
  rememberCodexRunIdentity({
    projectDirectory: resolveProjectRoot(),
    sessionId: input.session_id,
    skillName: proofCommand.skillName,
  });
}

const translatedInputs = translateCodexInputToClaudeInputs(input);
if (translatedInputs.length === 0) process.exit(0);

const hookDirectory = nodePath.dirname(fileURLToPath(import.meta.url));
const claudeHookPath = nodePath.join(hookDirectory, '..', 'pre-tool-quality.ts');

const results = translatedInputs.map(translated => runClaudeHook(claudeHookPath, translated));

for (const result of results) {
  const reason = denialReasonFromHookOutput(result.stdout ?? '');
  if (reason === undefined) continue;
  const codexReason = formatCodexReason(reason);

  if (process.env.SAFEWORD_CODEX_DENY_MODE === EXIT_CODE_DENY_MODE) {
    console.error(codexReason);
    process.exit(2);
  }

  process.stdout.write(formatCodexReason(result.stdout ?? ''));
  if (result.stderr !== '') process.stderr.write(formatCodexReason(result.stderr ?? ''));
  process.exit(result.status ?? 0);
}

for (const result of results) {
  writeHookOutput(result);
}

const failedResult = results.find(result => (result.status ?? 0) !== 0);

// Same one-step bridge for write-review-stamp.ts (#630): the stamp helper's
// process env has no run identity on Codex, so stash the session id right
// before its command runs. Armed only after the gate allowed the command AND
// ran cleanly (mirroring the Cursor adapter) so neither a denied stamp nor a
// crashed gate leaves a live cache another session could adopt. Separate cache
// from the proof bridge, so a chained `record-skill-invocation &&
// write-review-stamp` feeds both consumers.
if (failedResult === undefined && commandInvokesWriteReviewStamp(input.tool_input?.command ?? '')) {
  rememberCodexReviewStampIdentity({
    projectDirectory: resolveProjectRoot(),
    id: input.session_id,
  });
}

process.exit(failedResult?.status ?? 0);
