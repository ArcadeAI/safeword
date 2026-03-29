/**
 * Shared quality gate types and constants.
 * Used by both post-tool-quality.ts (observer) and pre-tool-quality.ts (enforcer).
 */

import nodePath from 'node:path';

export const LOC_THRESHOLD = 400;

/** Tooling/meta paths that are not application code.
 *  Used by pre-tool (skip blocking) and post-tool (skip LOC counting). */
export const META_PATHS = ['.safeword-project/', '.safeword/', '.claude/', '.cursor/'];

export interface QualityState {
  locSinceCommit: number;
  lastCommitHash: string;
  activeTicket: string | null;
  lastKnownPhase: string | null;
  gate: string | null;
  lastKnownTddStep: string | null;
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
