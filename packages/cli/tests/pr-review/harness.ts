// Shared fixtures for the pr-review suite (ticket 36EEMY, cross-scenario refactor).
//
// The recording poster was copied into three test files and the pull-request
// context into five. Duplicated fixtures drift: one copy gains a field, the
// others quietly keep testing the old shape, and the divergence is invisible
// because every file still passes.

import {
  createReviewPoster,
  type GitHubCall,
  type ReviewPoster,
} from '../../src/pr-review/poster.js';

/** The pull request every test in this suite reviews. */
export const REVIEW_CONTEXT = {
  owner: 'acme',
  repo: 'monorepo',
  pull: 42,
  headSha: 'deadbeef',
};

export interface PosterHarness {
  /** Every GitHub call the poster made, in order. */
  calls: GitHubCall[];
  /** Ordering probe — `'post'` is appended per call, so tests can assert sequence. */
  order: string[];
  poster: ReviewPoster;
}

/**
 * A real `ReviewPoster` over a recording transport.
 *
 * The poster itself is NOT mocked: its endpoint allow-list, which is the whole
 * SM1.R3 guarantee, runs for real. Only the network boundary is faked.
 */
export function recordingPoster(): PosterHarness {
  const calls: GitHubCall[] = [];
  const order: string[] = [];

  const poster = createReviewPoster((method: string, path: string, body?: unknown) => {
    calls.push({ method, path, body });
    order.push('post');
    return Promise.resolve({});
  }, REVIEW_CONTEXT);

  return { calls, order, poster };
}

/** Comments posted so far — the count most scenarios assert on. */
export function commentCount(calls: GitHubCall[]): number {
  return calls.filter(call => call.path.endsWith('/comments')).length;
}
