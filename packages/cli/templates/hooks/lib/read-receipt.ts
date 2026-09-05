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
/**
 * Per-route and total budgets. This runs inside blocking hooks (PreToolUse,
 * Stop), so an unresponsive route must not stall the user's tool call: a status
 * lookup is a local record read, and a route that cannot answer in seconds is
 * not going to. Exhausting the budget yields undefined — an unwitnessed claim,
 * which fails closed, rather than a hung hook.
 */
const ROUTE_TIMEOUT_MS = 5000;
const TOTAL_BUDGET_MS = 12_000;

export function readReviewReceipt(
  id: string,
  projectDirectory: string,
  deadline = Date.now() + TOTAL_BUDGET_MS,
): ReviewReceipt | undefined {
  for (const [command, argumentPrefix] of reviewCandidates(projectDirectory)) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return undefined;

    const run = spawnSync(
      command,
      [...argumentPrefix, 'review', 'status', id, '--json', '--cwd', projectDirectory],
      { encoding: 'utf8', timeout: Math.min(ROUTE_TIMEOUT_MS, remaining) },
    );
    // A route that could not run, said nothing, or answered unintelligibly has
    // not answered — try the next one. Only a parsed reply ends the search, so
    // one broken install does not decide the verdict for the routes behind it.
    if (run.error !== undefined || run.stdout === '') continue;

    let data: Record<string, unknown>;
    try {
      data = (JSON.parse(run.stdout) as { data?: Record<string, unknown> }).data ?? {};
    } catch {
      continue;
    }

    // An id the coordinator does not know reports no review_id back, and a
    // record that answers about a *different* review is no witness for this
    // one — so the reported id has to be the one that was asked about.
    if (data.review_id !== id) continue;

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
  }
  return undefined;
}

/** One memoized, deadline-bound receipt reader for a single blocking-hook invocation. */
export function createReviewReceiptReader(
  projectDirectory: string,
): (id: string) => ReviewReceipt | undefined {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const receipts = new Map<string, ReviewReceipt | undefined>();
  return id => {
    if (!receipts.has(id)) receipts.set(id, readReviewReceipt(id, projectDirectory, deadline));
    return receipts.get(id);
  };
}
