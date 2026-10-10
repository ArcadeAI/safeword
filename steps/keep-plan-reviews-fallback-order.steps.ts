import { strict as assert } from 'node:assert';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

import { installedReviewCli } from '../packages/cli/tests/fixtures/execution-review.js';
import { reviewerScript } from '../packages/cli/tests/fixtures/planning-reviewers.js';
import { coordinate, prepare } from './keep-plan-reviews-independence.steps.js';
import type { SafewordWorld } from './world.js';

type Tier =
  'same-agent headless review' | 'host-reported fresh-context review' | 'bounded self-review';
type OrderState = Awaited<ReturnType<typeof prepare>> & {
  nextTier: Tier;
  launchLog: string;
  reviewId?: string;
  dispatchId?: string;
};
const states = new WeakMap<SafewordWorld, OrderState>();

Given(
  /^every route before (same-agent headless review|host-reported fresh-context review|bounded self-review) is configured to return a typed failure when attempted$/,
  { timeout: 120_000 },
  async function (this: SafewordWorld, nextTier: Tier) {
    const state = await prepare(this, true);
    const directory = path.dirname(state.marker);
    const launchLog = path.join(directory, 'launch-order');
    states.set(this, Object.assign(state, { nextTier, launchLog }));
    const configPath = path.join(state.root, '.safeword/config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    writeFileSync(
      configPath,
      JSON.stringify({
        ...config,
        crossAgentReviewRoutes: {
          claude: [{ reviewer: 'codex', model: 'gpt-6.1-sol' }, { reviewer: 'claude' }],
        },
      }),
    );
    for (const agent of ['codex', 'claude'] as const) {
      const marker = agent === 'codex' ? state.marker : path.join(directory, 'headless-invoked');
      const script = reviewerScript(
        agent,
        marker,
        path.join(directory, `${agent}-packet.json`),
        agent === 'codex',
        true,
      );
      const launch = `writeFileSync(${JSON.stringify(marker)}, 'yes');`;
      const observed = script.replace(
        launch,
        `${launch}\nrequire('node:fs').appendFileSync(${JSON.stringify(launchLog)}, '${agent}\\n');`,
      );
      assert.notEqual(observed, script);
      const producer =
        agent === 'claude' && nextTier !== 'same-agent headless review'
          ? observed.replace(
              'function reviewOutput(packet)',
              'process.exit(7);\nfunction reviewOutput(packet)',
            )
          : observed;
      writeFileSync(path.join(directory, agent), producer, { mode: 0o755 });
    }
  },
);

async function continueHost(
  state: OrderState,
  tier: 'fresh-context' | 'self-review',
  failure: boolean,
) {
  assert.ok(state.result?.data.continuation);
  const reviewId = state.result.data.review_id;
  const dispatchId = state.result.data.continuation.packet.dispatch_id;
  assert.equal(state.result.data.continuation.tier, tier);
  if (!failure)
    writeFileSync(
      path.join(state.root, 'host-review.json'),
      JSON.stringify({
        schema_version: 1,
        dispatch_id: dispatchId,
        reviewer_agent: 'claude',
        verdict: 'approve',
        summary: `Approved by host-reported ${tier}.`,
        findings: [],
        evidence_records: { schema_version: 1, records: [] },
      }),
    );
  const result = await installedReviewCli(state.root)(
    [
      'review',
      'continue',
      reviewId,
      '--tier',
      tier,
      ...(failure ? ['--failure', 'process_failed'] : ['--output', 'host-review.json']),
      '--offline',
      '--json',
      '--cwd',
      state.root,
    ],
    { cwd: state.root, env: state.env },
  );
  assert.equal(result.exitCode, failure ? 2 : 0, result.stdout);
  state.result = JSON.parse(result.stdout);
  assert.ok(state.result?.data.continuation);
  assert.equal(state.result.data.review_id, reviewId);
  assert.equal(state.result.data.continuation.packet.dispatch_id, dispatchId);
  state.reviewId = reviewId;
  state.dispatchId = dispatchId;
}

