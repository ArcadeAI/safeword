import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { installedReviewCli } from '../packages/cli/tests/fixtures/execution-review.js';
import { reviewerScript } from '../packages/cli/tests/fixtures/planning-reviewers.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
} from '../packages/cli/tests/review-fixtures.js';
import { fixtureProject } from './keep-plan-reviews-installed-context.steps.js';
import { evaluateInstalledPhaseGate } from './keep-plan-reviews-stale-gates.steps.js';
import type { SafewordWorld } from './world.js';

const folder = '.project/tickets/CTX123-current-context';
interface IndependentState {
  root: string;
  marker: string;
  fallbackMarker?: string;
  sameProcessReviewer?: 'claude' | 'codex';
  env: Record<string, string>;
  result?: {
    data: {
      status: string;
      independence: string;
      actual_reviewer: string;
      review_id: string;
      review_routes: {
        reviewer: string;
        model?: string;
        independence: string;
        status: string;
        failure?: string;
      }[];
      continuation?: { tier: string; packet: { dispatch_id: string } };
      continuation_attempts?: { tier: string; failure: string }[];
    };
    findings: { code: string; message: string }[];
    errors: unknown[];
  };
  gate?: { exitCode: number; stdout: string; stderr: string };
  evaluateGate?: () => Promise<{ exitCode: number; stdout: string; stderr: string }>;
}
const states = new WeakMap<SafewordWorld, IndependentState>();

export async function prepare(world: SafewordWorld, verifiedAuthor: boolean) {
  const bun = spawnSync('bun', ['-e', 'process.stdout.write(process.execPath)'], {
    encoding: 'utf8',
  });
  assert.equal(bun.status, 0, bun.stderr);
  const root = fixtureProject();
  const reviewer = createTrustedReviewerDirectory('safeword-r6-independent-');
  const marker = path.join(reviewer, 'invoked');
  const state: IndependentState = {
    root,
    marker,
    env: {
      NODE_ENV: 'test',
      PATH: `${reviewer}:${path.dirname(bun.stdout)}:${path.dirname(process.execPath)}:/usr/bin:/bin`,
      SAFEWORD_AGENT_RUNTIME: 'claude',
      CLAUDE_SESSION_ID: `r6-independent-${path.basename(root)}`,
      CLAUDE_PROJECT_DIR: root,
      CLAUDE_PLUGIN_ROOT: path.resolve(import.meta.dirname, '../plugin'),
      PLUGIN_ROOT: path.resolve(import.meta.dirname, '../packages/cli/codex-plugin'),
      SAFEWORD_AUTHOR_MODEL: verifiedAuthor ? 'claude-opus-5' : '',
      SAFEWORD_REVIEW_KEY_ROOT: path.join(root, '.review-keys'),
      XDG_STATE_HOME: path.join(root, '.review-keys'),
      SAFEWORD_NO_UPDATE_CHECK: '1',
    },
  };
  states.set(world, state);
  const installed = await installedReviewCli(root)(
    ['install', '--agents', 'cursor', '--offline', '--no-input', '--json', '--cwd', root],
    { cwd: root, env: { NODE_ENV: 'test' } },
  );
  assert.equal(installed.exitCode, 0, installed.stdout);
  const configPath = path.join(root, '.safeword/config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  writeFileSync(
    configPath,
    JSON.stringify({
      ...config,
      crossAgentReviewRoutes: { claude: [{ reviewer: 'codex', model: 'gpt-6.1-sol' }] },
    }),
  );
  writeFileSync(
    path.join(reviewer, 'codex'),
    reviewerScript('codex', marker, path.join(reviewer, 'packet.json'), false, true),
    { mode: 0o755 },
  );
  return state;
}

