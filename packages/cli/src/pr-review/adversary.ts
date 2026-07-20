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
/**
 * How many refutations may be in flight at once.
 *
 * Each one is a headless vendor process. `Promise.all` over the findings would
 * start ALL of them simultaneously — a 20-finding review spawning 20 concurrent
 * `codex exec` processes on a CI runner — and this repo has already been bitten
 * by machine overload from exactly that shape. "Cost is bounded" has to mean
 * bounded in parallelism, not only in how often the pass runs.
 */
export const ADVERSARY_CONCURRENCY = 4;

export async function runAdversary(
  findings: ReviewFinding[],
  adversary: AdversaryRunner,
  concurrency: number = ADVERSARY_CONCURRENCY,
): Promise<ReviewFinding[]> {
  if (findings.length === 0) return [];

  const annotated: ReviewFinding[] = Array.from({ length: findings.length });
  let next = 0;

  // Fixed pool of workers pulling from a shared cursor: output stays in input
  // order (each worker writes to its own index) while at most `concurrency`
  // vendor processes exist at any moment.
  const worker = async (): Promise<void> => {
    while (next < findings.length) {
      const index = next++;
      const finding = findings[index];
      if (finding === undefined) continue;
      let outcome: AdversaryOutcome;
      try {
        outcome = await adversary(finding);
      } catch {
        outcome = 'error';
      }
      annotated[index] = { ...finding, adversarial: MARK_FOR[outcome] };
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, findings.length) }, () => worker()));
  return annotated;
}
