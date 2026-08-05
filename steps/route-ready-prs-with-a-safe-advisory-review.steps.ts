import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  reviewPullRequest,
  type PublishedReceipt,
  type ReviewOutcome,
} from '../packages/cli/src/pr-review/review.ts';

type ObservableReceipt = PublishedReceipt & {
  markerOwned?: boolean;
  status?: string;
};

interface AdvisoryReviewWorld {
  attempts?: number;
  currentHead?: string;
  outcome?: ReviewOutcome;
  prerequisites?: 'passed' | 'pending';
  ready?: boolean;
  receipts?: ObservableReceipt[];
  summary?: string;
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

Given('a pull request is still a draft', function (this: AdvisoryReviewWorld) {
  this.ready = false;
  this.prerequisites = 'pending';
});

Given(
  'a pull request is waiting for a required prerequisite',
  function (this: AdvisoryReviewWorld) {
    this.ready = true;
    this.prerequisites = 'pending';
  },
);

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

When('Safeword evaluates review eligibility', async function (this: AdvisoryReviewWorld) {
  this.attempts = 0;
  this.receipts = [];
  this.summary = undefined;
  const dependencies = {
    readPullRequest: async () => ({
      headSha: this.currentHead ?? '',
      prerequisites: this.prerequisites ?? 'pending',
      ready: this.ready ?? false,
    }),
    inspect: async () => {
      this.attempts = (this.attempts ?? 0) + 1;
      return { consequentialFindings: 0, unknowns: [] };
    },
    publish: async (receipt: PublishedReceipt) => {
      this.receipts?.splice(0, this.receipts.length, receipt);
    },
    summarize: async (summary: string) => {
      this.summary = summary;
    },
  };

  this.outcome = await reviewPullRequest(dependencies);
});

Then(
  'no `looks ready` or `needs a human` route is published',
  function (this: AdvisoryReviewWorld) {
    assert.equal(
      this.receipts?.some(receipt => 'route' in receipt),
      false,
    );
    assert.equal(this.attempts, 0);
  },
);

Then(
  /^the workflow run summary reports `not ready \(draft\)`$/,
  function (this: AdvisoryReviewWorld) {
    assert.equal(this.summary, 'not ready (draft)');
  },
);

Then('no receipt is created or updated', function (this: AdvisoryReviewWorld) {
  assert.deepEqual(this.receipts, []);
});

Then('the current receipt reports `prerequisites pending`', function (this: AdvisoryReviewWorld) {
  assert.equal(this.receipts?.[0]?.status, 'prerequisites_pending');
});

Then(
  'exactly one marker-owned receipt comment exists on the pull request',
  function (this: AdvisoryReviewWorld) {
    assert.equal(this.receipts?.length, 1);
    assert.equal(this.receipts[0]?.markerOwned, true);
  },
);

Then(
  'no model review runs after the pending prerequisite is observed',
  function (this: AdvisoryReviewWorld) {
    assert.equal(this.attempts, 0);
  },
);
