// Shared quality review message for Claude Code and Cursor hooks
// Used by: stop-quality.ts, cursor/stop.ts
//
// Format: every Stop terminates in CONFIDENT or BLOCKED (binary terminal).
// Universal critical review applies at every phase (correctness, simplicity,
// docs/research alignment). Per-phase evidence templates make CONFIDENT
// falsifiable with phase-specific criteria. BLOCKED carries "Tried:" + "Need:"
// so escalation is a clean handoff, not a doubt-dump.
//
// Research depth matches claim weight: code/docs for syntax/usage; primary
// literature (peer-reviewed, lab tech reports, credible preprints) for design
// or empirical claims. Blog posts, tweets, marketing don't count.
//
// Calibration grounding: Kadavath 2022, Lin 2022, Tian 2023 — tokenized
// verdicts beat free-form uncertainty descriptions for calibration.

export type BddPhase =
  | 'intake'
  | 'define-behavior'
  | 'scenario-gate'
  | 'decomposition'
  | 'implement'
  | 'verify'
  | 'done';

const UNIVERSAL_HEADER = `Think about evidence before declaring. Apply universal critical review:
verify correctness, simplicity, and alignment with latest docs/research.
On uncertainty or contested choice: investigate primary sources, enumerate
options, debate against correctness/elegance/no-bloat, recommend.
Implementation choices are yours to make and own. BLOCKED is for spec,
scope, or value decisions that require human input. Match research depth
to claim weight — code/docs for syntax and usage; primary literature
(peer-reviewed papers, lab tech reports, credible preprints) for design
choices, novel approaches, or empirical claims. Blog posts, tweets, and
marketing don't count.

End with a single verdict — not a list.

CONFIDENT — <evidence>. Next: <one concrete action — what you'll do or recommend>.
BLOCKED — <one specific unknown (a question with a falsifiable answer)>.
  Tried: <concrete verb + object>. Need: <unblock>.
  (Optional: propose one parallel action if non-blocker work exists.)

Multiple unknowns: resolve the small ones, BLOCK on the largest.

`;

/** Per-phase evidence templates appended to the universal header. */
const PHASE_EVIDENCE: Record<BddPhase, string> = {
  intake:
    'Phase: intake. CONFIDENT cites that scope/out_of_scope/done_when are bounded, failure modes were surfaced, and open questions are resolved (or explicitly deferred).',
  'define-behavior':
    'Phase: define-behavior. CONFIDENT cites N scenarios, AODI for each, happy/failure/edge coverage, and that scenarios test behaviors not implementation.',
  'scenario-gate':
    'Phase: scenario-gate. CONFIDENT cites N validated scenarios, AODI pass, and either issues found or "No issues."',
  decomposition:
    'Phase: decomposition. CONFIDENT cites ordered tasks (A→B→C) with test layers, or "Skipped — architecture clear."',
  implement:
    'Phase: implement. CONFIDENT cites the passing artifact (X/X tests pass; scenario checked off).',
  verify:
    'Phase: verify. CONFIDENT cites /verify result (X/X tests; N/N scenarios complete) and that no scenarios are stale.',
  done: "Phase: done. CONFIDENT cites /audit passed, /verify passed, verify.md present, scope drift checked, scenario coverage validated (no behaviors emerged that aren't in test-definitions), and any clear-win cross-scenario refactoring done.",
};

/** TDD-step-specific evidence for implement phase (RED/GREEN/REFACTOR). */
const TDD_STEP_EVIDENCE: Record<string, string> = {
  red: 'Phase: implement (TDD: RED). CONFIDENT cites the failing test, the missing behavior it names, and that the assertion is independent of the implementation.',
  green:
    'Phase: implement (TDD: GREEN). CONFIDENT cites X/X tests pass, that you wrote only what the test requires, and no mocks where real deps would work.',
  refactor:
    'Phase: implement (TDD: REFACTOR). CONFIDENT cites one refactoring applied (not batched), the smell it addressed (duplication / long-fn / nesting / magic / dead-code / naming), no behavior change, and X/X tests still pass.',
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
