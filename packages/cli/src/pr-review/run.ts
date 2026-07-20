// The runner's composition root (ticket 36EEMY, slice 3).
//
// Every decision this file makes lives in a tested pure module; what happens
// here is ORDER. The order is load-bearing in two places and both are about not
// spending something we cannot get back:
//
//   1. The config gate runs before the trigger, and the trigger before the
//      vendor — a vendor invocation costs real money and real minutes, so the
//      cheapest disqualifier has to come first.
//   2. The adversary runs before delivery, never after. A contested mark that
//      arrives after the comment is already posted is a correction, not a
//      confidence signal.
//
// Everything crossing a process or network boundary is injected, so the whole
// pipeline is exercised without a live model, a live GitHub, or a live tracker.

import { type AdversaryRunner, runAdversary } from './adversary.js';
import { deliverReview, type PrReviewConfig } from './config.js';
import { deriveVerdict } from './decision.js';
import type { ReviewPoster } from './poster.js';
import { evaluateTrigger, type TriggerContext } from './trigger.js';
import type { Review } from './verdict.js';

export interface RunPrReviewDependencies {
  config: PrReviewConfig;
  /** Facts about the pull request, already gathered from the GitHub API. */
  trigger: TriggerContext;
  poster: ReviewPoster;
  /** Invoke the vendor headlessly and parse its answer. Injected (slice 0's seam). */
  review: () => Promise<Review>;
  /** The second vendor. Absent means the adversarial pass is not configured. */
  adversary?: AdversaryRunner;
}

export interface RunPrReviewResult {
  /** Whether the vendor was invoked at all. */
  ran: boolean;
  /** Whether anything reached the pull request. */
  posted: boolean;
  /** One line explaining the outcome — the answer to "why didn't it review?". */
  reason: string;
}

/**
 * Run one review, end to end.
 *
 * Returns rather than throws for every ordinary "we chose not to review" path,
 * because those are not failures and must not turn the CI job red. A genuine
 * fault — the vendor erroring, GitHub refusing a write — propagates, so it shows
 * up as a loud red job instead of a silent no-op.
 */
export async function runPrReview(
  dependencies: RunPrReviewDependencies,
): Promise<RunPrReviewResult> {
  const { config, trigger, poster, adversary } = dependencies;

  if (!config.enabled) {
    return { ran: false, posted: false, reason: 'disabled for this project (prReview.enabled)' };
  }

  const decision = evaluateTrigger(trigger);
  if (!decision.fire) {
    return { ran: false, posted: false, reason: decision.reason };
  }

  const review = await dependencies.review();

  // Adversarial pass first, so the mark is part of the comment rather than a
  // follow-up correcting it. runAdversary is a no-op on an empty finding set,
  // which is what keeps the second vendor off clean pull requests.
  const findings =
    adversary === undefined ? review.findings : await runAdversary(review.findings, adversary);

  // The verdict is derived from the POST-adversary findings and never taken from
  // the model's own claim: a refuted finding must not still be routing a human.
  const verdict = deriveVerdict({
    findings,
    hasUnresolvedQuestion: review.verdict === 'needs-a-human' && findings.length === 0,
  });

  const delivery = await deliverReview({ ...review, findings, verdict }, poster, config);
  return { ran: true, posted: delivery.posted, reason: delivery.reason };
}
