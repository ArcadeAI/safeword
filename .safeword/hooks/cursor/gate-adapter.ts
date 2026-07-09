// Safeword: shared translation helpers for the Cursor gate adapters.
//
// Cursor's blocking hooks (preToolUse, beforeShellExecution) speak a different
// dialect than Claude Code, but the *gate logic* lives in one place —
// `pre-tool-quality.ts`. Rather than re-implement (and inevitably drift from)
// that logic, the Cursor adapters translate Cursor's hook payload into the
// Claude-shaped input the gate already understands, spawn it as the source of
// truth, and translate its denial back into Cursor's decision shape. This
// mirrors the existing Codex adapter (`codex/pre-tool-quality.ts`).
//
// These are pure functions so the translation is unit-testable without spawning.

import { spawnSync } from 'node:child_process';

import { detectLedgerWrite } from '../lib/bash-ledger-writes.js';
import { detectBroadProcessKill } from '../lib/process-kill-guard.js';
import nodePath from 'node:path';

import { commandWordIndex, parseShellWords, splitShellSegments } from '../lib/shell-segments.js';

/** Fields present on every Cursor agent hook request (the "common schema"). */
export interface CursorBaseInput {
  /** Stable across all turns of a conversation — used as the state key. */
  conversation_id?: string;
  workspace_roots?: string[];
  // Every Cursor hook carries transcript_path; only hooks receive it (never
  // env), so the adapters stash it for the user-invoked `/retro` command to
  // resolve THIS conversation's transcript (RTSK9C / #624).
  transcript_path?: string;
}

