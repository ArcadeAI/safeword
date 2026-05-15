// Shared quality review message for Claude Code and Cursor hooks
// Used by: stop-quality.ts, cursor/stop.ts
//
// Format: every Stop terminates in CONFIDENT or BLOCKED (binary terminal).
// Per-phase evidence templates make CONFIDENT falsifiable; BLOCKED carries
// "Tried:" + "Need:" so escalation is a clean handoff, not a doubt-dump.
//
// Research: tokenized verdicts beat free-form uncertainty for calibration
// (Kadavath 2022, Lin 2022, Tian 2023). The "Think about evidence before
// declaring" sentence opportunistically nudges Claude 4.7's deliberation
// without forcing extended thinking (which a hook cannot toggle).

export type BddPhase =
  | 'intake'
  | 'define-behavior'
  | 'scenario-gate'
  | 'decomposition'
  | 'implement'
  | 'verify'
  | 'done';

const UNIVERSAL_HEADER = `Quality Review.

Think about evidence before declaring. End in CONFIDENT or BLOCKED.

CONFIDENT — <evidence>
BLOCKED — <one specific unknown>. Tried: <concrete verb + object>. Need: <unblock>.

No lists. If multiple unknowns: resolve the small ones, then BLOCKED on the load-bearing one.

`;

/** Per-phase evidence templates appended to the universal header. */
const PHASE_EVIDENCE: Record<BddPhase, string> = {
  intake:
    'Phase: intake. CONFIDENT evidence: cite scope, out_of_scope, and done_when fields from frontmatter.',
  'define-behavior':
    'Phase: define-behavior. CONFIDENT evidence: cite N scenarios; AODI; happy/failure/edge covered.',
  'scenario-gate':
    'Phase: scenario-gate. CONFIDENT evidence: cite N validated scenarios; AODI pass; issues found or "No issues."',
  decomposition:
    'Phase: decomposition. CONFIDENT evidence: cite ordered tasks (A→B→C) or "Skipped — architecture clear."',
  implement:
    'Phase: implement. CONFIDENT evidence: cite the passing artifact (X/X tests pass; scenario checked off).',
  verify:
    'Phase: verify. CONFIDENT evidence: cite /verify result (X/X tests; N/N scenarios complete).',
  done: 'Phase: done. CONFIDENT evidence: /audit: passed. /verify: passed. verify.md present.',
};

/** TDD-step-specific evidence for implement phase (RED/GREEN/REFACTOR). */
const TDD_STEP_EVIDENCE: Record<string, string> = {
  red: 'Phase: implement (TDD: RED). CONFIDENT evidence: cite the failing test naming the missing behavior.',
  green: 'Phase: implement (TDD: GREEN). CONFIDENT evidence: cite X/X tests pass; minimal impl.',
  refactor:
    'Phase: implement (TDD: REFACTOR). CONFIDENT evidence: cite the cleanup applied; X/X tests still pass.',
};

/**
 * The default quality review prompt (backwards compatible export).
 * Used when no phase is detected. Cursor's stop hook consumes this directly.
 */
export const QUALITY_REVIEW_MESSAGE = UNIVERSAL_HEADER + PHASE_EVIDENCE.implement;

/**
 * Get phase-appropriate quality review message.
 * During implement phase, uses TDD-step-specific evidence when tddStep is provided.
 * Falls back to default (implement) if phase unknown.
 */
export function getQualityMessage(phase?: BddPhase | string, tddStep?: string | null): string {
  if (phase === 'implement' && tddStep && tddStep in TDD_STEP_EVIDENCE) {
    return UNIVERSAL_HEADER + TDD_STEP_EVIDENCE[tddStep];
  }
  if (phase && phase in PHASE_EVIDENCE) {
    return UNIVERSAL_HEADER + PHASE_EVIDENCE[phase as BddPhase];
  }
  return QUALITY_REVIEW_MESSAGE;
}

/**
 * Build a disqualification message when state flags suggest CONFIDENT shouldn't be allowed.
 * Returns undefined if no disqualification applies.
 *
 * Wired by stop-quality.ts which has access to the session state. Keeps quality.ts
 * state-agnostic (it only knows the prompt-shape contract).
 */
export function getDisqualificationMessage(options: {
  novelResearchReminderUnconsumed: boolean;
  recentRelevantFailure?: string;
}): string | undefined {
  const messages: string[] = [];
  if (options.novelResearchReminderUnconsumed) {
    messages.push('CONFIDENT requires /quality-review first — novel-claim flag is unconsumed.');
  }
  if (options.recentRelevantFailure) {
    messages.push(
      `CONFIDENT requires evidence the failure mode was checked: ${options.recentRelevantFailure}.`,
    );
  }
  return messages.length > 0 ? messages.join('\n') : undefined;
}