export async function coordinate(
  state: IndependentState,
  reviewer: 'codex' | 'claude' = 'codex',
  status: 'approved' | 'changes_requested' | 'continuation_required' | 'blocked' = 'approved',
) {
  const result = await installedReviewCli(state.root)(
    [
      'review',
      'run',
      'plan-implementation',
      `${folder}/impl-plan.md`,
      '--context',
      'features/current-context.feature',
      '--context',
      `${folder}/spec.md`,
      '--json',
      '--no-input',
      '--cwd',
      state.root,
    ],
    { cwd: state.root, env: state.env },
  );
  assert.equal(result.exitCode, status === 'approved' ? 0 : 2, result.stdout);
  state.result = JSON.parse(result.stdout);
  assert.ok(state.result);
  if (status !== 'blocked') assert.deepEqual(state.result.errors, []);
  assert.equal(state.result.data.status, status);
  if (status === 'approved' || status === 'changes_requested')
    assert.equal(state.result.data.actual_reviewer, reviewer);
  assert.ok(existsSync(state.marker), 'The real coordinator must invoke the reviewer process');
}

function recordApproval(state: IndependentState) {
  assert.ok(state.result);
  const stamped = spawnSync(
    'bun',
    [
      path.join(state.root, '.safeword/hooks/write-review-stamp.ts'),
      '--ticket',
      path.basename(folder),
      '--phase',
      'plan-implementation',
      '--review-id',
      state.result.data.review_id,
      '--author-agent',
      'claude',
      '--reviewer-agent',
      state.result.data.actual_reviewer,
      '--independence',
      state.result.data.independence,
    ],
    {
      cwd: state.root,
      env: { ...process.env, ...state.env },
      encoding: 'utf8',
      timeout: 60_000,
    },
  );
  assert.equal(stamped.status, 0, stamped.stdout + stamped.stderr);
}

Given(
  /^an approval is returned by (a different agent in a separate process using a model at least as capable as the author|a different agent when the author model cannot be verified)$/,
  { timeout: 120_000 },
  async function (this: SafewordWorld, identity: string) {
    await prepare(this, identity.includes('at least as capable'));
  },
);

When(
  'the coordinator classifies its independence',
  { timeout: 120_000 },
  async function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    if (state.result === undefined) await coordinate(state);
    else {
      const receipt = await installedReviewCli(state.root)(
        ['review', 'status', state.result.data.review_id, '--json', '--cwd', state.root],
        { cwd: state.root, env: state.env },
      );
      assert.equal(JSON.parse(receipt.stdout).data.status, state.result.data.status);
      assert.equal(JSON.parse(receipt.stdout).data.independence, state.result.data.independence);
    }
  },
);

Then('cross-agent independence is accepted', function (this: SafewordWorld) {
  assert.equal(states.get(this)?.result?.data.independence, 'cross-agent');
});

Then('independent approval is refused', function (this: SafewordWorld) {
  const state = states.get(this);
  assert.ok(state?.result);
  const result = state.result;
  assert.notEqual(result.data.independence, 'cross-agent');
  if (state.sameProcessReviewer !== undefined) {
    assert.ok(result.data.continuation);
    assert.equal(result.data.continuation.tier, 'self-review');
    if (state.sameProcessReviewer === 'codex') {
      assert.equal(result.data.status, 'blocked');
      assert.equal(result.data.independence, 'none');
      assert.ok(result.findings.some(finding => finding.code === 'REVIEW_ROUTES_EXHAUSTED'));
      assert.deepEqual(result.data.continuation_attempts?.at(-1), {
        tier: 'self-review',
        failure: 'invalid_output',
      });
    } else {
      assert.equal(result.data.status, 'approved');
      assert.equal(result.data.independence, 'reduced');
      assert.ok(
        result.findings.some(
          finding =>
            finding.code === 'REVIEW_INDEPENDENCE_REDUCED' &&
            finding.message.includes('own context'),
        ),
      );
    }
  } else {
    assert.equal(result.data.independence, 'reduced');
    assert.ok(result.findings.some(finding => finding.code === 'AUTHOR_CAPABILITY_UNKNOWN'));
  }
});

Given(
  'the review coordinator has returned an independent reviewer approval',
  { timeout: 120_000 },
  async function (this: SafewordWorld) {
    const state = await prepare(this, true);
    await coordinate(state);
    assert.equal(state.result?.data.independence, 'cross-agent');
    recordApproval(state);
  },
);

