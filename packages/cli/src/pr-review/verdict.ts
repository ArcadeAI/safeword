// Verdict → surface (ticket 36EEMY, Rules TB1.R9 and TB1.R2).
//
// The closed verdict set is {needs-a-human, reviewed, unreviewable-as-is}.
// `safe-to-merge` is retired: the reviewer will not assert merge-safety while
// its efficacy is unproven, and it saved nothing anyway.
//
// Which verdict speaks, and how, is the whole delivery contract:
//   needs-a-human      → posts. The only verdict that puts text on the PR.
//   reviewed           → a non-required check-run receipt. NOT a comment, so
//                        R2's "nothing worth saying ⇒ no comment" still holds,
//                        and NOT an approval. It exists because pure silence is
//                        ambiguous with "the reviewer never ran".
//   unreviewable-as-is → one note, no receipt.

import type { ReviewPoster } from './poster.js';

export type Verdict = 'needs-a-human' | 'reviewed' | 'unreviewable-as-is';

/** The routing decision a posted review ends on (NTB1.R4). */
export type Decision = 'push back' | 'ask';

export interface ReviewFinding {
  path: string;
  line: number;
  /** Plain-language consequence — the surface an NTB reads (NTB1.R1). */
  consequence: string;
  /**
   * What the second vendor made of it (R14). Absent until the adversarial pass
   * has run; `unchecked` means the adversary was asked and failed, which is not
   * the same as never having been asked.
   */
  adversarial?: 'contested' | 'affirmed' | 'unchecked';
  /**
   * A concrete patch. Only ever present after the fix gate has RUN it against
   * the tests it could break (R13) — an unvalidated patch is stripped, never
   * posted, because a code block is the strongest predictor that a comment gets
   * applied and a wrong one lands.
   */
  suggestedFix?: string;
  /** Why a fix was removed: the fork could not be executed, or the tests failed. */
  fixWithheld?: 'fork' | 'failed';
}

export interface Review {
  verdict: Verdict;
  findings: ReviewFinding[];
  decision?: Decision;
}

// The receipt's check-run name is owned by poster.ts (the guard enforces it) and
// re-exported here for the verdict-side callers that already import from this
// module.
export { RECEIPT_CHECK_NAME } from './poster.js';
import { RECEIPT_CHECK_NAME } from './poster.js';

/**
 * Render one finding. The fixed shape is [what happens] → [what to do], with
 * evidence a layer deeper — a wall of code anchors, a one-line stake orients.
 *
 * A contested finding says so in the body: down-weighting a finding the reader
 * cannot see is down-weighted achieves nothing (R14).
 */
/** Why a patch is missing, said plainly. Silence would read as having none. */
const FIX_WITHHELD_NOTE: Record<NonNullable<ReviewFinding['fixWithheld']>, string> = {
  fork: "_A fix was drafted but **not run** — validating it would mean executing this fork's code, which the reviewer will not do._",
  failed:
    '_A fix was drafted and **withheld**: running it against the affected tests broke one. No validated fix is offered._',
};

const ADVERSARIAL_NOTE: Partial<Record<NonNullable<ReviewFinding['adversarial']>, string>> = {
  contested:
    '_Contested — a second vendor disputed this finding. It is posted anyway, at lower confidence._',
  unchecked: '_Not adversarially checked — the second vendor errored._',
};

export function renderFinding(finding: ReviewFinding): string {
  // Additive, not a chain of early returns: a finding can be BOTH contested and
  // carrying a withheld fix, and dropping either note would misrepresent it.
  const notes = [
    finding.adversarial === undefined ? undefined : ADVERSARIAL_NOTE[finding.adversarial],
    finding.fixWithheld === undefined ? undefined : FIX_WITHHELD_NOTE[finding.fixWithheld],
    finding.suggestedFix === undefined
      ? undefined
      : `**Suggested fix** (run against the affected tests):\n\n\`\`\`\n${finding.suggestedFix}\n\`\`\``,
  ].filter((note): note is string => note !== undefined);

  return [finding.consequence, ...notes].join('\n\n');
}

/**
 * Post a completed review through the capability-narrow poster.
 *
 * Note what this function cannot do regardless of what the review says: the
 * poster exposes no approve and no merge, so a review whose text has been
 * hijacked by injected diff content still only produces comments (SM1.R3).
 */
export async function postVerdict(review: Review, poster: ReviewPoster): Promise<void> {
  // One note, no receipt — the contract this file documents above.
  if (review.verdict === 'unreviewable-as-is') {
    await poster.postIssueComment(
      'This pull request has more open problems than are worth enumerating inline, ' +
        'so it was not reviewed finding-by-finding.',
    );
    return;
  }

  // Findings FIRST, receipt last. GitHub rejects an inline comment whose line
  // falls outside a diff hunk, so posting can fail partway; a receipt written
  // first would leave a verdict on the pull request claiming a review that never
  // fully appeared. `reviewed` has no findings to post — a comment saying
  // "nothing to say" is exactly the noise R2 forbids.
  for (const finding of review.findings) {
    await poster.postInlineComment({
      path: finding.path,
      line: finding.line,
      body: renderFinding(finding),
    });
  }

  // Recording only on silence would leave a reader unable to tell "flagged" from
  // "the reviewer never ran" — the ambiguity the receipt exists to remove (R9).
  await poster.createCheckRun({
    name: RECEIPT_CHECK_NAME,
    conclusion: 'neutral',
    title: review.verdict,
    summary: RECEIPT_SUMMARY[review.verdict],
  });
}

/** Only the two verdicts that record a receipt; `unreviewable-as-is` returns early. */
const RECEIPT_SUMMARY: Record<Exclude<Verdict, 'unreviewable-as-is'>, string> = {
  reviewed: 'Reviewed — nothing rising to a human. A receipt that the pass ran, not an approval.',
  'needs-a-human': 'Needs a human — see the review comments on the changed lines.',
};
