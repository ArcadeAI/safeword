// The adversarial pass (ticket 36EEMY, Rule TB1.R14).
//
// Author → adversary, never a vote. The ADR rejected a voting panel (the
// "popularity trap": correlated models converge on shared wrong answers and
// underperform a single adversarial reviewer). Union doubles the noise;
// intersection kills recall — the best findings in trial were single-reviewer
// insights. So a second vendor tries to REFUTE what the first found.
//
// It ANNOTATES, never deletes. With only two vendors and an author assumed to be
// Claude, the review runs on Codex and the refuter is Claude — the author's own
// lineage — so a refutation can share the author's blind spot and wrongly reject
// a true finding. A third decorrelated vendor is not available, so the adversary
// may lower confidence; it may never make a true finding vanish.

import type { ReviewFinding } from './verdict.js';

/** What the second vendor concluded about one finding. */
export type AdversaryOutcome = 'refuted' | 'affirmed' | 'error';

/** Asks the second vendor to refute one finding. Injected, so tests script it. */
export type AdversaryRunner = (finding: ReviewFinding) => Promise<AdversaryOutcome>;

const MARK_FOR: Record<AdversaryOutcome, NonNullable<ReviewFinding['adversarial']>> = {
  refuted: 'contested',
  affirmed: 'affirmed',
  error: 'unchecked',
};

/**
 * Run the adversary over the findings and return them annotated, in order.
 *
 * Never spawns when there are no findings — cost is bounded because the second
 * vendor only runs on the ~25-30% of pull requests that produced something, and
 * only reads the findings rather than the whole diff.
 *
 * A thrown adversary is caught and becomes `unchecked`: an infrastructure
 * failure must not silently upgrade a finding to "verified", nor drop it.
 */
export async function runAdversary(
  findings: ReviewFinding[],
  adversary: AdversaryRunner,
): Promise<ReviewFinding[]> {
  if (findings.length === 0) return [];

  return Promise.all(
    findings.map(async finding => {
      let outcome: AdversaryOutcome;
      try {
        outcome = await adversary(finding);
      } catch {
        outcome = 'error';
      }
      return { ...finding, adversarial: MARK_FOR[outcome] };
    }),
  );
}
