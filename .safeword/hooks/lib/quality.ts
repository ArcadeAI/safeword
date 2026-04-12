// Shared quality review message for Claude Code and Cursor hooks
// Used by: stop-quality.ts, cursor/stop.ts

export type BddPhase =
  | 'intake'
  | 'define-behavior'
  | 'scenario-gate'
  | 'decomposition'
  | 'implement'
  | 'done';

const PHASE_MESSAGES: Record<BddPhase, string> = {
  intake: `SAFEWORD Quality Review (Discovery Phase):

Check your discovery work:
- Are edge cases covered?
- Is scope clear and bounded?
- Are failure modes identified?
- Is there anything the user hasn't considered?

Research before asking. Avoid bloat.`,

  'define-behavior': `SAFEWORD Quality Review (Scenario Phase):

Check your scenarios:
- Is each scenario atomic (tests ONE behavior)?
- Is each outcome observable (externally visible)?
- Is each scenario deterministic (same result on repeat)?
- Are happy path, failure modes, and edge cases covered?

Research before asking. Avoid bloat.`,

  'scenario-gate': `SAFEWORD Quality Review (Scenario Gate):

**Validate each scenario - show evidence:**

1. List scenarios validated:
   → Show: "Validated: [scenario names]"

2. For each, confirm testability criteria:
   - Atomic: Tests ONE behavior? (Red flag: multiple When/Then)
   - Observable: Externally visible outcome? (Red flag: internal state only)
   - Deterministic: Same result on repeat? (Red flag: time/random dependency)

3. Issues found?
   → Show: "Issues: [list with fixes]" or "No issues"

If validation incomplete, continue working before proceeding to decomposition.`,

  decomposition: `SAFEWORD Quality Review (Decomposition Phase):

**Show task breakdown before implementing:**

1. Components identified:
   → Show: "Components: [list]"

2. Test layers assigned:
   → Show: "Unit: [list], Integration: [list], E2E: [list]"

3. Task order (by dependency):
   → Show: "Tasks: 1. [task] 2. [task] ..."

4. Missing anything?
   → Show: "Ready" or "Missing: [gaps]"

If breakdown incomplete, continue working before proceeding to implement.`,

  implement: `SAFEWORD Quality Review:

Review your work critically.

- Is it correct?
- Could this be simplified without losing clarity?
- Does it follow latest docs and research? If unsure, say so — don't guess.
- If questions remain: research first, then ask targeted questions.
- Report findings only. No preamble.
- State what you're most uncertain about.
- If you asked a question above that's still relevant after review, re-ask it.`,

  done: `SAFEWORD Quality Review (Done Phase):

**Completion Checklist - Provide evidence for each:**

1. All scenarios marked [x] in test-definitions?
   → Show: "All N scenarios marked complete" or list remaining

2. Full test suite passing?
   → Show: "✓ X/X tests pass" (run tests, show count)

3. Build passing?
   → Show: "Build succeeded" or skip if no build step

4. Lint passing?
   → Show: "Lint clean" or note issues

5. Parent epic updated (if applicable)?
   → Show: "Added entry to [parent] work log" or "No parent"

If ANY item lacks evidence, continue working. Run /verify to check, then /audit before marking done.`,
};

/**
 * The default quality review prompt (backwards compatible).
 * Used when no phase is detected.
 */
export const QUALITY_REVIEW_MESSAGE = PHASE_MESSAGES.implement;

/**
 * Get phase-appropriate quality review message.
 * Falls back to default (implement) if phase unknown.
 */
export function getQualityMessage(phase?: BddPhase | string): string {
  if (phase && phase in PHASE_MESSAGES) {
    return PHASE_MESSAGES[phase as BddPhase];
  }
  return QUALITY_REVIEW_MESSAGE;
}
