/**
 * Shared quality gate types and constants.
 * Used by both post-tool-quality.ts (observer) and pre-tool-quality.ts (enforcer).
 */

export const LOC_THRESHOLD = 400;

export interface QualityState {
  locSinceCommit: number;
  lastCommitHash: string;
  activeTicket: string | null;
  lastKnownPhase: string | null;
  gate: string | null;
}
