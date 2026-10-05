import { type BaselineBlobClaim, validateBaselineBlobClaims } from './retrospective-baseline.js';
import {
  checkRetrospectiveHistory,
  type RetrospectiveHistoryRequest,
  type RetrospectiveHistoryResult,
} from './retrospective-history.js';

/** Structural order: never inspect blobs until the fixed cutoff and baseline pass. */
export function checkRetrospectivePrerequisites(
  projectRoot: string,
  request: RetrospectiveHistoryRequest,
  blobs: readonly BaselineBlobClaim[],
): RetrospectiveHistoryResult {
  const history = checkRetrospectiveHistory(projectRoot, request);
  if (!history.eligibleForReview) return history;
  const checkedBlobs = validateBaselineBlobClaims(projectRoot, request.baseline, blobs);
  return checkedBlobs.valid
    ? { eligibleForReview: true }
    : { eligibleForReview: false, reason: checkedBlobs.reason };
}
