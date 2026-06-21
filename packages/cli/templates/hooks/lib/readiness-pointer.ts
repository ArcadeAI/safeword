// Readiness pointer (ticket TPP6Y2): the compressed Clarify-phase self-test
// surfaced by prompt-questions.ts. A keyword pointer to the five intake
// dimensions, NOT spelled-out prompts — the detailed phrasing lives in
// SAFEWORD.md. Surfaced while scoping (no ticket or intake phase), suppressed
// once a build phase is under way.

export const READINESS_POINTER = 'readiness';

export function shouldSurfaceReadiness(phase: string | undefined): boolean {
  return phase === undefined;
}
