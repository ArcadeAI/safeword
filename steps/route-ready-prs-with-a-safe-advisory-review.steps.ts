import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  reviewPullRequest,
  type PublishedReceipt,
  type ReviewOutcome,
} from '../packages/cli/src/pr-review/review.ts';
import {
  planReceiptPublication,
  publishReceipt,
  renderReceipt,
} from '../packages/cli/src/pr-review/publish.ts';

const RECEIPT_MARKER = '<!-- safeword:pr-review-receipt:v1 -->';

type ObservableReceipt = PublishedReceipt & {
  commentId?: number;
  coverage?: Array<{
    path: string;
    skipReason?: string;
    status: 'integrity_reviewed' | 'skipped';
    technologyGate?: string;
  }>;
  findings?: Array<{ consequence: string; path: string }>;
  markerOwned?: boolean;
  missingEvidence?: string[];
  missingChecks?: string[];
  nextAction?: string;
  reviewableTextArtifacts?: number;
  runState?: 'complete' | 'failed' | 'incomplete' | 'stale';
  status?: string;
  unknowns?: string[];
};

interface AdvisoryReviewWorld {
  actionableFinding?: {
    consequence: string;
    evidence: string;
    line: number;
    nextAction: string;
    path: string;
    unverifiedRemedy: string;
  };
  attempts?: number;
  binaryArtifactPath?: string;
  changedArtifactKind?: 'binary' | 'text';
  changedArtifactPath?: string;
  commentMutations?: string[];
  evidenceArtifacts?: Array<{ byteLength: number; path: string }>;
  finding?: { consequence: string; path: string };
  inputTokens?: number;
  evidenceState?: string;
  existingReviewedSha?: string;
  maxTotalBytes?: number;
  receiptBeforeTrigger?: string;
  prerequisiteSamples?: number;
  prerequisitesConfigured?: boolean;
  protectedCommentBefore?: string;
  protectedCommentId?: number;
  renderedReceipt?: string;
  receiptRunState?: 'complete' | 'failed' | 'incomplete' | 'stale';
  requiredPrerequisites?: string[];
  currentHead?: string;
  missingPrerequisite?: string;
  outcome?: ReviewOutcome;
  prerequisites?: 'failed' | 'passed' | 'pending';
  ready?: boolean;
  receipts?: ObservableReceipt[];
  receiptComments?: Array<{
    authorType: 'Bot' | 'User';
    body: string;
    createdAt: string;
    id: number;
  }>;
  runConditions?: Array<'complete' | 'failed' | 'incomplete' | 'stale'>;
  scheduledReceiptId?: number;
  scheduledState?: 'closed' | 'draft' | 'merged';
  summary?: string;
  outputTokens?: number;
  unresolvedCheck?: string;
}

