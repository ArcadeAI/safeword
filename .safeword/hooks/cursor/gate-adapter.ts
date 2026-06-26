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

/** Fields present on every Cursor agent hook request (the "common schema"). */
export interface CursorBaseInput {
  /** Stable across all turns of a conversation — used as the state key. */
  conversation_id?: string;
  workspace_roots?: string[];
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
  /**
   * True when the gate could not be run to a clean verdict — it failed to spawn
   * (e.g. `bun` missing) or crashed (non-zero exit). The gate always exits 0 for
   * BOTH allow and deny (the verdict travels in stdout), so a non-zero exit can
   * only mean an unhandled crash, never a normal denial. This lets the adapter
   * tell "gate ran and allowed" apart from "gate never produced a verdict".
   */
  failed: boolean;
}

/** Message shown when the gate itself could not run, so the action is fail-closed. */
export const GATE_UNAVAILABLE_REASON =
  'Safeword gate could not run (it crashed or failed to start), so this action was blocked. ' +
  'Check the Hooks output channel, then retry once the gate runs cleanly.';

/**
 * Spawn a Claude source-of-truth hook with the translated input. `CLAUDE_PROJECT_DIR`
 * and `SAFEWORD_AGENT_RUNTIME` are set so the gate resolves project state from
 * the Cursor workspace root and uses the Cursor-scoped run key. Reports both the
 * stdout verdict and whether the gate actually ran — see `ClaudeGateResult`.
 */
export function runClaudeHook(claudeHookPath: string, input: ClaudeGateInput): ClaudeGateResult {
  const result = spawnSync('bun', [claudeHookPath], {
    cwd: process.cwd(),
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
      SAFEWORD_AGENT_RUNTIME: 'cursor',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  // `error` => the process never started; non-zero/null `status` => it crashed.
  const failed = result.error != null || result.status !== 0;
  return { stdout: result.stdout ?? '', failed };
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
  if (result.failed) {
    return {
      permission: 'deny',
      user_message: GATE_UNAVAILABLE_REASON,
      agent_message: GATE_UNAVAILABLE_REASON,
    };
  }
  return toCursorDecision(claudeDenialReason(result.stdout));
}