Given(
  /^the review coordinator has returned every configured independent route was attempted and returned a typed failure, then the permitted fallback (approves|declines)$/,
  { timeout: 120_000 },
  async function (this: SafewordWorld, verdict: string) {
    const state = await prepare(this, true);
    const directory = path.dirname(state.marker);
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
    state.fallbackMarker = path.join(directory, 'same-agent-invoked');
    writeFileSync(
      path.join(directory, 'codex'),
      reviewerScript('codex', state.marker, path.join(directory, 'codex-packet.json'), true, true),
      { mode: 0o755 },
    );
    const approval = reviewerScript(
      'claude',
      state.fallbackMarker,
      path.join(directory, 'claude-packet.json'),
      false,
      false,
    );
    const script =
      verdict === 'approves'
        ? approval
        : approval.replace(
            "verdict: 'approve', summary: 'Review approved.', findings: []",
            "verdict: 'request_changes', summary: 'Review declined.', findings: [{ severity: 'error', message: 'The current plan requires repair.' }]",
          );
    if (verdict === 'declines') assert.notEqual(script, approval);
    writeFileSync(path.join(directory, 'claude'), script, { mode: 0o755 });
    await coordinate(state, 'claude', verdict === 'approves' ? 'approved' : 'changes_requested');
    assert.ok(existsSync(state.fallbackMarker));
    const independent = state.result?.data.review_routes.filter(
      route => route.reviewer === 'codex',
    );
    assert.ok(independent?.length);
    assert.ok(
      independent.every(
        route => route.status === 'attempted' && route.failure === 'process_failed',
      ),
    );
    assert.equal(state.result?.data.independence, 'reduced');
    if (verdict === 'approves') recordApproval(state);
  },
);

async function hostContinuation(
  world: SafewordWorld,
  tier: 'fresh-context' | 'self-review',
  reviewer: 'claude' | 'codex' = 'claude',
) {
  const state = await prepare(world, true);
  const directory = path.dirname(state.marker);
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
  state.fallbackMarker = path.join(directory, 'headless-failed');
  writeFileSync(
    path.join(directory, 'codex'),
    reviewerScript('codex', state.marker, path.join(directory, 'codex-packet.json'), true, true),
    { mode: 0o755 },
  );
  const script = reviewerScript(
    'claude',
    state.fallbackMarker,
    path.join(directory, 'claude-packet.json'),
    false,
    false,
  );
  const failed = script.replace(
    'function reviewOutput(packet)',
    'process.exit(7);\nfunction reviewOutput(packet)',
  );
  assert.notEqual(failed, script);
  writeFileSync(path.join(directory, 'claude'), failed, { mode: 0o755 });
  await coordinate(state, 'claude', 'continuation_required');
  assert.ok(existsSync(state.fallbackMarker));
  assert.ok(state.result?.data.review_routes.some(item => item.reviewer === 'codex'));
  assert.ok(state.result?.data.review_routes.some(item => item.reviewer === 'claude'));
  assert.ok(
    state.result?.data.review_routes.every(
      item => item.status === 'attempted' && item.failure === 'process_failed',
    ),
    JSON.stringify(state.result?.data.review_routes),
  );
  assert.equal(state.result.data.continuation?.tier, 'fresh-context');
  assert.ok(state.result.data.continuation);
  const reviewId = state.result.data.review_id;
  const dispatchId = state.result.data.continuation.packet.dispatch_id;
  const cli = installedReviewCli(state.root);
  if (tier === 'self-review') {
    const failure = await cli(
      [
        'review',
        'continue',
        reviewId,
        '--tier',
        'fresh-context',
        '--failure',
        'process_failed',
        '--offline',
        '--json',
        '--cwd',
        state.root,
      ],
      { cwd: state.root, env: state.env },
    );
    assert.equal(failure.exitCode, 2, failure.stdout);
    state.result = JSON.parse(failure.stdout);
    assert.ok(state.result);
    assert.equal(state.result.data.review_id, reviewId);
    assert.equal(state.result.data.status, 'continuation_required');
    assert.equal(state.result.data.continuation?.tier, 'self-review');
    assert.deepEqual(state.result.data.continuation_attempts, [
      { tier: 'fresh-context', failure: 'process_failed' },
    ]);
  }
  assert.equal(state.result.data.continuation?.packet.dispatch_id, dispatchId);
  writeFileSync(
    path.join(state.root, 'host-review.json'),
    JSON.stringify({
      schema_version: 1,
      dispatch_id: dispatchId,
      reviewer_agent: reviewer,
      verdict: 'approve',
      summary: `Approved by host-reported ${tier}.`,
      findings: [],
      evidence_records: { schema_version: 1, records: [] },
    }),
  );
  const completed = await cli(
    [
      'review',
      'continue',
      reviewId,
      '--tier',
      tier,
      '--output',
      'host-review.json',
      '--offline',
      '--json',
      '--cwd',
      state.root,
    ],
    { cwd: state.root, env: state.env },
  );
  assert.equal(completed.exitCode, reviewer === 'claude' ? 0 : 2, completed.stdout);
  state.result = JSON.parse(completed.stdout);
  assert.ok(state.result);
  assert.equal(state.result.data.review_id, reviewId);
  assert.equal(state.result.data.status, reviewer === 'claude' ? 'approved' : 'blocked');
  if (reviewer === 'claude') {
    assert.equal(state.result.data.actual_reviewer, reviewer);
    assert.equal(state.result.data.independence, 'reduced');
  }
  assert.equal(state.result.data.continuation?.tier, tier);
  assert.ok(state.result.data.continuation);
  assert.equal(state.result.data.continuation.packet.dispatch_id, dispatchId);
  if (reviewer === 'claude') recordApproval(state);
  return state;
}

