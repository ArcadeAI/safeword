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

// Cursor's `Write` tool_input field name for the path is not documented, so accept
// the plausible spellings. The gate only needs the path to decide; content fields
// are passed through untouched for the checks that use them.
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

/**
 * Spawn a Claude source-of-truth hook with the translated input and return its
 * stdout. `CLAUDE_PROJECT_DIR` is set so the gate resolves project state from the
 * Cursor workspace root. Returns '' if the spawn fails — callers treat that as
 * allow (fail-open).
 */
export function runClaudeHook(claudeHookPath: string, input: ClaudeGateInput): string {
  const result = spawnSync('bun', [claudeHookPath], {
    cwd: process.cwd(),
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR ?? process.cwd() },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return result.stdout ?? '';
}
