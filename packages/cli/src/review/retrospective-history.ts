import {
  checkHistoryAgainstTrustedCutoff,
  type RetrospectiveHistoryRequest,
  type RetrospectiveHistoryResult,
} from './retrospective-history-core.js';
import {
  LEGACY_RETROSPECTIVE_POLICY,
  matchesMigrationOrigin,
  retrospectivePolicy,
} from './retrospective-policy.js';

export type {
  RetrospectiveHistoryRequest,
  RetrospectiveHistoryResult,
} from './retrospective-history-core.js';
export { RETROSPECTIVE_TICKET } from './retrospective-history-core.js';

export const RETROSPECTIVE_CUTOFF = LEGACY_RETROSPECTIVE_POLICY.cutoff;
export const RETROSPECTIVE_LEDGER = LEGACY_RETROSPECTIVE_POLICY.ledger;
export const RETROSPECTIVE_FEATURE = LEGACY_RETROSPECTIVE_POLICY.feature;

/** Historical eligibility is only a prerequisite; it never authorizes VERIFIED. */
export function checkRetrospectiveHistory(
  projectRoot: string,
  request: RetrospectiveHistoryRequest,
): RetrospectiveHistoryResult {
  const policy = retrospectivePolicy(request.ticketId);
  if (policy?.runner === 'playwright-electron') {
    if (!matchesMigrationOrigin(projectRoot, policy)) {
      return {
        eligibleForReview: false,
        reason: 'The approved migration repository does not match.',
      };
    }
    return checkHistoryAgainstTrustedCutoff(projectRoot, request, policy.cutoff, policy.ticketId);
  }
  return checkHistoryAgainstTrustedCutoff(projectRoot, request, RETROSPECTIVE_CUTOFF);
}
