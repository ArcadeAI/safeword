import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  reviewPullRequest,
  type PublishedReceipt,
  type ReviewOutcome,
} from '../packages/cli/src/pr-review/review.ts';

interface AdvisoryReviewWorld {
  attempts?: number;
  currentHead?: string;
  outcome?: ReviewOutcome;
  prerequisites?: 'passed';
  ready?: boolean;
  receipts?: PublishedReceipt[];
}

Given(
  'a pull request is ready and its required prerequisites have settled successfully',
  function (this: AdvisoryReviewWorld) {
    this.ready = true;
    this.prerequisites = 'passed';
  },
);

Given('its current head is revision A', function (this: AdvisoryReviewWorld) {
  this.currentHead = 'revision A';
});

When('Safeword completes the advisory review', async function (this: AdvisoryReviewWorld) {
  this.attempts = 0;
  this.receipts = [];
  this.outcome = await reviewPullRequest({
    readPullRequest: async () => ({
      headSha: this.currentHead ?? '',
      prerequisites: this.prerequisites ?? 'pending',
      ready: this.ready ?? false,
    }),
    inspect: async () => {
      this.attempts = (this.attempts ?? 0) + 1;
      return { consequentialFindings: 0, unknowns: [] };
    },
    publish: async receipt => {
      this.receipts?.splice(0, this.receipts.length, receipt);
    },
  });
});

Then('the reviewed revision is A', function (this: AdvisoryReviewWorld) {
  assert.equal(this.outcome?.reviewedSha, 'revision A');
});

Then('the review attempt count for revision A is one', function (this: AdvisoryReviewWorld) {
  assert.equal(this.attempts, 1);
  assert.equal(this.outcome?.attempts, 1);
});

Then('exactly one current receipt exists for revision A', function (this: AdvisoryReviewWorld) {
  assert.deepEqual(this.receipts, [{ reviewedSha: 'revision A', route: 'looks_ready' }]);
});