Given(
  /^the review coordinator has returned (every independent route and same-agent headless review returned typed failures, then host-reported fresh-context review approves|every earlier route through host-reported fresh-context review returned typed failures, then bounded self-review approves)$/,
  { timeout: 120_000 },
  async function (this: SafewordWorld, route: string) {
    await hostContinuation(
      this,
      route.includes('bounded self-review') ? 'self-review' : 'fresh-context',
    );
  },
);

Given(
  /^an approval is returned by (a different agent in the same process using a model at least as capable as the author|the authoring agent in the same process)$/,
  { timeout: 120_000 },
  async function (this: SafewordWorld, identity: string) {
    const reviewer = identity.startsWith('a different') ? 'codex' : 'claude';
    const state = await hostContinuation(this, 'self-review', reviewer);
    state.sameProcessReviewer = reviewer;
  },
);

When('the phase gate evaluates the receipt', async function (this: SafewordWorld) {
  const state = states.get(this);
  if (!state) {
    assert.ok(evaluateInstalledPhaseGate(this), 'A real coordinator receipt must be prepared');
    return;
  }
  assert.ok(state.result);
  state.gate = state.evaluateGate
    ? await state.evaluateGate()
    : await installedReviewCli(state.root)(
        ['ticket', 'approve-plan', 'CTX123', '--json', '--no-input', '--cwd', state.root],
        { cwd: state.root, env: state.env },
      );
});

async function assertCurrentReceipt(
  state: IndependentState,
  expectedStatus: 'approved' | 'changes_requested',
  reviewer: 'claude' | 'codex',
  independence: 'cross-agent' | 'reduced',
) {
  assert.ok(state.result);
  const status = await installedReviewCli(state.root)(
    ['review', 'status', state.result.data.review_id, '--json', '--cwd', state.root],
    { cwd: state.root, env: state.env },
  );
  assert.equal(status.exitCode, expectedStatus === 'approved' ? 0 : 2, status.stdout);
  const receipt = JSON.parse(status.stdout).data;
  assert.equal(receipt.review_id, state.result.data.review_id);
  assert.equal(receipt.status, expectedStatus);
  assert.equal(receipt.independence, independence);
  assert.equal(receipt.actual_reviewer, reviewer);
}

