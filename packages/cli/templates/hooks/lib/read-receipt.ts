// Safeword: reading a coordinator review's receipt (ticket PB1GMZ).
//
// The one place that asks the coordinator about a review. `review status`
// revalidates the job record's integrity and re-fingerprints the reviewed
// sources, so a forged record reads as invalid and a review whose sources moved
// reads as stale — nothing here reimplements either check, it consults the one
// that exists.
//
// Both sides of the gate use this: write-review-stamp.ts before writing a claim,
// and the read path before letting a claimed stamp satisfy a gate. The ledger is
// a plain text file, so a line appended directly never passed the write hook —
// checking only there would leave the claim unwitnessed where it is actually
// enforced.
//
// `.js` specifiers (bun resolves them to the .ts sources) so tsc accepts this
// module when the test suite pulls it into the typecheck graph.

import { spawnSync } from 'node:child_process';

import type { ReviewReceipt } from './review-receipt.js';
import { reviewCandidates } from '../run-review.js';

/**
 * What the coordinator reports about `id`, or undefined when no CLI route could
 * answer. Undefined is not "fine": callers treat an unanswerable claim as
 * unwitnessed, because that is exactly what it is.
 */
export function readReviewReceipt(id: string, projectDirectory: string): ReviewReceipt | undefined {
  for (const [command, argumentPrefix] of reviewCandidates(projectDirectory)) {
    const run = spawnSync(
      command,
      [...argumentPrefix, 'review', 'status', id, '--json', '--cwd', projectDirectory],
      { encoding: 'utf8', timeout: 60_000 },
    );
    if (run.error !== undefined || run.stdout === '') continue;
    try {
      const data = (JSON.parse(run.stdout) as { data?: Record<string, unknown> }).data ?? {};
      // An id the coordinator does not know reports no review_id back, and a
      // record that answers about a *different* review is no witness for this
      // one — so the reported id has to be the one that was asked about.
      if (data.review_id !== id) return undefined;
      const text = (field: string): string | undefined =>
        typeof data[field] === 'string' ? (data[field] as string) : undefined;
      return {
        reviewId: id,
        status: text('status'),
        kind: text('review_kind'),
        targets: Array.isArray(data.review_targets)
          ? data.review_targets.filter(target => typeof target === 'string')
          : [],
        independence: text('independence'),
        authorAgent: text('author_agent'),
        actualReviewer: text('actual_reviewer'),
      };
    } catch {
      return undefined;
    }
  }
  return undefined;
}