/** Cursor `preToolUse` payload (generic across all tool types). */
export interface CursorPreToolInput extends CursorBaseInput {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

/** Cursor `beforeShellExecution` payload. */
export interface CursorShellInput extends CursorBaseInput {
  command?: string;
  cwd?: string;
}

/** The Claude-shaped input understood by `pre-tool-quality.ts`. */
export interface ClaudeGateInput {
  session_id?: string;
  hook_event_name: 'PreToolUse';
  tool_name: string;
  tool_input: Record<string, unknown>;
}

/** Cursor's permission-decision output for blocking hooks. */
export interface CursorDecision {
  permission: 'allow' | 'deny';
  user_message?: string;
  agent_message?: string;
}

// Cursor names every file edit `Write` (there is no Edit/MultiEdit on Cursor) and
// every shell command `Shell`. The Claude gate keys off `Write` (an EDIT_TOOLS
// member) and `Bash`, so this is the whole mapping we need.
const TOOL_NAME_MAP: Record<string, ClaudeGateInput['tool_name']> = {
  Write: 'Write',
  Shell: 'Bash',
};

/** Translate a Cursor tool name to its Claude equivalent, or undefined if unmapped. */
export function mapCursorToolName(cursorTool: string | undefined): string | undefined {
  return cursorTool ? TOOL_NAME_MAP[cursorTool] : undefined;
}

// Cursor's file-hook docs use `file_path`; keep historical fallbacks after the
// verified name so old or drifted payloads remain readable without taking priority.
const PATH_KEYS = ['file_path', 'path', 'target_file'] as const;

/** Extract the edited file path from a Cursor tool_input, tolerating field-name variants. */
export function extractFilePath(
  toolInput: Record<string, unknown> | undefined,
): string | undefined {
  if (!toolInput) return undefined;
  for (const key of PATH_KEYS) {
    const value = toolInput[key];
    if (typeof value === 'string' && value !== '') return value;
  }
  return undefined;
}

// Cursor's generic preToolUse docs do not publish a Write-specific schema. Current
// Write payloads use `content`; Cursor's file-edit docs use `edits[].new_string`.
// Keep older guessed names after the verified name as tolerant fallbacks.
const CONTENT_KEYS = ['content', 'contents', 'new_string', 'text', 'file_text', 'code'] as const;

/**
 * Extract the proposed file content from a Cursor tool_input, tolerating field-name
 * variants. Falls back to the longest multi-line string value present — a Write's
 * body is far longer than any path/flag field, so this recovers the content even
 * under an unknown field name.
 */
export function extractWriteContent(
  toolInput: Record<string, unknown> | undefined,
): string | undefined {
  if (!toolInput) return undefined;
  for (const key of CONTENT_KEYS) {
    const value = toolInput[key];
    if (typeof value === 'string' && value !== '') return value;
  }
  const editContent = extractNewStringsFromEdits(toolInput.edits);
  if (editContent) return editContent;
  let longest: string | undefined;
  for (const value of Object.values(toolInput)) {
    if (typeof value === 'string' && value.includes('\n')) {
      if (longest === undefined || value.length > longest.length) longest = value;
    }
  }
  return longest;
}

function extractNewStringsFromEdits(edits: unknown): string | undefined {
  if (!Array.isArray(edits)) return undefined;
  const newStrings = edits.flatMap(edit => {
    if (typeof edit !== 'object' || edit === null) return [];
    const value = (edit as Record<string, unknown>).new_string;
    return typeof value === 'string' && value !== '' ? [value] : [];
  });
  if (newStrings.length === 0) return undefined;
  return newStrings.join('\n');
}

export type DoneTransitionStatus = 'done' | 'not_done' | 'unknown';

const STATUS_LINE_PATTERN = /^status:\s*(?<status>.*)$/im;

/**
 * True when the proposed ticket.md content closes the ticket — i.e. its frontmatter
 * sets `status: done`. Marking `phase: done` (entering the done phase to run /verify)
 * is deliberately NOT a transition: that is the step that produces the evidence the
 * gate later checks. Matches the closing edit only.
 */
export function detectDoneTransition(content: string | undefined): boolean {
  return classifyDoneTransition({ content }) === 'done';
}

/**
 * Classify a proposed ticket status line.
 *
 * Deliberate miss-direction (P9K783): no readable content remains fail-open so
 * ordinary ticket work-log saves do not deadlock. This is a close detector, not
 * a ticket status validator: only `status: done` triggers the done gate, and
 * every other readable status remains an ordinary ticket edit.
 */
export function classifyDoneTransition(params: {
  content: string | undefined;
}): DoneTransitionStatus {
  const { content } = params;
  if (!content) return 'unknown';
  const match = STATUS_LINE_PATTERN.exec(content);
  if (!match?.groups) return 'not_done';

  const rawStatus = match.groups.status;
  if (rawStatus === undefined) return 'not_done';

  const normalizedStatus = normalizeFrontmatterScalar(rawStatus);
  if (normalizedStatus === 'done') return 'done';
  return 'not_done';
}

/** Read the `type:` frontmatter value ('feature' | 'task' | ...) from ticket.md content. */
export function parseTicketType(content: string | undefined): string | undefined {
  if (!content) return undefined;
  const match = /^type:\s*["']?(?<type>[A-Za-z]+)/im.exec(content);
  return match?.groups?.type?.toLowerCase();
}

function normalizeFrontmatterScalar(value: string): string {
  return stripYamlInlineComment(value)
    .replace(/^['"](?<inner>.*)['"]$/, '$<inner>')
    .trim()
    .toLowerCase();
}

function stripYamlInlineComment(value: string): string {
  let quote: '"' | "'" | undefined;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === '"' || char === "'") && quote === undefined) {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = undefined;
      continue;
    }
    if (char === '#' && quote === undefined && /\s/.test(value[index - 1] ?? '')) {
      return value.slice(0, index).trim();
    }
  }
  return value.trim();
}

/**
 * Parse the Claude gate's stdout. The gate denies with
 * `{ hookSpecificOutput: { permissionDecision: 'deny', permissionDecisionReason } }`
 * and otherwise emits nothing. Returns the human-readable reason on deny, else
 * undefined (allow). Malformed or empty output is treated as allow (fail-open),
 * matching Cursor's default hook-failure posture.
 */
export function claudeDenialReason(stdout: string): string | undefined {
  if (stdout.trim() === '') return undefined;
  try {
    const parsed = JSON.parse(stdout) as {
      hookSpecificOutput?: { permissionDecision?: unknown; permissionDecisionReason?: unknown };
    };
    if (parsed.hookSpecificOutput?.permissionDecision !== 'deny') return undefined;
    const reason = parsed.hookSpecificOutput.permissionDecisionReason;
    return typeof reason === 'string' ? reason : 'Safeword denied this action.';
  } catch {
    return undefined;
  }
}

/** Build a Cursor decision from a denial reason (undefined reason => allow). */
export function toCursorDecision(reason: string | undefined): CursorDecision {
  if (reason === undefined) return { permission: 'allow' };
  return { permission: 'deny', user_message: reason, agent_message: reason };
}

/** Outcome of spawning the Claude source-of-truth gate. */
export interface ClaudeGateResult {
  /** The gate's stdout (its allow/deny verdict as JSON), or '' on failure. */
  stdout: string;
  /** True when Safeword killed the inner gate because it exceeded its local timeout. */
  timedOut: boolean;
  /**
   * True when the gate could not be run to a clean verdict — it failed to spawn
   * (e.g. `bun` missing), crashed (non-zero exit), or timed out. The gate always
   * exits 0 for BOTH allow and deny (the verdict travels in stdout), so a non-zero
   * exit can only mean an unhandled crash, never a normal denial. This lets the
   * adapter tell "gate ran and allowed" apart from "gate never produced a verdict".
   */
  failed: boolean;
}

const GIT_GLOBAL_OPTIONS_WITH_VALUE = new Set([
  '-C',
  '-c',
  '--config-env',
  '--exec-path',
  '--git-dir',
  '--namespace',
  '--work-tree',
]);

export function requiresFailClosedShellGate(params: { command: string }): boolean {
  const { command } = params;
  // Ledger writes (W42G34, #644 G3) and broad process kills (K4STDR, #773)
  // join git commits as the commands whose verdict must come from the
  // delegated Claude gate rather than fail-open.
  if (detectLedgerWrite(command) !== undefined) return true;
  if (detectBroadProcessKill(command) !== undefined) return true;
  return splitShellSegments(command).some(segment => isGitCommitSegment(parseShellWords(segment)));
}

function isGitCommitSegment(words: string[]): boolean {
  // commandWordIndex skips `VAR=val` assignments and `command`/`env`/
  // `corepack` prefixes (looping, env matched by basename with its flags) so
  // neither `GIT_AUTHOR_NAME=bot git commit` nor `/usr/bin/env git commit`
  // can slip the fail-closed gate. The command word is basename-matched too, so
  // `/usr/bin/git commit` is caught the same as bare `git commit`.
  let index = commandWordIndex(words);
  if (nodePath.basename(words[index] ?? '') !== 'git') return false;

  index += 1;
  while (index < words.length && words[index]?.startsWith('-')) {
    const option = words[index];
    if (option !== undefined && optionTakesSeparateValue(option)) index += 1;
    index += 1;
  }

  return words[index] === 'commit';
}

function optionTakesSeparateValue(option: string): boolean {
  if (option.includes('=')) return false;
  return GIT_GLOBAL_OPTIONS_WITH_VALUE.has(option);
}

/** Message shown when the gate itself could not run, so the action is fail-closed. */
export const GATE_UNAVAILABLE_REASON =
  'Safeword gate could not run (it crashed or failed to start), so this action was blocked. ' +
  'Check the Hooks output channel, then retry once the gate runs cleanly.';

/** Message shown when Safeword returns a controlled block before Cursor cancels the hook. */
export const GATE_TIMEOUT_REASON =
  'Safeword gate took too long to check this shell command, so this command was blocked. ' +
  'Retry once; if it repeats, check the Hooks output channel and temporarily disable the ' +
  'beforeShellExecution entry in .cursor/hooks.json to unblock diagnostics.';

export interface RunClaudeHookOptions {
  claudeHookPath: string;
  input: ClaudeGateInput;
  timeoutMs?: number;
}

/**
 * Spawn a Claude source-of-truth hook with the translated input. `CLAUDE_PROJECT_DIR`
 * and `SAFEWORD_AGENT_RUNTIME` are set so the gate resolves project state from
 * the Cursor workspace root and uses the Cursor-scoped run key. Reports both the
 * stdout verdict and whether the gate actually ran — see `ClaudeGateResult`.
 */
export function runClaudeHook(options: RunClaudeHookOptions): ClaudeGateResult {
  const { claudeHookPath, input, timeoutMs } = options;
  const result = spawnSync('bun', [claudeHookPath], {
    cwd: process.cwd(),
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
      SAFEWORD_AGENT_RUNTIME: 'cursor',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  // `spawnSync` reports timed-out children through `error`; detect it separately
  // so users see a recovery path, not a generic crash.
  const timedOut = (result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT';
  // `error` => the process never started/timed out; non-zero/null `status` => it crashed.
  const failed = result.error != null || result.status !== 0;
  return { stdout: result.stdout ?? '', failed, timedOut };
}

/**
 * Turn a gate run into a Cursor decision, FAIL-CLOSED (ANAXG4). A gate that
 * crashed or never started denies the action rather than silently allowing it —
 * the whole point of the blocking gates. Only a gate that ran cleanly and stayed
 * silent (or said allow) permits the action.
 *
 * This is the safeword posture; Cursor's `failClosed: true` on the hook is the
 * outer backstop for the rarer case where this adapter wrapper itself crashes,
 * times out, or emits invalid JSON.
 */
export function decideFromGate(result: ClaudeGateResult): CursorDecision {
  if (result.timedOut) {
    return toCursorDecision(GATE_TIMEOUT_REASON);
  }
  if (result.failed) {
    return toCursorDecision(GATE_UNAVAILABLE_REASON);
  }
  return toCursorDecision(claudeDenialReason(result.stdout));
}

// The shell-specific decision lives in before-shell-execution.ts: it calls
// `requiresFailClosedShellGate` BEFORE spawning the delegated gate (so non-commit
// commands are allowed without a spawn, avoiding the deadlock) and `decideFromGate`
// AFTER. There is intentionally no combined helper here — keeping the two steps in
// the hook is what lets it skip the spawn entirely for out-of-scope commands.

/**
 * Translate a Claude PostToolUse `hookSpecificOutput.additionalContext` payload
 * into Cursor's `additional_context` field. Returns `{}` (inject nothing) for
 * empty/non-JSON output or a missing/empty context — the shared output side of
 * the Cursor postToolUse adapters (mirrors the input helpers above).
 */
export function translatePostOutput(stdout: string): Record<string, unknown> {
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
