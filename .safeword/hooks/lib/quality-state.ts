/**
 * Shared quality gate types and constants.
 * Used by both post-tool-quality.ts (observer) and pre-tool-quality.ts (enforcer).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

export const LOC_THRESHOLD = 400;

/** Tooling/meta paths that are not application code.
 *  Used by pre-tool (skip blocking) and post-tool (skip LOC counting). */
export const META_PATHS = ['.safeword-project/', '.safeword/', '.claude/', '.cursor/'];

export interface FailureEntry {
  pattern: string;
  timestamp: string;
}

export interface QualityState {
  locSinceCommit: number;
  lastCommitHash: string;
  activeTicket: string | null;
  lastKnownPhase: string | null;
  gate: string | null;
  lastKnownTddStep: string | null;
  locAtLastReview: number;
  recentFailures: FailureEntry[];
  incrementedPatterns: string[];
}

/**
 * Get the per-session state file path.
 * Falls back to the legacy shared file if no session_id is provided.
 */
export function getStateFilePath(projectDirectory: string, sessionId?: string): string {
  const dir = nodePath.join(projectDirectory, '.safeword-project');
  if (sessionId) {
    return nodePath.join(dir, `quality-state-${sessionId}.json`);
  }
  return nodePath.join(dir, 'quality-state.json');
}

/** Counter file for cross-session failure pattern tracking. */
export function getCounterFilePath(projectDirectory: string): string {
  return nodePath.join(projectDirectory, '.safeword-project', 'failure-counts.json');
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
      failures.push({ pattern, timestamp: new Date().toISOString() });
      state.recentFailures = failures;

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
