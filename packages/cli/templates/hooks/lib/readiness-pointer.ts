// Readiness pointer (ticket TPP6Y2): the compressed Clarify-phase self-test
// surfaced by prompt-questions.ts. A keyword pointer to the five intake
// dimensions, NOT spelled-out prompts — the detailed phrasing and the
// value-of-information triage live in SAFEWORD.md. Surfaced while scoping (no
// active ticket, or the intake phase) and suppressed once a build phase begins.

// The pointer must stay a pointer: this cap fails the test if it ever grows
// toward spelled-out prompts (the per-turn-interrogation failure mode).
export const READINESS_POINTER_WORD_CAP = 30;

export const READINESS_POINTER =
  'Ready to build? intent · done (measurable) · what must not break / reversibility · riskiest assumption + cheapest test · problem or guess?';

// Clarify is "no active ticket" (undefined phase) or the intake phase. Every
// later phase is build-side, where the pointer would be noise.
export function shouldSurfaceReadiness(phase: string | undefined): boolean {
  return phase === undefined || phase === 'intake';
}