function conditionState(condition: string): 'complete' | 'failed' | 'incomplete' | 'stale' {
  if (condition.includes('no longer current')) return 'stale';
  if (condition.includes('reviewer or tool error')) return 'failed';
  if (
    condition.includes('missing required evidence') ||
    condition.includes('required evidence is missing')
  ) {
    return 'incomplete';
  }
  return 'complete';
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

Given(
  /^a ready pull request changes only binary `([^`]+)`$/,
  function (this: AdvisoryReviewWorld, path: string) {
    this.changedArtifactKind = 'binary';
    this.changedArtifactPath = path;
    this.currentHead = 'revision A';
    this.prerequisites = 'passed';
    this.ready = true;
  },
);

Given(
  "a ready pull request's changed text exceeds `maxTotalBytes`",
  function (this: AdvisoryReviewWorld) {
    this.currentHead = 'revision A';
    this.evidenceArtifacts = [
      { byteLength: 60, path: 'src/first.ts' },
      { byteLength: 50, path: 'src/over-budget.ts' },
    ];
    this.maxTotalBytes = 100;
    this.prerequisites = 'passed';
    this.ready = true;
  },
);

Given(
  "a ready pull request's readable changed text totals exactly `maxTotalBytes`",
  function (this: AdvisoryReviewWorld) {
    this.currentHead = 'revision A';
    this.evidenceArtifacts = [
      { byteLength: 40, path: 'src/first.ts' },
      { byteLength: 60, path: 'src/exact-boundary.ts' },
    ];
    this.maxTotalBytes = 100;
    this.prerequisites = 'passed';
    this.ready = true;
  },
);

Given(
  'an unfamiliar artifact reached the integrity reviewer',
  function (this: AdvisoryReviewWorld) {
    this.changedArtifactPath = 'policies/access.flux';
    this.currentHead = 'revision A';
    this.evidenceArtifacts = [{ byteLength: 32, path: this.changedArtifactPath }];
    this.prerequisites = 'passed';
    this.ready = true;
  },
);

Given(
  'the reviewer returned a consequential access-control finding',
  function (this: AdvisoryReviewWorld) {
    this.finding = {
      consequence: 'Broadens access beyond the intended administrators.',
      path: this.changedArtifactPath ?? '',
    };
  },
);

Given(/^the current review is (.+)$/, function (this: AdvisoryReviewWorld, state: string) {
  this.currentHead = 'revision A';
  this.evidenceState = state;
  this.prerequisites = 'passed';
  this.ready = true;
});

Given(/^a review has (.+)$/, function (this: AdvisoryReviewWorld, condition: string) {
  this.currentHead = 'revision A';
  this.evidenceState = condition;
  this.prerequisites = 'passed';
  this.ready = true;
  this.runConditions = [conditionState(condition)];
});

Given(/^(.+) also occurs$/, function (this: AdvisoryReviewWorld, condition: string) {
  this.runConditions?.push(conditionState(condition));
});

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
  'a pull request has a `looks ready` marker-owned receipt for revision A',
  function (this: AdvisoryReviewWorld) {
    this.attempts = 0;
    this.currentHead = 'revision A';
    this.prerequisiteSamples = 0;
    this.ready = true;
    this.scheduledReceiptId = 44;
    this.receipts = [
      {
        commentId: this.scheduledReceiptId,
        markerOwned: true,
        reviewedSha: 'revision A',
        route: 'looks_ready',
      },
    ];
  },
);

Given('revision A has a current receipt', function (this: AdvisoryReviewWorld) {
  this.attempts = 0;
  this.existingReviewedSha = 'revision A';
  this.currentHead = 'revision A';
  this.prerequisites = 'passed';
  this.ready = true;
  this.receipts = [{ reviewedSha: 'revision A', route: 'looks_ready' }];
});

Given(
  'a pull request has one marker-owned receipt for revision A',
  function (this: AdvisoryReviewWorld) {
    this.currentHead = 'revision A';
    this.scheduledReceiptId = 42;
    this.receipts = [
      {
        commentId: this.scheduledReceiptId,
        markerOwned: true,
        reviewedSha: 'revision A',
        route: 'looks_ready',
      },
    ];
  },
);

Given('revision B becomes the pull request head', function (this: AdvisoryReviewWorld) {
  this.currentHead = 'revision B';
});

Given(
  'a prior race left three bot-authored marker-owned receipt comments',
  function (this: AdvisoryReviewWorld) {
    this.commentMutations = [];
    this.receiptComments = [
      {
        authorType: 'Bot',
        body: `${RECEIPT_MARKER}\noldest`,
        createdAt: '2026-01-01T00:00:00.000Z',
        id: 10,
      },
      {
        authorType: 'Bot',
        body: `${RECEIPT_MARKER}\nnewer`,
        createdAt: '2026-01-02T00:00:00.000Z',
        id: 11,
      },
      {
        authorType: 'Bot',
        body: `${RECEIPT_MARKER}\nnewest`,
        createdAt: '2026-01-03T00:00:00.000Z',
        id: 12,
      },
    ];
  },
);

Given(
  'a terminal review attempt used 123 input tokens and 45 output tokens',
  function (this: AdvisoryReviewWorld) {
    this.currentHead = 'revision A';
    this.inputTokens = 123;
    this.outputTokens = 45;
  },
);

Given('required check `build` completed successfully', function (this: AdvisoryReviewWorld) {
  this.prerequisites = 'passed';
});

Given(
  'a failed terminal review has unavailable token usage and one unresolved check',
  function (this: AdvisoryReviewWorld) {
    this.currentHead = 'revision A';
    this.prerequisites = 'pending';
    this.receiptRunState = 'failed';
    this.unresolvedCheck = 'build';
  },
);

Given('a current review has a consequential finding', function (this: AdvisoryReviewWorld) {
  this.actionableFinding = {
    consequence: 'An attacker could access another account.',
    evidence: 'The changed handler accepts an unsigned session token.',
    line: 12,
    nextAction: 'Require signature verification before accepting the token.',
    path: 'src/auth.ts',
    unverifiedRemedy: 'Use the existing token verification helper.',
  };
});

Given('a canonical bot-authored marker-owned receipt exists', function (this: AdvisoryReviewWorld) {
  this.commentMutations = [];
  this.receiptComments = [
    {
      authorType: 'Bot',
      body: `${RECEIPT_MARKER}\ncanonical`,
      createdAt: '2026-01-01T00:00:00.000Z',
      id: 10,
    },
  ];
});

Given(
  /^a (user-authored comment containing the exact marker|bot-authored comment containing a malformed marker) also exists$/,
  function (this: AdvisoryReviewWorld, protectedComment: string) {
    this.protectedCommentId = 20;
    this.protectedCommentBefore =
      protectedComment === 'user-authored comment containing the exact marker'
        ? `${RECEIPT_MARKER}\nuser-authored content`
        : `${RECEIPT_MARKER} malformed\nbot-authored content`;
    this.receiptComments?.push({
      authorType:
        protectedComment === 'user-authored comment containing the exact marker' ? 'User' : 'Bot',
      body: this.protectedCommentBefore,
      createdAt: '2026-01-02T00:00:00.000Z',
      id: this.protectedCommentId,
    });
  },
);

Given(
  /^(?:before a new review begins|while revision A is being reviewed) revision B becomes the pull request head$/,
  function (this: AdvisoryReviewWorld) {
    this.currentHead = 'revision B';
  },
);

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

Then('the receipt reports zero reviewable text artifacts', function (this: AdvisoryReviewWorld) {
  assert.equal(this.receipts?.[0]?.reviewableTextArtifacts, 0);
});

Then('the published state is `incomplete`', function (this: AdvisoryReviewWorld) {
  assert.equal(this.receipts?.[0]?.runState, 'incomplete');
});

Then(
  /^the route is `(looks ready|needs a human)`$/,
  function (this: AdvisoryReviewWorld, route: string) {
    const receipt = this.receipts?.[0];
    assert.equal(
      receipt && 'route' in receipt && receipt.route,
      route === 'looks ready' ? 'looks_ready' : 'needs_human',
    );
  },
);

When(
  'Safeword assembles the bounded integrity evidence',
  async function (this: AdvisoryReviewWorld) {
    this.attempts = 0;
    this.receipts = [];
    this.outcome = await reviewPullRequest({
      readPullRequest: async () => ({
        headSha: this.currentHead ?? '',
        prerequisitesConfigured: true,
        prerequisites: this.prerequisites ?? 'pending',
        ready: this.ready ?? false,
      }),
      inspect: async () => {
        this.attempts = (this.attempts ?? 0) + 1;
        return {
          artifacts: this.evidenceArtifacts?.map(artifact => ({
            ...artifact,
            kind: 'text' as const,
          })),
          consequentialFindings: 0,
          maxTotalBytes: this.maxTotalBytes,
          unknowns: [],
        };
      },
      publish: async receipt => {
        this.receipts?.splice(0, this.receipts.length, receipt);
      },
    });
  },
);

Then(
  'the receipt names the over-budget artifacts as missing required evidence',
  function (this: AdvisoryReviewWorld) {
    assert.deepEqual(this.receipts?.[0]?.missingEvidence, ['src/over-budget.ts']);
  },
);

Then(
  'every changed text artifact is marked integrity-reviewed',
  function (this: AdvisoryReviewWorld) {
    const coverage = this.receipts?.[0]?.coverage ?? [];
    assert.deepEqual(
      coverage.map(entry => ({ path: entry.path, status: entry.status })),
      this.evidenceArtifacts?.map(artifact => ({
        path: artifact.path,
        status: 'integrity_reviewed',
      })),
    );
  },
);

Then(
  'none is reported missing because of the total-byte budget',
  function (this: AdvisoryReviewWorld) {
    assert.deepEqual(this.receipts?.[0]?.missingEvidence, []);
  },
);

When('Safeword derives the route', async function (this: AdvisoryReviewWorld) {
  this.receipts = [];
  this.outcome = await reviewPullRequest({
    readPullRequest: async () => ({
      headSha: this.currentHead ?? '',
      prerequisitesConfigured: true,
      prerequisites: this.prerequisites ?? 'pending',
      ready: this.ready ?? false,
    }),
    inspect: async () => ({
      artifacts: this.evidenceArtifacts?.map(artifact => ({
        ...artifact,
        kind: 'text' as const,
      })),
      consequentialFindings: this.finding ? 1 : 0,
      findings: this.finding ? [this.finding] : [],
      unknowns: [],
    }),
    publish: async receipt => {
      this.receipts?.splice(0, this.receipts.length, receipt);
    },
  });
});

When('Safeword derives the advisory route', async function (this: AdvisoryReviewWorld) {
  this.receipts = [];
  const state = this.evidenceState ?? '';
  this.outcome = await reviewPullRequest({
    readPullRequest: async () => ({
      headSha: this.currentHead ?? '',
      prerequisitesConfigured: true,
      prerequisites: this.prerequisites ?? 'pending',
      ready: this.ready ?? false,
    }),
    inspect: async () => {
      let runState: 'failed' | 'stale' | undefined;
      if (state.includes('reviewer or tool error')) runState = 'failed';
      else if (state.includes('no longer current')) runState = 'stale';

      return {
        artifacts: [
          {
            byteLength: state === 'missing required evidence' ? 101 : 10,
            kind: 'text' as const,
            path: 'src/current.ts',
          },
        ],
        consequentialFindings: state === 'complete with a consequential finding' ? 1 : 0,
        findings: state.includes('finding')
          ? [
              {
                consequence: 'Observed review finding.',
                path: 'src/current.ts',
              },
            ]
          : [],
        maxTotalBytes: state === 'missing required evidence' ? 100 : undefined,
        runConditions: this.runConditions,
        runState,
        unknowns: state === 'complete with an unresolved unknown' ? ['Unresolved evidence'] : [],
      };
    },
    publish: async receipt => {
      this.receipts?.splice(0, this.receipts.length, receipt);
    },
  });
});

Then(
  /^the published state is (complete|incomplete|failed|stale)$/,
  function (this: AdvisoryReviewWorld, runState: string) {
    assert.equal(this.receipts?.[0]?.runState, runState);
  },
);

When('Safeword handles the change', async function (this: AdvisoryReviewWorld) {
  this.receipts = [];
  this.outcome = await reviewPullRequest({
    readPullRequest: async () => ({
      headSha: this.currentHead ?? '',
      prerequisitesConfigured: true,
      prerequisites: this.prerequisites ?? 'pending',
      ready: this.ready ?? false,
      reviewedReceiptSha: this.existingReviewedSha,
    }),
    inspect: async headSha => {
      this.attempts = (this.attempts ?? 0) + 1;
      return {
        artifacts: [{ byteLength: 10, kind: 'text', path: `${headSha}.txt` }],
        consequentialFindings: 0,
        unknowns: [],
      };
    },
    publish: async receipt => {
      this.receipts?.push(receipt);
    },
  });
});

When(
  'Safeword completes the advisory review for revision B',
  async function (this: AdvisoryReviewWorld) {
    this.outcome = await reviewPullRequest({
      readPullRequest: async () => ({
        headSha: this.currentHead ?? '',
        prerequisitesConfigured: true,
        prerequisites: 'passed',
        ready: true,
        reviewedReceiptSha: 'revision A',
      }),
      inspect: async () => ({
        artifacts: [{ byteLength: 10, kind: 'text', path: 'revision-B.txt' }],
        consequentialFindings: 0,
        unknowns: [],
      }),
      publish: async receipt => {
        const plan = planReceiptPublication(
          (this.receipts ?? []).map((candidate, index) => ({
            authorType: 'Bot',
            createdAt: new Date(index).toISOString(),
            id: candidate.commentId ?? index,
            marker: candidate.markerOwned ? 'exact' : 'absent',
          })),
        );
        this.receipts = [
          {
            ...receipt,
            commentId: plan.canonicalCommentId,
            markerOwned: true,
          },
        ];
      },
    });
  },
);

When('Safeword publishes the current result', async function (this: AdvisoryReviewWorld) {
  await publishReceipt(
    {
      createComment: async body => {
        this.commentMutations?.push('create');
        this.receiptComments?.push({
          authorType: 'Bot',
          body,
          createdAt: '2026-01-04T00:00:00.000Z',
          id: 13,
        });
      },
      deleteComment: async id => {
        this.commentMutations?.push(`delete:${id}`);
        this.receiptComments = this.receiptComments?.filter(comment => comment.id !== id);
      },
      listComments: async () => this.receiptComments ?? [],
      updateComment: async (id, body) => {
        this.commentMutations?.push(`update:${id}`);
        const comment = this.receiptComments?.find(candidate => candidate.id === id);
        if (comment) comment.body = body;
      },
    },
    'current result',
  );
});

When('Safeword publishes the current receipt', function (this: AdvisoryReviewWorld) {
  const checkStatus =
    this.prerequisites === 'passed' ? 'success' : this.unresolvedCheck ? undefined : 'unknown';
  this.renderedReceipt = renderReceipt({
    checks: [
      {
        name: this.unresolvedCheck ?? 'build',
        status: checkStatus as 'success' | 'unknown',
      },
    ],
    findingCounts: { consequential: 0, nonConsequential: 0 },
    reviewedSha: this.currentHead ?? '',
    reviewers: ['openai'],
    runState: this.receiptRunState ?? 'complete',
    skippedChecks: [],
    tokenUsage: { input: this.inputTokens, output: this.outputTokens },
    unknowns: this.unresolvedCheck ? [`check ${this.unresolvedCheck}`] : [],
  });
});

When('Safeword renders the ordinary-comment receipt', function (this: AdvisoryReviewWorld) {
  this.renderedReceipt = renderReceipt({
    checks: [],
    findingCounts: { consequential: 1, nonConsequential: 0 },
    findings: this.actionableFinding ? [this.actionableFinding] : [],
    reviewedSha: 'revision A',
    reviewers: ['openai'],
    runState: 'complete',
    skippedChecks: [],
    tokenUsage: {},
    unknowns: [],
  });
});

Then(
  "the publication audit records revision A's `stale` write before any fresh route for revision B",
  function (this: AdvisoryReviewWorld) {
    assert.equal(this.receipts?.[0]?.reviewedSha, 'revision A');
    assert.equal(this.receipts?.[0]?.runState, 'stale');
    assert.equal(this.receipts?.[1]?.reviewedSha, 'revision B');
  },
);

Then(
  'the same marker-owned comment is updated for revision B',
  function (this: AdvisoryReviewWorld) {
    assert.equal(this.receipts?.[0]?.commentId, this.scheduledReceiptId);
    assert.equal(this.receipts?.[0]?.reviewedSha, 'revision B');
  },
);

Then(
  'it updates the oldest marker-owned comment as the canonical receipt',
  function (this: AdvisoryReviewWorld) {
    assert.equal(this.commentMutations?.[0], 'update:10');
    assert.match(
      this.receiptComments?.find(comment => comment.id === 10)?.body ?? '',
      /current result/,
    );
  },
);

Then(
  'it deletes every other bot-authored marker-owned receipt',
  function (this: AdvisoryReviewWorld) {
    assert.deepEqual(this.commentMutations?.slice(1), ['delete:11', 'delete:12']);
  },
);

Then('the canonical marker-owned receipt is updated', function (this: AdvisoryReviewWorld) {
  assert.equal(this.commentMutations?.[0], 'update:10');
  assert.match(
    this.receiptComments?.find(comment => comment.id === 10)?.body ?? '',
    /current result/,
  );
});

Then('the protected comment is neither updated nor deleted', function (this: AdvisoryReviewWorld) {
  assert.equal(
    this.receiptComments?.find(comment => comment.id === this.protectedCommentId)?.body,
    this.protectedCommentBefore,
  );
  assert.equal(
    this.commentMutations?.some(mutation => mutation.endsWith(`:${this.protectedCommentId}`)),
    false,
  );
});

Then('the receipt names the reviewed revision and run state', function (this: AdvisoryReviewWorld) {
  assert.match(this.renderedReceipt ?? '', /revision A/);
  assert.match(this.renderedReceipt ?? '', /complete/);
});

Then(
  'it lists reviewers, checks, skipped checks, remaining unknowns, available token use, and finding counts',
  function (this: AdvisoryReviewWorld) {
    for (const label of [
      'Reviewers',
      'Checks',
      'Skipped checks',
      'Unknowns',
      'Token usage',
      'Findings',
    ]) {
      assert.match(this.renderedReceipt ?? '', new RegExp(label));
    }
  },
);

Then(
  'it reports 123 input tokens, 45 output tokens, and `build: success`',
  function (this: AdvisoryReviewWorld) {
    assert.match(this.renderedReceipt ?? '', /123 input/);
    assert.match(this.renderedReceipt ?? '', /45 output/);
    assert.match(this.renderedReceipt ?? '', /build: success/);
  },
);

Then('token usage is reported as unknown rather than zero', function (this: AdvisoryReviewWorld) {
  assert.match(this.renderedReceipt ?? '', /unknown input, unknown output/);
  assert.doesNotMatch(this.renderedReceipt ?? '', /0 (?:input|output)/);
});

Then(
  'the unresolved check is reported as unknown rather than successful',
  function (this: AdvisoryReviewWorld) {
    assert.match(this.renderedReceipt ?? '', /build: unknown/);
    assert.doesNotMatch(this.renderedReceipt ?? '', /build: success/);
  },
);

Then(
  'the finding names its path and location, evidence, consequence, and one next action',
  function (this: AdvisoryReviewWorld) {
    const receipt = this.renderedReceipt ?? '';
    assert.match(receipt, /src\/auth\.ts:12/);
    assert.match(receipt, /The changed handler accepts an unsigned session token\./);
    assert.match(receipt, /An attacker could access another account\./);
    assert.match(receipt, /Require signature verification before accepting the token\./);
    assert.equal(receipt.match(/Next action:/gu)?.length, 1);
  },
);

Then('any model-proposed remedy is labeled unverified', function (this: AdvisoryReviewWorld) {
  assert.match(
    this.renderedReceipt ?? '',
    /Unverified remedy: Use the existing token verification helper\./,
  );
});

Then(
  'revision B requires a full fresh review before a current route is published',
  function (this: AdvisoryReviewWorld) {
    assert.equal(this.attempts, 1);
    assert.equal(this.outcome?.reviewedSha, 'revision B');
    const receipt = this.receipts?.[1];
    assert.equal(receipt && 'route' in receipt && receipt.route, 'looks_ready');
  },
);

When('the pull request is converted to draft', async function (this: AdvisoryReviewWorld) {
  this.ready = false;
  const world = this;
  this.outcome = await reviewPullRequest({
    readPullRequest: async () => ({
      headSha: this.currentHead ?? '',
      markerReceiptExists: true,
      prerequisitesConfigured: true,
      get prerequisites() {
        world.prerequisiteSamples = (world.prerequisiteSamples ?? 0) + 1;
        return 'passed' as const;
      },
      ready: false,
      state: 'draft',
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
  });
});

Then(
  /^the same marker-owned comment reports `not ready \(draft\)` with no advisory route$/,
  function (this: AdvisoryReviewWorld) {
    const receipt = this.receipts?.[0];
    assert.equal(receipt?.commentId, this.scheduledReceiptId);
    assert.equal(receipt?.markerOwned, true);
    assert.equal(receipt?.status, 'not_ready');
    assert.equal(receipt && 'reason' in receipt && receipt.reason, 'draft');
    assert.equal('route' in (receipt ?? {}), false);
  },
);

Then('the receipt associates the finding with that artifact', function (this: AdvisoryReviewWorld) {
  assert.equal(this.receipts?.[0]?.findings?.[0]?.path, this.changedArtifactPath);
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
    if (this.receiptComments) {
      const ownedComments = this.receiptComments.filter(
        comment => comment.authorType === 'Bot' && comment.body.includes(RECEIPT_MARKER),
      );
      assert.equal(ownedComments.length, 1);
      return;
    }
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
