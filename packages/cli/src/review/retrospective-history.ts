import {
  checkHistoryAgainstTrustedCutoff,
  type RetrospectiveHistoryRequest,
  type RetrospectiveHistoryResult,
} from './retrospective-history-core.js';

export type {
  RetrospectiveHistoryRequest,
  RetrospectiveHistoryResult,
} from './retrospective-history-core.js';
export { RETROSPECTIVE_TICKET } from './retrospective-history-core.js';

export const RETROSPECTIVE_CUTOFF = '690536ec56c07c2b042108d9c31d28bc3bc82619';
export const RETROSPECTIVE_LEDGER =
  '.project/tickets/CKWE2D-keep-reviews-focused-on-authored-inputs/test-definitions.md';
export const RETROSPECTIVE_FEATURE =
  'packages/cli/features/keep-reviews-focused-on-authored-inputs.feature';

/** Historical eligibility is only a prerequisite; it never authorizes VERIFIED. */
export function checkRetrospectiveHistory(
  projectRoot: string,
  request: RetrospectiveHistoryRequest,
): RetrospectiveHistoryResult {
  return checkHistoryAgainstTrustedCutoff(projectRoot, request, RETROSPECTIVE_CUTOFF);
}
