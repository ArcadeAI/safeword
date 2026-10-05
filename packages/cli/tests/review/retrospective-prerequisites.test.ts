import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../../src/review/retrospective-history.js', () => ({
  checkRetrospectiveHistory: vi.fn(),
}));
vi.mock('../../src/review/retrospective-baseline.js', () => ({
  validateBaselineBlobClaims: vi.fn(),
}));

import { validateBaselineBlobClaims } from '../../src/review/retrospective-baseline.js';
import { checkRetrospectiveHistory } from '../../src/review/retrospective-history.js';
import { checkRetrospectivePrerequisites } from '../../src/review/retrospective-prerequisites.js';

const request = {
  ticketId: 'CKWE2D',
  cutoff: '690536ec56c07c2b042108d9c31d28bc3bc82619',
  baseline: '690536ec56c07c2b042108d9c31d28bc3bc82619',
  rationale: 'Implementation predated the evidence migration.',
};
const blobs = [
  { baselinePath: 'src/behavior.ts', currentPath: 'src/behavior.ts', blobSha: 'a'.repeat(40) },
];

beforeEach(() => vi.clearAllMocks());

it('refuses a bad cutoff or ticket before any blob inspection', () => {
  vi.mocked(checkRetrospectiveHistory).mockReturnValue({
    eligibleForReview: false,
    reason: 'cutoff denied',
  });
  expect(checkRetrospectivePrerequisites('/project', request, blobs)).toEqual({
    eligibleForReview: false,
    reason: 'cutoff denied',
  });
  expect(validateBaselineBlobClaims).not.toHaveBeenCalled();
});

it('refuses invalid baseline blobs after history passes', () => {
  vi.mocked(checkRetrospectiveHistory).mockReturnValue({ eligibleForReview: true });
  vi.mocked(validateBaselineBlobClaims).mockReturnValue({ valid: false, reason: 'blob mismatch' });
  expect(checkRetrospectivePrerequisites('/project', request, blobs)).toEqual({
    eligibleForReview: false,
    reason: 'blob mismatch',
  });
  expect(validateBaselineBlobClaims).toHaveBeenCalledExactlyOnceWith(
    '/project',
    request.baseline,
    blobs,
  );
});

it('reports only prerequisite eligibility when both checks pass', () => {
  vi.mocked(checkRetrospectiveHistory).mockReturnValue({ eligibleForReview: true });
  vi.mocked(validateBaselineBlobClaims).mockReturnValue({ valid: true });
  expect(checkRetrospectivePrerequisites('/project', request, blobs)).toEqual({
    eligibleForReview: true,
  });
});
