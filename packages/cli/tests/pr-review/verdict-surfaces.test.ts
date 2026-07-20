import { describe, expect, it } from 'vitest';

import { createReviewPoster, type GitHubCall } from '../../src/pr-review/poster.js';
import { postVerdict, RECEIPT_CHECK_NAME, type Review } from '../../src/pr-review/verdict.js';

const CONTEXT = { owner: 'acme', repo: 'monorepo', pull: 42, headSha: 'deadbeef' };

function recordingPoster() {
  const calls: GitHubCall[] = [];
  const poster = createReviewPoster((method: string, path: string, body?: unknown) => {
    calls.push({ method, path, body });
    return Promise.resolve({});
  }, CONTEXT);
  return { calls, poster };
}

const commentCount = (calls: GitHubCall[]) =>
  calls.filter(c => c.path.endsWith('/comments')).length;

const recordedVerdict = (calls: GitHubCall[]) => {
  const receipt = calls.find(c => c.path.endsWith('/check-runs'));
  return (receipt?.body as { output?: { title?: string } } | undefined)?.output?.title;
};

const uncoveredDefect = {
  path: 'src/auth.ts',
  line: 12,
  consequence: 'The token is compared with ==, so a prefix match authenticates.',
};

describe('autonomous-pr-review.TB1.R9 — every review records a verdict (36EEMY slice 4)', () => {
  const rows = [
    { state: 'nothing rising to a human', verdict: 'reviewed', comments: 0 },
    { state: 'one uncovered defect on a changed line', verdict: 'needs-a-human', comments: 1 },
  ] as const;

  it.each(rows)(
    'autonomous-pr-review.TB1.R9.a_clean_pr_is_marked_reviewed_and_a_flagged_one_needs_a_human [$state]',
    async ({ verdict, comments }) => {
      const { calls, poster } = recordingPoster();
      const review: Review = {
        verdict,
        findings: comments > 0 ? [uncoveredDefect] : [],
        decision: comments > 0 ? 'push back' : undefined,
      };

      await postVerdict(review, poster);

      // A verdict is RECORDED either way — pure silence is ambiguous with
      // "the reviewer never ran", which is the whole reason the receipt exists.
      expect(recordedVerdict(calls)).toBe(verdict);
      expect(commentCount(calls)).toBe(comments);
    },
  );

  it('the receipt is never a failure — the reviewer is advisory and gates nothing', async () => {
    const { calls, poster } = recordingPoster();
    await postVerdict({ verdict: 'needs-a-human', findings: [uncoveredDefect] }, poster);

    const receipt = calls.find(c => c.path.endsWith('/check-runs'));
    expect((receipt?.body as { conclusion?: string })?.conclusion).toBe('neutral');
    expect((receipt?.body as { name?: string })?.name).toBe(RECEIPT_CHECK_NAME);
  });
});

describe('autonomous-pr-review.TB1.R2 — silence only when there is nothing to say', () => {
  const rows = [
    { state: 'all already covered by the project tests', findings: [], count: 0 },
    { state: 'one uncovered defect on a changed line', findings: [uncoveredDefect], count: 1 },
  ] as const;

  it.each(rows)(
    'autonomous-pr-review.TB1.R2.silence_only_when_there_is_nothing_to_say [$state]',
    async ({ findings, count }) => {
      // NOTE: at this layer "already covered" simply means the finding set
      // arrived empty. That subtraction is R1's job (slice 5); what is proven
      // here is that an empty set posts nothing while a single finding posts
      // once — so a runner that always comments, or never does, fails a row.
      const { calls, poster } = recordingPoster();
      await postVerdict(
        { verdict: count > 0 ? 'needs-a-human' : 'reviewed', findings: [...findings] },
        poster,
      );

      expect(commentCount(calls)).toBe(count);
    },
  );

  it('one comment per finding — the review neither pads nor truncates', async () => {
    const { calls, poster } = recordingPoster();
    await postVerdict(
      {
        verdict: 'needs-a-human',
        findings: [
          uncoveredDefect,
          { ...uncoveredDefect, line: 40 },
          { ...uncoveredDefect, path: 'src/db.ts', line: 7 },
        ],
      },
      poster,
    );

    expect(commentCount(calls)).toBe(3);
  });
});
