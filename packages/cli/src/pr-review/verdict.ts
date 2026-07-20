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
}

export interface Review {
  verdict: Verdict;
  findings: ReviewFinding[];
  decision?: Decision;
}

/** The check-run name the receipt is recorded under; also the de-dupe marker (R8). */
export const RECEIPT_CHECK_NAME = 'safeword/pr-review';

/**
 * Render one finding. The fixed shape is [what happens] → [what to do], with
 * evidence a layer deeper — a wall of code anchors, a one-line stake orients.
 *
 * A contested finding says so in the body: down-weighting a finding the reader
 * cannot see is down-weighted achieves nothing (R14).
 */
export function renderFinding(finding: ReviewFinding): string {
  if (finding.adversarial === 'contested') {
    return `${finding.consequence}\n\n_Contested — a second vendor disputed this finding. It is posted anyway, at lower confidence._`;
  }
  if (finding.adversarial === 'unchecked') {
    return `${finding.consequence}\n\n_Not adversarially checked — the second vendor errored._`;
  }
  return finding.consequence;
}

/**
 * Post a completed review through the capability-narrow poster.
 *
 * Note what this function cannot do regardless of what the review says: the
 * poster exposes no approve and no merge, so a review whose text has been
 * hijacked by injected diff content still only produces comments (SM1.R3).
 */
export async function postVerdict(review: Review, poster: ReviewPoster): Promise<void> {
  // The verdict is recorded on EVERY path, including the ones that also post.
  // Recording only on silence would leave a reader unable to tell "flagged" from
  // "the reviewer never ran" — the ambiguity the receipt exists to remove (R9).
  await poster.createCheckRun({
    name: RECEIPT_CHECK_NAME,
    conclusion: 'neutral',
    title: review.verdict,
    summary: RECEIPT_SUMMARY[review.verdict],
  });

  if (review.verdict === 'unreviewable-as-is') {
    await poster.postIssueComment(
      'This pull request has more open problems than are worth enumerating inline, ' +
        'so it was not reviewed finding-by-finding.',
    );
    return;
  }

  // `reviewed` posts nothing: nothing rose to a human, and a comment saying so
  // would be exactly the noise R2 forbids.
  if (review.verdict === 'reviewed') return;

  for (const finding of review.findings) {
    await poster.postInlineComment({
      path: finding.path,
      line: finding.line,
      body: renderFinding(finding),
    });
  }
}

const RECEIPT_SUMMARY: Record<Verdict, string> = {
  reviewed: 'Reviewed — nothing rising to a human. A receipt that the pass ran, not an approval.',
  'needs-a-human': 'Needs a human — see the review comments on the changed lines.',
  'unreviewable-as-is': 'Unreviewable as is — see the note on the conversation.',
};
