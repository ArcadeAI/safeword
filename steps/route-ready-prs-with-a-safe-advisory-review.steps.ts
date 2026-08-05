import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  reviewPullRequest,
  type PublishedReceipt,
  type ReviewOutcome,
} from '../packages/cli/src/pr-review/review.ts';

type ObservableReceipt = PublishedReceipt & {
  commentId?: number;
  coverage?: Array<{
    path: string;
    skipReason?: string;
    status: 'integrity_reviewed' | 'skipped';
    technologyGate?: string;
  }>;
  markerOwned?: boolean;
  missingChecks?: string[];
  nextAction?: string;
  status?: string;
  unknowns?: string[];
};

interface AdvisoryReviewWorld {
  attempts?: number;
  binaryArtifactPath?: string;
  changedArtifactKind?: 'binary' | 'text';
  changedArtifactPath?: string;
  receiptBeforeTrigger?: string;
  prerequisiteSamples?: number;
  prerequisitesConfigured?: boolean;
  requiredPrerequisites?: string[];
  currentHead?: string;
  missingPrerequisite?: string;
  outcome?: ReviewOutcome;
  prerequisites?: 'failed' | 'passed' | 'pending';
  ready?: boolean;
  receipts?: ObservableReceipt[];
  scheduledReceiptId?: number;
  scheduledState?: 'closed' | 'draft' | 'merged';
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

Given('a pull request has a failing required prerequisite', function (this: AdvisoryReviewWorld) {
  this.ready = true;
  this.prerequisites = 'failed';
});

Given(
  'a ready pull request has no `prReview.requiredChecks` configuration',
  function (this: AdvisoryReviewWorld) {
    this.prerequisitesConfigured = false;
    this.prerequisites = 'pending';
    this.ready = true;
  },
);

Given(
  'a ready pull request explicitly configures no required prerequisites',
  function (this: AdvisoryReviewWorld) {
    this.prerequisitesConfigured = true;
    this.requiredPrerequisites = [];
    this.prerequisites = 'pending';
    this.ready = true;
  },
);

Given('revision A is already completely reviewed', function (this: AdvisoryReviewWorld) {
  this.attempts = 1;
  this.currentHead = 'revision A';
  this.prerequisites = 'passed';
  this.ready = true;
  this.receipts = [
    {
      commentId: 42,
      markerOwned: true,
      reviewedSha: 'revision A',
      route: 'looks_ready',
    },
  ];
  this.receiptBeforeTrigger = JSON.stringify(this.receipts[0]);
});

Given(
  /^scheduled discovery selected a pull request that becomes (draft|closed|merged) before its worker starts$/,
  function (this: AdvisoryReviewWorld, state: 'closed' | 'draft' | 'merged') {
    this.attempts = 0;
    this.currentHead = 'revision A';
    this.prerequisiteSamples = 0;
    this.ready = false;
    this.scheduledState = state;
  },
);

Given(
  /^a ready pull request changes (?:recognized source code|an unfamiliar behavior-affecting file) at `([^`]+)`$/,
  function (this: AdvisoryReviewWorld, path: string) {
    this.changedArtifactKind = 'text';
    this.changedArtifactPath = path;
    this.currentHead = 'revision A';
    this.prerequisites = 'passed';
    this.ready = true;
  },
);

Given(
  /^a ready pull request changes binary artifact `([^`]+)`$/,
  function (this: AdvisoryReviewWorld, path: string) {
    this.changedArtifactKind = 'binary';
    this.changedArtifactPath = path;
    this.currentHead = 'revision A';
    this.prerequisites = 'passed';
    this.ready = true;
  },
);

Given(
  /^a ready pull request changes clean text at `([^`]+)` and binary `([^`]+)`$/,
  function (this: AdvisoryReviewWorld, textPath: string, binaryPath: string) {
    this.binaryArtifactPath = binaryPath;
    this.changedArtifactKind = 'text';
    this.changedArtifactPath = textPath;
    this.currentHead = 'revision A';
    this.prerequisites = 'passed';
    this.ready = true;
  },
);

Given('a marker-owned receipt already exists', function (this: AdvisoryReviewWorld) {
  this.scheduledReceiptId = 43;
  this.receipts = [
    {
      commentId: this.scheduledReceiptId,
      markerOwned: true,
      reviewedSha: 'revision A',
      route: 'looks_ready',
    },
  ];
});

Given('no marker-owned receipt exists', function (this: AdvisoryReviewWorld) {
  this.receipts = [];
});

Given(
  'revision A has a `prerequisites pending` marker-owned receipt',
  function (this: AdvisoryReviewWorld) {
    this.currentHead = 'revision A';
    this.prerequisites = 'pending';
    this.ready = true;
    this.scheduledReceiptId = 41;
    this.receipts = [
      {
        commentId: this.scheduledReceiptId,
        markerOwned: true,
        reviewedSha: 'revision A',
        status: 'prerequisites_pending',
      },
    ];
  },
);

Given(
  'its configured prerequisites settle successfully after the event run exits',
  function (this: AdvisoryReviewWorld) {
    this.prerequisites = 'passed';
  },
);

Given(
  'a configured required-check identity has remained absent since the current head became ready',
  function (this: AdvisoryReviewWorld) {
    this.currentHead = 'revision A';
    this.missingPrerequisite = 'build / required';
    this.prerequisites = 'pending';
    this.ready = true;
  },
);

When('Safeword completes the advisory review', async function (this: AdvisoryReviewWorld) {
  this.attempts = 0;
  this.receipts = [];
  this.outcome = await reviewPullRequest({
    readPullRequest: async () => ({
      headSha: this.currentHead ?? '',
      prerequisitesConfigured: this.prerequisitesConfigured ?? true,
      prerequisites: this.prerequisites ?? 'pending',
      ready: this.ready ?? false,
    }),
    inspect: async () => {
      this.attempts = (this.attempts ?? 0) + 1;
      const binaryPath =
        this.binaryArtifactPath ??
        (this.changedArtifactKind === 'binary' ? this.changedArtifactPath : undefined);
      return {
        artifacts: binaryPath ? [{ kind: 'non_text' as const, path: binaryPath }] : undefined,
        consequentialFindings: 0,
        coverage:
          this.changedArtifactKind === 'text' && this.changedArtifactPath
            ? [{ path: this.changedArtifactPath, status: 'integrity_reviewed' as const }]
            : undefined,
        unknowns: [],
      };
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

Then(
  /^the current receipt marks `([^`]+)` as integrity-reviewed$/,
  function (this: AdvisoryReviewWorld, path: string) {
    const coverage = this.receipts?.[0]?.coverage?.find(entry => entry.path === path);
    assert.equal(coverage?.status, 'integrity_reviewed');
  },
);

Then(
  'the coverage entry records no technology-specific skip or gate',
  function (this: AdvisoryReviewWorld) {
    const coverage = this.receipts?.[0]?.coverage?.find(
      entry => entry.path === this.changedArtifactPath,
    );
    assert.equal(coverage?.skipReason, undefined);
    assert.equal(coverage?.technologyGate, undefined);
  },
);

Then(
  /^the current receipt marks `([^`]+)` as skipped because it is non-text$/,
  function (this: AdvisoryReviewWorld, path: string) {
    const coverage = this.receipts?.[0]?.coverage?.find(entry => entry.path === path);
    assert.equal(coverage?.status, 'skipped');
    assert.equal(coverage?.skipReason, 'non_text');
  },
);

Then(
  /^it does not mark `([^`]+)` as integrity-reviewed$/,
  function (this: AdvisoryReviewWorld, path: string) {
    const coverage = this.receipts?.[0]?.coverage?.find(entry => entry.path === path);
    assert.notEqual(coverage?.status, 'integrity_reviewed');
  },
);

Then(
  /^`([^`]+)` is marked integrity-reviewed$/,
  function (this: AdvisoryReviewWorld, path: string) {
    const coverage = this.receipts?.[0]?.coverage?.find(entry => entry.path === path);
    assert.equal(coverage?.status, 'integrity_reviewed');
  },
);

Then(
  /^`([^`]+)` is marked skipped as non-text without becoming an unknown$/,
  function (this: AdvisoryReviewWorld, path: string) {
    const receipt = this.receipts?.[0];
    const coverage = receipt?.coverage?.find(entry => entry.path === path);
    assert.equal(coverage?.status, 'skipped');
    assert.equal(coverage?.skipReason, 'non_text');
    assert.deepEqual(receipt?.unknowns, []);
  },
);

Then('the complete current route is `looks ready`', function (this: AdvisoryReviewWorld) {
  const receipt = this.receipts?.[0];
  assert.equal(receipt && 'route' in receipt && receipt.route, 'looks_ready');
});

When('Safeword evaluates review eligibility', async function (this: AdvisoryReviewWorld) {
  this.attempts = 0;
  this.receipts = [];
  this.summary = undefined;
  const dependencies = {
    readPullRequest: async () => ({
      headSha: this.currentHead ?? '',
      prerequisitesConfigured: this.prerequisitesConfigured ?? true,
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
  'the current receipt still reports `prerequisites pending`',
  function (this: AdvisoryReviewWorld) {
    assert.equal(this.receipts?.[0]?.status, 'prerequisites_pending');
  },
);

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

Then('the current receipt reports `prerequisites failed`', function (this: AdvisoryReviewWorld) {
  assert.equal(this.receipts?.[0]?.status, 'prerequisites_failed');
});

Then(
  'no model review runs after the failed prerequisite is observed',
  function (this: AdvisoryReviewWorld) {
    assert.equal(this.attempts, 0);
  },
);

Then('no advisory route is published', function (this: AdvisoryReviewWorld) {
  assert.equal(
    this.receipts?.some(receipt => 'route' in receipt),
    false,
  );
});

Then(
  'the current receipt reports `prerequisites unconfigured`',
  function (this: AdvisoryReviewWorld) {
    assert.equal(this.receipts?.[0]?.status, 'prerequisites_unconfigured');
  },
);

Then(
  'it tells the builder to set `prReview.requiredChecks` explicitly',
  function (this: AdvisoryReviewWorld) {
    assert.equal(this.receipts?.[0]?.nextAction, 'Set prReview.requiredChecks explicitly.');
  },
);

When(
  'the same triggered run evaluates eligibility and performs the advisory review',
  async function (this: AdvisoryReviewWorld) {
    this.attempts = 0;
    this.receipts = [];
    this.outcome = await reviewPullRequest({
      readPullRequest: async () => ({
        headSha: this.currentHead ?? '',
        prerequisitesConfigured: this.prerequisitesConfigured ?? true,
        requiredPrerequisites: this.requiredPrerequisites,
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
  },
);

Then(
  'the same triggered run completes the advisory review for revision A',
  function (this: AdvisoryReviewWorld) {
    assert.equal(this.outcome?.reviewedSha, 'revision A');
    assert.equal(this.attempts, 1);
  },
);

Then('it publishes the current receipt for revision A', function (this: AdvisoryReviewWorld) {
  assert.deepEqual(this.receipts, [{ reviewedSha: 'revision A', route: 'looks_ready' }]);
});

When('another eligible trigger arrives for revision A', async function (this: AdvisoryReviewWorld) {
  this.summary = undefined;
  this.outcome = await reviewPullRequest({
    readPullRequest: async () => ({
      headSha: this.currentHead ?? '',
      prerequisitesConfigured: true,
      prerequisites: this.prerequisites ?? 'pending',
      ready: this.ready ?? false,
      reviewedReceiptSha: this.receipts?.[0]?.reviewedSha,
    }),
    inspect: async () => {
      this.attempts = (this.attempts ?? 0) + 1;
      return { consequentialFindings: 0, unknowns: [] };
    },
    publish: async receipt => {
      this.receipts?.splice(0, this.receipts.length, receipt);
    },
    summarize: async summary => {
      this.summary = summary;
    },
  });
});

Then('no second review attempt runs', function (this: AdvisoryReviewWorld) {
  assert.equal(this.outcome?.attempts, 0);
});

Then(
  'the workflow run summary records the trigger as `suppressed`',
  function (this: AdvisoryReviewWorld) {
    assert.equal(this.summary, 'suppressed');
  },
);

Then("revision A's review attempt count remains one", function (this: AdvisoryReviewWorld) {
  assert.equal(this.attempts, 1);
});

Then(
  'its marker-owned receipt remains byte-for-byte unchanged',
  function (this: AdvisoryReviewWorld) {
    assert.equal(JSON.stringify(this.receipts?.[0]), this.receiptBeforeTrigger);
  },
);

When('the worker revalidates the pull request', async function (this: AdvisoryReviewWorld) {
  this.summary = undefined;
  const world = this;
  this.outcome = await reviewPullRequest({
    readPullRequest: async () => ({
      headSha: this.currentHead ?? '',
      markerReceiptExists: (this.receipts?.length ?? 0) > 0,
      prerequisitesConfigured: true,
      get prerequisites() {
        world.prerequisiteSamples = (world.prerequisiteSamples ?? 0) + 1;
        return 'passed' as const;
      },
      ready: this.ready ?? false,
      state: this.scheduledState,
    }),
    inspect: async () => {
      this.attempts = (this.attempts ?? 0) + 1;
      return { consequentialFindings: 0, unknowns: [] };
    },
    publish: async receipt => {
      this.receipts?.splice(0, this.receipts.length, {
        ...receipt,
        commentId: this.scheduledReceiptId,
        markerOwned: true,
      });
    },
    summarize: async summary => {
      this.summary = summary;
    },
  });
});

Then('no prerequisite sampling or model review runs', function (this: AdvisoryReviewWorld) {
  assert.equal(this.prerequisiteSamples, 0);
  assert.equal(this.attempts, 0);
});

Then(
  /^an existing marker-owned receipt is rewritten as `not ready \((draft|closed|merged)\)` with no advisory route$/,
  function (this: AdvisoryReviewWorld, state: 'closed' | 'draft' | 'merged') {
    assert.equal(this.receipts?.length, 1);
    assert.equal(this.receipts[0]?.markerOwned, true);
    assert.equal(this.receipts[0]?.commentId, this.scheduledReceiptId);
    assert.equal(this.receipts[0]?.status, 'not_ready');
    assert.equal('reason' in (this.receipts[0] ?? {}) && this.receipts[0].reason, state);
    assert.equal('route' in (this.receipts[0] ?? {}), false);
  },
);

Then('no receipt is created', function (this: AdvisoryReviewWorld) {
  assert.deepEqual(this.receipts, []);
});

Then(
  /^the workflow run summary records `not ready \((draft|closed|merged)\)`$/,
  function (this: AdvisoryReviewWorld, state: 'closed' | 'draft' | 'merged') {
    assert.equal(this.summary, `not ready (${state})`);
  },
);

When('a later scheduled sweep evaluates revision A', async function (this: AdvisoryReviewWorld) {
  this.attempts = 0;
  this.outcome = await reviewPullRequest({
    readPullRequest: async () => ({
      headSha: this.currentHead ?? '',
      prerequisitesConfigured: this.prerequisitesConfigured ?? true,
      prerequisites: this.prerequisites ?? 'pending',
      ready: this.ready ?? false,
    }),
    inspect: async () => {
      this.attempts = (this.attempts ?? 0) + 1;
      return { consequentialFindings: 0, unknowns: [] };
    },
    publish: async (receipt, mode?: 'upsert_marker_owned') => {
      const markerIndex = this.receipts?.findIndex(candidate => candidate.markerOwned) ?? -1;
      if (mode === 'upsert_marker_owned' && markerIndex >= 0) {
        this.receipts?.splice(markerIndex, 1, {
          ...receipt,
          commentId: this.receipts[markerIndex]?.commentId,
          markerOwned: true,
        });
        return;
      }
      this.receipts?.push(receipt);
    },
  });
});

Then(
  'that sweep completes the advisory review for revision A',
  function (this: AdvisoryReviewWorld) {
    assert.equal(this.outcome?.reviewedSha, 'revision A');
    assert.equal(this.attempts, 1);
  },
);

Then(
  'it updates the same marker-owned receipt with the current route',
  function (this: AdvisoryReviewWorld) {
    assert.equal(this.receipts?.length, 1);
    assert.equal(this.receipts[0]?.commentId, this.scheduledReceiptId);
    assert.equal(this.receipts[0]?.markerOwned, true);
    assert.equal('route' in (this.receipts[0] ?? {}), true);
    assert.equal(
      this.receipts[0] && 'route' in this.receipts[0] && this.receipts[0].route,
      'looks_ready',
    );
  },
);

When('a later scheduled sweep samples that exact head', async function (this: AdvisoryReviewWorld) {
  this.attempts = 0;
  this.receipts = [];
  const dependencies = {
    readPullRequest: async () => ({
      headSha: this.currentHead ?? '',
      missingPrerequisites: [this.missingPrerequisite ?? ''],
      prerequisitesConfigured: this.prerequisitesConfigured ?? true,
      prerequisites: this.prerequisites ?? 'pending',
      ready: this.ready ?? false,
    }),
    inspect: async () => {
      this.attempts = (this.attempts ?? 0) + 1;
      return { consequentialFindings: 0, unknowns: [] };
    },
    publish: async (receipt: PublishedReceipt) => {
      this.receipts?.push(receipt);
    },
  };

  this.outcome = await reviewPullRequest(dependencies);
});

Then('no advisory route or model review is produced', function (this: AdvisoryReviewWorld) {
  assert.equal(
    this.receipts?.some(receipt => 'route' in receipt),
    false,
  );
  assert.equal(this.attempts, 0);
});

Then('the sole receipt names the missing check identity', function (this: AdvisoryReviewWorld) {
  assert.deepEqual(this.receipts?.[0]?.missingChecks, [this.missingPrerequisite]);
});

Then(
  'it tells the builder to verify the check or `prReview.requiredChecks` configuration',
  function (this: AdvisoryReviewWorld) {
    assert.equal(
      this.receipts?.[0]?.nextAction,
      'Verify the check or prReview.requiredChecks configuration.',
    );
  },
);
