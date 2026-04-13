// Shared quality review message for Claude Code and Cursor hooks
// Used by: stop-quality.ts, cursor/stop.ts

export type BddPhase =
  | 'intake'
  | 'define-behavior'
  | 'scenario-gate'
  | 'decomposition'
  | 'implement'
  | 'done';

/** TDD-step-specific implement messages (RED/GREEN/REFACTOR). */
const TDD_STEP_MESSAGES: Record<string, string> = {
  red: `Quality Review (TDD: RED):

- Does the test fail for the right reason? (missing behavior, not syntax)
- Is it testing ONE observable behavior, not implementation details?
- Is the assertion independent of the implementation? (not mirroring the code under test)`,

  green: `Quality Review (TDD: GREEN):

- Did you write only what the test requires? (GREEN is minimal — REFACTOR adds quality)
- Is the full test suite still passing? (show output, don't just claim)
- Did you introduce mocks that could be real dependencies instead?`,

  refactor: `Quality Review (TDD: REFACTOR):

- Is there duplication or unclear naming to clean up?
- Could this be simpler without losing clarity?
- Tests still passing after refactoring?`,
};

const PHASE_MESSAGES: Record<BddPhase, string> = {
  intake: `Quality Review (Understanding Phase):

- Verify scope is clear and bounded (scope, out_of_scope, done_when in frontmatter).
- Confirm failure modes and edge cases were surfaced.
- Check that open questions are resolved, not left vague.`,

  'define-behavior': `Quality Review (Scenario Phase):

- Verify each scenario is AODI: Atomic (ONE behavior), Observable (externally visible), Deterministic (repeatable), Independent (no ordering dependency).
- Confirm happy path, failure modes, and edge cases are covered.
- Avoid testing implementation details — test behaviors.`,

  'scenario-gate': `Quality Review (Scenario Gate):

1. List validated scenarios.
2. Confirm each is AODI: Atomic, Observable, Deterministic, Independent.
3. Show issues found or "No issues."`,

  decomposition: `Quality Review (Decomposition Phase):

- Optional — skip if architecture is clear from the proposal.
- If decomposing: verify tasks are ordered so each builds on what's working.
- Confirm test scopes match behavior (highest scope with acceptable feedback speed).`,

  implement: `Quality Review:

Review your work critically.

- Is it correct?
- Could this be simplified without losing clarity?
- Does it follow latest docs and research? If unsure, say so — don't guess.
- If questions remain: research first, then ask targeted questions.
- Report findings only. No preamble.
- State what you're most uncertain about.`,

  done: `Quality Review (Done Phase):

1. Check scenario coverage: did implementation reveal behaviors not in test-definitions?
2. Check scope drift: does the final implementation match ticket scope and done_when?
3. Cross-scenario refactoring done (if clear wins exist)?
4. Run /verify — show "✓ X/X tests pass" and "All N scenarios marked complete."
5. Run /audit — show "Audit passed."`,
};

/**
 * The default quality review prompt (backwards compatible).
 * Used when no phase is detected.
 */
export const QUALITY_REVIEW_MESSAGE = PHASE_MESSAGES.implement;

/**
 * Get phase-appropriate quality review message.
 * During implement phase, uses TDD-step-specific messages when tddStep is provided.
 * Falls back to default (implement) if phase unknown.
 */
export function getQualityMessage(phase?: BddPhase | string, tddStep?: string | null): string {
  if (phase === 'implement' && tddStep && tddStep in TDD_STEP_MESSAGES) {
    return TDD_STEP_MESSAGES[tddStep];
  }
  if (phase && phase in PHASE_MESSAGES) {
    return PHASE_MESSAGES[phase as BddPhase];
  }
  return QUALITY_REVIEW_MESSAGE;
}
