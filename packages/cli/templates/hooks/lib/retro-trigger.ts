// Safeword: retro auto-trigger core (ticket FTCQGD).
//
// Shared, agent-neutral core for firing `safeword retro` from a session's
// end-of-turn hook. The Claude `stop-retro.ts` hook wraps this; the Codex
// (53DQJZ) and Cursor (KHYXY4) adapters will reuse the same gate/resolver/
// sentinel/nudge so there is one core, not three.
//
// Design (see the FTCQGD spec): at most once per SUBSTANTIAL session, surface a
// FACT-phrased nudge — never an imperative — telling the agent the retro
// pipeline is available, while the session is still alive (Stop-anchored, not
// SessionEnd, which is killed before async work finishes in cloud and whose
// transcript is deleted on container reclaim). The occurrence ledger (RV9JT4)
// makes re-fires idempotent across sessions; the once-per-session sentinel here
// makes them idempotent within a session.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { tmpdir } from 'node:os';

/**
 * A session is "substantial" — worth a retrospective — once its transcript shows
 * at least this many tool-use events. The transcript itself is the substance
 * measure (no separate counter). Inclusive: exactly this many → substantial.
 * Tunable; pure Q&A sessions (0–N tool uses) stay below it and surface nothing.
 */
export const SUBSTANCE_THRESHOLD = 3;

interface ContentItem {
  type?: string;
}

interface TranscriptEntry {
  type?: string;
  message?: { role?: string; content?: ContentItem[] };
}

/**
 * Sum a per-entry count over each parseable line of a JSONL transcript. Malformed
 * lines are skipped, never thrown — a hook must not crash on a partial transcript.
 * The single home for the trim / split / parse-or-skip skeleton both per-agent
 * counters share; each counter supplies only its per-entry rule.
 */
function sumOverJsonlEntries(text: string, perEntry: (entry: unknown) => number): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  let total = 0;
  for (const line of trimmed.split('\n')) {
    try {
      total += perEntry(JSON.parse(line));
    } catch {
      // Skip malformed JSONL lines silently.
    }
  }
  return total;
}

/**
 * Count tool-use content items across all assistant entries in a Claude Code
 * JSONL transcript (the shape stop-reentry.ts parses).
 */
export function countToolUses(transcriptText: string): number {
  return sumOverJsonlEntries(transcriptText, raw => {
    const content = (raw as TranscriptEntry).message?.content;
    return Array.isArray(content) ? content.filter(item => item?.type === 'tool_use').length : 0;
  });
}

/** A per-agent tool-use counter over a transcript's raw text. */
export type ToolUseCounter = (transcriptText: string) => number;

const CODEX_TOOL_EVENTS = new Set(['function_call', 'exec_command_begin', 'mcp_tool_call_begin']);

/**
 * Count tool events in a Codex rollout JSONL (`{type, payload}` per line). Codex's
 * tool signal is `function_call` / `exec_command_begin` / `mcp_tool_call_begin` —
 * NOT Claude's `message.content[].tool_use`, so Claude's countToolUses would
 * return 0 here. Nesting-tolerant: matches the tool type on either the top-level
 * `type` or `payload.type`, because the exact rollout nesting is NOT yet confirmed
 * by a live Codex spike (deferred — see the 53DQJZ ticket); matching both shapes
 * hedges that uncertainty.
 */
export function countToolUsesCodex(rolloutText: string): number {
  return sumOverJsonlEntries(rolloutText, raw => {
    const entry = raw as { type?: string; payload?: { type?: string } };
    return CODEX_TOOL_EVENTS.has(entry.type ?? '') ||
      CODEX_TOOL_EVENTS.has(entry.payload?.type ?? '')
      ? 1
      : 0;
  });
}

/**
 * Whether the transcript crosses the substance threshold (inclusive `>=`), using
 * the supplied per-agent tool-use counter (defaults to the Claude counter so the
 * Claude path is unchanged).
 */
export function isSubstantial(
  transcriptText: string,
  threshold: number = SUBSTANCE_THRESHOLD,
  counter: ToolUseCounter = countToolUses,
): boolean {
  return counter(transcriptText) >= threshold;
}

/**
 * Sanitize a session id into a single safe filename component, so a hostile or
 * odd id (path separators, `..`) can't make the sentinel escape its base dir.
 * Non-`[\w.-]` characters collapse to `_`.
 */
function sentinelName(sessionId: string): string {
  return `safeword-retro-${sessionId.replace(/[^\w.-]/g, '_')}`;
}

/** Absolute path of the once-per-session sentinel marker for a session id. */
export function sentinelPath(sessionId: string, baseDirectory: string = tmpdir()): string {
  return nodePath.join(baseDirectory, sentinelName(sessionId));
}

/** Whether this session has already surfaced its retro nudge. */
export function hasNudged(sessionId: string, baseDirectory: string = tmpdir()): boolean {
  return existsSync(sentinelPath(sessionId, baseDirectory));
}

/**
 * Record that this session surfaced its retro nudge. Best-effort: a write
 * failure must not break Stop, so the caller treats a throw as "couldn't mark"
 * and simply doesn't re-suppress — never crashes.
 */
export function markNudged(sessionId: string, baseDirectory: string = tmpdir()): void {
  writeFileSync(sentinelPath(sessionId, baseDirectory), `${sessionId}\n`);
}

interface SessionIdEnv {
  CLAUDE_CODE_REMOTE_SESSION_ID?: string;
  CLAUDE_SESSION_ID?: string;
}

/**
 * Resolve the session id by precedence: the hook input's `session_id` wins, then
 * the cloud id (`CLAUDE_CODE_REMOTE_SESSION_ID` — set in Claude Code on the web,
 * where `CLAUDE_SESSION_ID` may be empty), then the local `CLAUDE_SESSION_ID`.
 * Returns undefined when none resolves, so the caller fails open (no sentinel,
 * no nudge) rather than keying the sentinel to a blank string.
 */