async function refusePrematureSelfReview(state: OrderState) {
  assert.ok(state.result?.data.continuation);
  const reviewId = state.result.data.review_id;
  const dispatchId = state.result.data.continuation.packet.dispatch_id;
  writeFileSync(
    path.join(state.root, 'premature-review.json'),
    JSON.stringify({
      schema_version: 1,
      dispatch_id: dispatchId,
      reviewer_agent: 'claude',
      verdict: 'approve',
      summary: 'A valid output cannot bypass the pending fresh-context tier.',
      findings: [],
      evidence_records: { schema_version: 1, records: [] },
    }),
  );
  const cli = installedReviewCli(state.root);
  const refused = await cli(
    [
      'review',
      'continue',
      reviewId,
      '--tier',
      'self-review',
      '--output',
      'premature-review.json',
      '--offline',
      '--json',
      '--cwd',
      state.root,
    ],
    { cwd: state.root, env: state.env },
  );
  assert.equal(refused.exitCode, 1, refused.stdout);
  const result = JSON.parse(refused.stdout);
  assert.ok(
    result.errors.some(
      (error: { code: string }) => error.code === 'REVIEW_CONTINUATION_TIER_INVALID',
    ),
  );
  const current = await cli(['review', 'status', reviewId, '--json', '--cwd', state.root], {
    cwd: state.root,
    env: state.env,
  });
  const data = JSON.parse(current.stdout).data;
  assert.equal(data.status, 'continuation_required');
  assert.equal(data.continuation.tier, 'fresh-context');
  assert.equal(data.continuation.packet.dispatch_id, dispatchId);
  assert.deepEqual(data.continuation_attempts ?? [], []);
}

When(
  'review recovery selects the next permitted route',
  { timeout: 120_000 },
  async function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    const headless = state.nextTier === 'same-agent headless review';
    await coordinate(state, 'claude', headless ? 'approved' : 'continuation_required');
    if (headless) return;
    await refusePrematureSelfReview(state);
    if (state.nextTier === 'bounded self-review') await continueHost(state, 'fresh-context', true);
    await continueHost(
      state,
      state.nextTier === 'bounded self-review' ? 'self-review' : 'fresh-context',
      false,
    );
  },
);

Then(
  /^review recovery selects and attempts (same-agent headless review|host-reported fresh-context review|bounded self-review), and no later tier is attempted first$/,
  async function (this: SafewordWorld, nextTier: Tier) {
    const state = states.get(this);
    assert.ok(state?.result);
    assert.equal(state.nextTier, nextTier);
    const self = nextTier === 'bounded self-review';
    const headless = nextTier === 'same-agent headless review';
    const launches = readFileSync(state.launchLog, 'utf8').trim().split('\n');
    // Trusted candidate retries belong to the same tier; interleaving tiers still fails.
    const tiers = launches.filter((launch, index) => launch !== launches[index - 1]);
    assert.deepEqual(tiers, ['codex', 'claude']);
    assert.deepEqual(state.result.data.review_routes, [
      {
        reviewer: 'codex',
        model: 'gpt-6.1-sol',
        independence: 'cross-agent',
        status: 'attempted',
        failure: 'process_failed',
      },
      {
        reviewer: 'claude',
        independence: 'degraded',
        status: 'attempted',
        ...(headless ? {} : { failure: 'process_failed' }),
      },
    ]);
    assert.equal(state.result.data.status, 'approved');
    assert.equal(state.result.data.actual_reviewer, 'claude');
    assert.equal(state.result.data.independence, 'reduced');
    assert.deepEqual(
      state.result.data.continuation_attempts ?? [],
      self ? [{ tier: 'fresh-context', failure: 'process_failed' }] : [],
    );
    if (headless) assert.equal(state.result.data.continuation, undefined);
    else {
      assert.equal(state.result.data.continuation?.tier, self ? 'self-review' : 'fresh-context');
      assert.equal(state.result.data.continuation?.packet.dispatch_id, state.dispatchId);
    }
    const receipt = await installedReviewCli(state.root)(
      ['review', 'status', state.result.data.review_id, '--json', '--cwd', state.root],
      { cwd: state.root, env: state.env },
    );
    assert.equal(receipt.exitCode, 0, receipt.stdout);
    const current = JSON.parse(receipt.stdout).data;
    assert.equal(current.status, 'approved');
    assert.equal(current.review_id, state.result.data.review_id);
    assert.deepEqual(current.review_routes, state.result.data.review_routes);
  },
);
