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
 * Count tool-use content items across all assistant entries in a Claude Code
 * JSONL transcript (the shape stop-reentry.ts parses). Malformed lines are
 * skipped, never thrown — a hook must not crash on a partial transcript.
 */
export function countToolUses(transcriptText: string): number {
  const text = transcriptText.trim();
  if (text.length === 0) return 0;
  let count = 0;
  for (const line of text.split('\n')) {
    try {
      const entry = JSON.parse(line) as TranscriptEntry;
      const content = entry.message?.content;
      if (!Array.isArray(content)) continue;
      for (const item of content) {
        if (item?.type === 'tool_use') count++;
      }
    } catch {
      // Skip malformed JSONL lines silently.
    }
  }
  return count;
}

/** Whether the transcript crosses the substance threshold (inclusive `>=`). */
export function isSubstantial(
  transcriptText: string,
  threshold: number = SUBSTANCE_THRESHOLD,
): boolean {
  return countToolUses(transcriptText) >= threshold;
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
  return (
    nonEmpty(input.session_id) ??
    nonEmpty(env.CLAUDE_CODE_REMOTE_SESSION_ID) ??
    nonEmpty(env.CLAUDE_SESSION_ID)
  );
}

function nonEmpty(value: string | undefined): string | undefined {
  return value !== undefined && value.length > 0 ? value : undefined;
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
  transcript_path?: string;
}

export interface RetroTriggerDeps {
  /** Environment for session-id resolution (defaults to process.env). */
  env?: SessionIdEnv;
  /** Transcript reader (injected for tests; defaults to fs readFileSync utf8). */
  readFile?: (path: string) => string;
  /** Sentinel base directory (defaults to the OS temp dir). */
  baseDirectory?: string;
  /** Substance threshold override (defaults to SUBSTANCE_THRESHOLD). */
  threshold?: number;
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
  const env = dependencies.env ?? (process.env as SessionIdEnv);
  const sessionId = resolveSessionId(input, env);
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

  if (!isSubstantial(transcript, dependencies.threshold ?? SUBSTANCE_THRESHOLD)) {
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