Then(
  'the review passes with cross-agent independence recorded',
  async function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state?.gate && state.result);
    assert.equal(state.gate.exitCode, 0, state.gate.stdout);
    assert.equal(state.result.data.independence, 'cross-agent');
    const rows = readFileSync(path.join(state.root, '.project/skill-invocations.log'), 'utf8')
      .trim()
      .split('\n');
    const stamp = rows.find(row => row.endsWith(`review-id:${state.result?.data.review_id}`));
    assert.ok(stamp, 'The real writer must persist this authenticated review ID');
    assert.match(stamp, /author:claude reviewer:codex independence:cross-agent/u);
    await assertCurrentReceipt(state, 'approved', 'codex', 'cross-agent');
    assert.match(
      readFileSync(path.join(state.root, folder, 'ticket.md'), 'utf8'),
      /phase: plan-execution/u,
    );
  },
);

Then(
  /^the review passes with reduced independence and (actual reviewer recorded without calling the capability degraded|the host-reported fresh-context reviewer recorded|the bounded self-reviewer recorded)$/,
  async function (this: SafewordWorld, label: string) {
    const state = states.get(this);
    assert.ok(state?.gate && state.result);
    if (label.includes('fresh-context') || label.includes('self-reviewer')) {
      const tier = label.includes('fresh-context') ? 'fresh-context' : 'self-review';
      assert.equal(state.result.data.continuation?.tier, tier);
      assert.ok(
        state.result.findings.some(
          item =>
            item.code === 'REVIEW_INDEPENDENCE_REDUCED' &&
            item.message.includes(tier === 'fresh-context' ? 'fresh context' : 'own context'),
        ),
      );
    }
    assert.equal(state.gate.exitCode, 0, state.gate.stdout);
    const stamp = readFileSync(path.join(state.root, '.project/skill-invocations.log'), 'utf8')
      .trim()
      .split('\n')
      .find(row => row.endsWith(`review-id:${state.result?.data.review_id}`));
    assert.ok(stamp);
    assert.match(stamp, /author:claude reviewer:claude independence:reduced/u);
    await assertCurrentReceipt(state, 'approved', 'claude', 'reduced');
    assert.ok(
      !state.result.findings.some(finding => finding.code === 'REVIEW_INDEPENDENCE_DEGRADED'),
    );
    assert.ok(!state.gate.stdout.includes('REVIEW_INDEPENDENCE_DEGRADED'));
    assert.match(
      readFileSync(path.join(state.root, folder, 'ticket.md'), 'utf8'),
      /phase: plan-execution/u,
    );
  },
);

Given(
  'the review coordinator has returned an unrecognized or unparseable reviewer result',
  { timeout: 120_000 },
  async function (this: SafewordWorld) {
    const state = await prepare(this, true);
    await coordinate(state);
    recordApproval(state);
    const approvedId = state.result?.data.review_id;
    assert.ok(approvedId);
    const cli = installedReviewCli(state.root);
    const approved = await cli(
      ['ticket', 'approve-plan', 'CTX123', '--json', '--no-input', '--cwd', state.root],
      { cwd: state.root, env: state.env },
    );
    assert.equal(approved.exitCode, 0, approved.stdout);
    const ticket = path.join(state.root, folder, 'ticket.md');
    const advanced = readFileSync(ticket, 'utf8');
    assert.match(advanced, /phase: plan-execution/u);
    writeFileSync(ticket, advanced.replace('phase: plan-execution', 'phase: plan-implementation'));
    const plan = path.join(state.root, folder, 'impl-plan.md');
    writeFileSync(
      plan,
      `${readFileSync(plan, 'utf8')}\n<!-- current input for malformed-output proof -->\n`,
    );
    const superseded = await cli(['review', 'status', approvedId, '--json', '--cwd', state.root], {
      cwd: state.root,
      env: state.env,
    });
    assert.equal(JSON.parse(superseded.stdout).data.status, 'stale', superseded.stdout);
    const configPath = path.join(state.root, '.safeword/config.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        ...JSON.parse(readFileSync(configPath, 'utf8')),
        crossAgentReview: 'require',
      }),
    );
    const directory = path.dirname(state.marker);
    const valid = reviewerScript(
      'codex',
      state.marker,
      path.join(directory, 'packet.json'),
      false,
      true,
    );
    const malformed = valid
      .replace(
        'schema_version: 1, dispatch_id: packet.dispatch_id',
        'schema_version: 0, dispatch_id: packet.dispatch_id',
      )
      .replace(
        'findings: []',
        "findings: [{ severity: 'error', message: 'Malformed producer finding must not escape.' }]",
      );
    assert.notEqual(malformed, valid);
    rmSync(state.marker);
    rmSync(path.join(directory, 'packet.json'));
    writeFileSync(path.join(directory, 'codex'), malformed, { mode: 0o755 });
    await coordinate(state, 'codex', 'blocked');
    assert.deepEqual(state.result?.data.review_routes, [
      {
        reviewer: 'codex',
        model: 'gpt-6.1-sol',
        independence: 'cross-agent',
        status: 'attempted',
        failure: 'invalid_output',
      },
    ]);
    assert.equal(state.result?.data.independence, 'none');
    assert.ok(state.result && !('reviewer_output' in state.result.data));
  },
);