export function resolveSessionId(
  input: { session_id?: string },
  env: SessionIdEnv,
): string | undefined {
  return firstNonEmpty(input.session_id, env.CLAUDE_CODE_REMOTE_SESSION_ID, env.CLAUDE_SESSION_ID);
}

/** The first argument that is a non-empty string, else undefined. */
function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    if (value !== undefined && value.length > 0) return value;
  }
  return undefined;
}

/**
 * Resolve a Codex session id from a SESSION-STABLE source: the Stop payload's
 * `session_id`, then the `CODEX_THREAD_ID` env. Deliberately NOT `turn_id` — that
 * changes every turn, so keying the once-per-session sentinel on it would make
 * retro fire on every Stop. Mirrors run-identity.ts's Codex sessionKey.
 */
export function resolveCodexSessionId(
  input: { session_id?: string; turn_id?: string },
  env: Record<string, string | undefined>,
): string | undefined {
  // turn_id is accepted but deliberately ignored — it changes every turn, so it
  // must never key the once-per-session sentinel.
  return firstNonEmpty(input.session_id, env.CODEX_THREAD_ID);
}

/**
 * Resolve a Cursor session id from the stop payload's `conversation_id`, which is
 * session-stable (NOT `generation_id`, which is per-generation and would let retro
 * fire more than once per session). Per the official Cursor hooks docs
 * (cursor.com/docs/agent/hooks, verified 2026-06-28), every hook carries
 * `conversation_id` + `generation_id` + a base `transcript_path`. Returns undefined
 * when absent, so the caller fails open.
 */
export function resolveCursorSessionId(
  input: { conversation_id?: string },
  _env: Record<string, string | undefined>,
): string | undefined {
  return firstNonEmpty(input.conversation_id);
}

/**
 * The fact-phrased nudge surfaced via Stop additionalContext. A STATEMENT, never
 * an imperative — out-of-band/command phrasing trips Claude's prompt-injection
 * defenses and gets surfaced verbatim instead of acted on (the stop-self-report
 * learning). Carries the live transcript path and points at the retro guide.
 */
export function buildRetroNudge(transcriptPath: string): string {
  return (
    `Safeword retro has not run for this session. The transcript at ${transcriptPath} ` +
    `is available to mine for safeword friction (bugs / rough edges / gaps); the retro ` +
    `guide at .safeword/guides/retro.md describes the fresh-context extraction and ` +
    `\`safeword retro\` filing step.`
  );
}

export interface RetroTriggerInput {
  session_id?: string;
  /** Codex turn-scoped events carry turn_id; read by the Codex session resolver. */
  turn_id?: string;
  /** Cursor stop payloads carry conversation_id; read by the Cursor session resolver. */
  conversation_id?: string;
  transcript_path?: string;
}

export interface RetroTriggerDeps {
  /** Environment for session-id resolution (defaults to process.env). */
  env?: Record<string, string | undefined>;
  /** Transcript reader (injected for tests; defaults to fs readFileSync utf8). */
  readFile?: (path: string) => string;
  /** Sentinel base directory (defaults to the OS temp dir). */
  baseDirectory?: string;
  /** Substance threshold override (defaults to SUBSTANCE_THRESHOLD). */
  threshold?: number;
  /** Per-agent tool-use counter (defaults to the Claude counter). */
  countToolUses?: ToolUseCounter;
  /** Per-agent session-id resolver (defaults to the Claude/shared resolver). */
  resolveSessionId?: (
    input: RetroTriggerInput,
    env: Record<string, string | undefined>,
  ) => string | undefined;
}

/**
 * Decide whether to surface a retro nudge for this Stop, and (when it does) mark
 * the once-per-session sentinel. Returns the additionalContext string to surface,
 * or undefined to stay silent. Pure orchestration over the units above; the only
 * side effect is marking the sentinel on a real nudge.
 *
 * Fail-open by construction — every "can't proceed" branch returns undefined and
 * leaves the sentinel untouched, so the hook that wraps this never blocks Stop:
 *   - no resolvable session id  → silent
 *   - no transcript_path        → silent
 *   - already nudged this session → silent (within-session idempotency)
 *   - transcript unreadable      → silent
 *   - transcript not substantial → silent, sentinel left unset
 */
export function decideRetroNudge(
  input: RetroTriggerInput,
  dependencies: RetroTriggerDeps = {},
): string | undefined {
  const env = dependencies.env ?? (process.env as Record<string, string | undefined>);
  const resolve = dependencies.resolveSessionId ?? resolveSessionId;
  const sessionId = resolve(input, env);
  if (!sessionId) return undefined;

  const transcriptPath = input.transcript_path;
  if (!transcriptPath || transcriptPath.length === 0) return undefined;

  if (hasNudged(sessionId, dependencies.baseDirectory)) return undefined;

  const read = dependencies.readFile ?? ((path: string) => readFileSync(path, 'utf8'));
  let transcript: string;
  try {
    transcript = read(transcriptPath);
  } catch {
    return undefined; // unreadable transcript → fail open
  }

  const counter = dependencies.countToolUses ?? countToolUses;
  if (!isSubstantial(transcript, dependencies.threshold ?? SUBSTANCE_THRESHOLD, counter)) {
    return undefined; // trivial session → silent, sentinel left unset
  }

  try {
    markNudged(sessionId, dependencies.baseDirectory);
  } catch {
    // A sentinel-write failure must not suppress the nudge; worst case is a
    // duplicate nudge next Stop, which the occurrence ledger (RV9JT4) dedupes.
  }
  return buildRetroNudge(transcriptPath);
}
