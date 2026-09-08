// Safeword: holding a written stamp to its claim at gate time (ticket PB1GMZ).
//
// write-review-stamp.ts refuses to write an independence claim the coordinator
// does not witness. That is not enough on its own: the ledger is a plain text
// file, so a line appended directly never passed through that hook. Requiring
// the line to carry a `review-id` only raises the bar to "any token" —
// `review-id:not-real` parses.
//
// So the gate re-checks the claim against the coordinator before honouring it,
// through the same pure decision core the write path uses. A stamp whose claim
// cannot be witnessed is dropped, and the gate then sees what it should have
// seen all along: no satisfying stamp.
//
// This costs one `review status` call per claimed stamp at a gate boundary, and
// only for stamps that claim a coordinator verdict — self-review stamps and
// skips never reach the coordinator at all.

import nodePath from 'node:path';

import { createReviewReceiptReader } from './read-receipt.js';
import { claimFromScope, claimsCoordinatorVerdict, receiptGateVerdict } from './review-receipt.js';
import type { ReviewStamp } from './review-ledger.js';
import { resolveNamespaceRoot } from './namespace-root.js';

/**
 * The stamps that may be trusted, dropping any whose coordinator claim the
 * cited review does not actually witness. Stamps claiming no coordinator
 * verdict pass through untouched — they assert nothing needing a witness.
 */
export function verifiedStamps(
  stamps: readonly ReviewStamp[],
  projectDirectory: string,
  scope: string,
): ReviewStamp[] {
  const readReceipt = createReviewReceiptReader(projectDirectory);
  return stamps
    .filter(stamp => stamp.scope === scope)
    .filter(stamp => {
      if (stamp.skipReason !== undefined || !claimsCoordinatorVerdict(stamp.independence))
        return true;
      if (stamp.reviewId === undefined) return false;

      const claim = claimFromScope(stamp.scope, {
        projectDirectory,
        ticketDirectory: nodePath.join(
          resolveNamespaceRoot(projectDirectory),
          'tickets',
          stamp.scope.slice(0, stamp.scope.indexOf(':')),
        ),
        independence: stamp.independence,
        authorAgent: stamp.author,
        reviewerAgent: stamp.reviewer,
      });
      if (claim === undefined) return false;

      return receiptGateVerdict(claim, readReceipt(stamp.reviewId)).ok;
    });
}
