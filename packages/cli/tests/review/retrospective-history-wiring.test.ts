import { expect, it, vi } from 'vitest';

vi.mock('../../src/review/retrospective-history-core.js', () => ({
  RETROSPECTIVE_TICKET: 'CKWE2D',
  checkHistoryAgainstTrustedCutoff: vi.fn(() => ({ eligibleForReview: true })),
}));

import { checkRetrospectiveHistory } from '../../src/review/retrospective-history.js';
import { checkHistoryAgainstTrustedCutoff } from '../../src/review/retrospective-history-core.js';

it('passes the immutable authorized cutoff to the Git-history mechanism', () => {
  const request = {
    ticketId: 'CKWE2D',
    cutoff: '690536ec56c07c2b042108d9c31d28bc3bc82619',
    baseline: '690536ec56c07c2b042108d9c31d28bc3bc82619',
    rationale: 'Implementation predates this migration.',
  };
  expect(checkRetrospectiveHistory('/project', request)).toEqual({ eligibleForReview: true });
  expect(checkHistoryAgainstTrustedCutoff).toHaveBeenCalledExactlyOnceWith(
    '/project',
    request,
    '690536ec56c07c2b042108d9c31d28bc3bc82619',
  );
});
