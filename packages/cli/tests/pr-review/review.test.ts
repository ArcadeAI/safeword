import { describe, expect, it } from 'vitest';

import { type PublishedReceipt, reviewPullRequest } from '../../src/pr-review/review.js';

describe('advisory review evidence floor', () => {
  it('routes an empty integrity input to a human', async () => {
    let publishedReceipt: PublishedReceipt | undefined;

    await reviewPullRequest({
      inspect: () => Promise.resolve({ consequentialFindings: 0, unknowns: [] }),
      publish: receipt => {
        publishedReceipt = receipt;
        return Promise.resolve();
      },
      readPullRequest: () =>
        Promise.resolve({
          headSha: 'revision-a',
          prerequisites: 'passed',
          prerequisitesConfigured: true,
          ready: true,
        }),
    });

    expect(publishedReceipt).toMatchObject({
      reviewedSha: 'revision-a',
      route: 'needs_human',
      runState: 'incomplete',
    });
  });
});
