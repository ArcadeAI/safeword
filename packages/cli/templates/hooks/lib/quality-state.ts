/**
 * Shared quality gate types and constants.
 * Used by both post-tool-quality.ts (observer) and pre-tool-quality.ts (enforcer).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { resolveNamespaceRoot } from './namespace-root.js';

export const LOC_THRESHOLD = 400;
/** Counter threshold for CLAUDE.md escalation suggestions. */
export const ESCALATION_THRESHOLD = 3;

/**
 * Closing line appended to every hard-block gate message (phase / LOC / done
 * and the artifact prerequisite gates). Gate messages are the densest jargon
 * in the system; `/explain` (a manual-only action skill) translates a blocked
 * gate into plain English, so the pointer rides along with the block itself
 * (ticket ZCYD5P). Plain, no branding.
 */
export const EXPLAIN_HINT = 'Run `/explain` for a plain-English version of this block.';

/** Tooling/meta paths that are not application code.
 *  Used by pre-tool (skip blocking) and post-tool (skip LOC counting). */
export const META_PATHS = ['.project/', '.safeword-project/', '.safeword/', '.claude/', '.cursor/'];

export interface FailureEntry {
  pattern: string;
  timestamp: string;
}

export interface QualityState {
  locSinceCommit: number;
  lastCommitHash: string;
  activeTicket: string | null;
  gate: string | null;
  recentFailures: FailureEntry[];
  incrementedPatterns: string[];
  /**
   * Files under `.safeword-project/learnings/*.md` edited this session whose
   * "novel claim — verify with /quality-review" nudge has not yet been shown.
   * Append-only per-fingerprint; cleared atomically by prompt-questions when
   * the nudge fires (entries move to `learningsNudgesAcknowledged`).
   */
  learningsNudgesPending?: string[];
  /**
   * Files whose nudge has already been shown this session. Append-only.
   * Used by the setter to skip re-arming a file that was already nudged.
   */
  learningsNudgesAcknowledged?: string[];
  /**
   * The TDD step (red/green/refactor) last surfaced for review. Dedups the
   * PostToolUse per-step review against the Stop backstop — Stop skips a step
   * PostToolUse already reviewed this session (ticket SXSCJQ).
   */
  lastReviewedStep?: string;
  /**
   * The BDD phase last surfaced for review. Dedups the per-phase review across
   * the PostToolUse trigger (autonomous-safe) and the Stop backstop, so each
   * phase boundary is reviewed once (ticket SXSCJQ).
   */
  lastReviewedPhase?: string;
  /**
   * HEAD sha at which the replan-on-resume heads-up last fired (ticket 153).
   * Suppresses re-firing every turn while HEAD is unchanged; a new session has
   * no marker and re-evaluates from the ticket's `last_modified`. Stored here —
   * never by bumping `last_modified`, which is also the active-ticket mtime.
   */
  replanPromptedHead?: string;
}

/**
 * Get the per-session state file path.
 */
export function getStateFilePath(projectDirectory: string, sessionId: string): string {
  return nodePath.join(resolveNamespaceRoot(projectDirectory), `quality-state-${sessionId}.json`);
}

/** Counter file for cross-session failure pattern tracking. */
export function getCounterFilePath(projectDirectory: string): string {
  return nodePath.join(resolveNamespaceRoot(projectDirectory), 'failure-counts.json');
}

export interface CounterEntry {
  count: number;
  lastSeen: string;
  countAtLastSuggestion: number | null;
}

/** Read the counter file. Returns empty object if missing or corrupted. */
export function readCounters(projectDirectory: string): Record<string, CounterEntry> {
  const filePath = getCounterFilePath(projectDirectory);
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

/** Write the counter file. */
export function writeCounters(
  projectDirectory: string,
  counters: Record<string, CounterEntry>,
): void {
  writeFileSync(getCounterFilePath(projectDirectory), JSON.stringify(counters, null, 2));
}

/**
 * Record a structural failure: append to session state + increment counter.
 * Per-session dedup: each pattern increments the counter at most once per session.
 */
export function recordFailure(
  projectDirectory: string,
  sessionId: string | undefined,
  pattern: string,
): void {
  // Write to session state (recentFailures)
  if (sessionId) {
    const stateFile = getStateFilePath(projectDirectory, sessionId);
    try {
      const state = JSON.parse(readFileSync(stateFile, 'utf8'));
      const failures: FailureEntry[] = state.recentFailures ?? [];
      // Per-pattern dedup: keep entries for other patterns, then append this
      // one with a fresh timestamp. Bounds the array by distinct pattern
      // count instead of letting it grow with repeats, and keeps the array
      // ordered by last-occurrence so `failures[last]` is the most-recent
      // pattern (prompt-questions relies on this). Ticket 8CMXNG.
      const updated = failures.filter(f => f.pattern !== pattern);
      updated.push({ pattern, timestamp: new Date().toISOString() });
      state.recentFailures = updated;

      // Per-session dedup for counter increment
      const incremented: string[] = state.incrementedPatterns ?? [];
      if (!incremented.includes(pattern)) {
        incremented.push(pattern);

        // Increment persistent counter
        const counters = readCounters(projectDirectory);
        const entry = counters[pattern] ?? { count: 0, lastSeen: '', countAtLastSuggestion: null };
        entry.count += 1;
        entry.lastSeen = new Date().toISOString().split('T')[0];
        counters[pattern] = entry;
        writeCounters(projectDirectory, counters);
      }
      state.incrementedPatterns = incremented;

      writeFileSync(stateFile, JSON.stringify(state, null, 2));
    } catch {
      // Best effort — don't crash hooks on state write failure
    }
  }
}
