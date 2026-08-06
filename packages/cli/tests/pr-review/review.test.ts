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

  it('does not imply partial coverage when the change set exceeds the total budget', async () => {
    let publishedReceipt: PublishedReceipt | undefined;

    await reviewPullRequest({
      inspect: () =>
        Promise.resolve({
          artifacts: [
            { byteLength: 90, kind: 'text' as const, path: 'src/large.ts' },
            { byteLength: 20, kind: 'text' as const, path: 'src/small.ts' },
          ],
          consequentialFindings: 0,
          maxTotalBytes: 100,
          unknowns: [],
        }),
      publish: receipt => {
        publishedReceipt = receipt;
        return Promise.resolve();
      },
      readPullRequest: () =>
        Promise.resolve({
          headSha: 'revision-b',
          prerequisites: 'passed',
          prerequisitesConfigured: true,
          ready: true,
        }),
    });

    expect(publishedReceipt).toMatchObject({
      coverage: [],
      missingEvidence: ['src/large.ts', 'src/small.ts'],
      route: 'needs_human',
      runState: 'incomplete',
    });
  });
});