Then('the phase remains blocked with no approval recorded', async function (this: SafewordWorld) {
  const state = states.get(this);
  assert.ok(state?.gate && state.result);
  assert.equal(state.gate.exitCode, 2, state.gate.stdout);
  if (state.result.data.status === 'changes_requested') {
    assert.match(state.gate.stdout, /The current plan requires repair\./u);
    await assertCurrentReceipt(state, 'changes_requested', 'claude', 'reduced');
  } else {
    assert.equal(state.result.data.status, 'blocked');
    assert.equal(state.result.data.review_routes[0]?.failure, 'invalid_output');
    const current = await installedReviewCli(state.root)(
      ['review', 'status', state.result.data.review_id, '--json', '--cwd', state.root],
      { cwd: state.root, env: state.env },
    );
    const receipt = JSON.parse(current.stdout).data;
    assert.equal(receipt.review_id, state.result.data.review_id);
    assert.equal(receipt.status, 'blocked', current.stdout);
    assert.equal(receipt.independence, 'none');
    assert.ok(!('reviewer_output' in receipt));
    const ledgerPath = path.join(state.root, '.project/skill-invocations.log');
    const ledgerBefore = readFileSync(ledgerPath, 'utf8');
    const stamped = spawnSync(
      'bun',
      [
        path.join(state.root, '.safeword/hooks/write-review-stamp.ts'),
        '--ticket',
        path.basename(folder),
        '--phase',
        'plan-implementation',
        '--review-id',
        receipt.review_id,
        '--author-agent',
        'claude',
        '--reviewer-agent',
        'codex',
        '--independence',
        'cross-agent',
      ],
      { cwd: state.root, env: { ...process.env, ...state.env }, encoding: 'utf8', timeout: 60_000 },
    );
    assert.equal(stamped.status, 1, stamped.stdout + stamped.stderr);
    assert.match(stamped.stdout + stamped.stderr, /did not approve \(status: blocked\)/u);
    assert.equal(readFileSync(ledgerPath, 'utf8'), ledgerBefore);
    assert.ok(
      !JSON.parse(state.gate.stdout).findings.some(
        (finding: { code: string }) =>
          finding.code === 'REVIEWER_FINDING' || finding.code === 'REVIEWER_SUMMARY',
      ),
      'An unrecognized result must not be rendered as reviewer findings',
    );
  }
  assert.match(
    readFileSync(path.join(state.root, folder, 'ticket.md'), 'utf8'),
    /phase: plan-implementation/u,
  );
  const ledger = path.join(state.root, '.project/skill-invocations.log');
  assert.ok(
    !existsSync(ledger) ||
      !readFileSync(ledger, 'utf8').includes(`review-id:${state.result.data.review_id}`),
  );
});

After(function (this: SafewordWorld) {
  const state = states.get(this);
  if (state) {
    rmSync(state.root, { recursive: true, force: true });
    cleanupTrustedReviewerDirectories();
  }
  states.delete(this);
});
