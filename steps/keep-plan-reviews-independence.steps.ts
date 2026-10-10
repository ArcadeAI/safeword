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
import type { SafewordWorld } from './world.js';

const folder = '.project/tickets/CTX123-current-context';
interface IndependentState {
  root: string;
  marker: string;
  env: Record<string, string>;
  result?: {
    data: { status: string; independence: string; actual_reviewer: string; review_id: string };
    findings: { code: string }[];
    errors: unknown[];
  };
  gate?: { exitCode: number; stdout: string; stderr: string };
}
const states = new WeakMap<SafewordWorld, IndependentState>();

async function prepare(world: SafewordWorld, verifiedAuthor: boolean) {
  const root = fixtureProject();
  const reviewer = createTrustedReviewerDirectory('safeword-r6-independent-');
  const marker = path.join(reviewer, 'invoked');
  const state: IndependentState = {
    root,
    marker,
    env: {
      NODE_ENV: 'test',
      PATH: `${reviewer}:${process.env.PATH}`,
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

async function coordinate(state: IndependentState) {
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
  assert.equal(result.exitCode, 0, result.stdout);
  state.result = JSON.parse(result.stdout);
  assert.ok(state.result);
  assert.deepEqual(state.result.errors, []);
  assert.equal(state.result.data.status, 'approved');
  assert.equal(state.result.data.actual_reviewer, 'codex');
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
      'codex',
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
    await coordinate(state);
  },
);

Then('cross-agent independence is accepted', function (this: SafewordWorld) {
  assert.equal(states.get(this)?.result?.data.independence, 'cross-agent');
});

Then('independent approval is refused', function (this: SafewordWorld) {
  const result = states.get(this)?.result;
  assert.ok(result);
  assert.equal(result.data.independence, 'reduced');
  assert.ok(result.findings.some(finding => finding.code === 'AUTHOR_CAPABILITY_UNKNOWN'));
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

When('the phase gate evaluates the receipt', async function (this: SafewordWorld) {
  const state = states.get(this);
  assert.ok(state?.result);
  state.gate = await installedReviewCli(state.root)(
    ['ticket', 'approve-plan', 'CTX123', '--json', '--no-input', '--cwd', state.root],
    { cwd: state.root, env: state.env },
  );
});

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
    const status = await installedReviewCli(state.root)(
      ['review', 'status', state.result.data.review_id, '--json', '--cwd', state.root],
      { cwd: state.root, env: state.env },
    );
    assert.equal(status.exitCode, 0, status.stdout);
    const receipt = JSON.parse(status.stdout).data;
    assert.equal(receipt.review_id, state.result.data.review_id);
    assert.equal(receipt.status, 'approved');
    assert.equal(receipt.independence, 'cross-agent');
    assert.equal(receipt.actual_reviewer, 'codex');
    assert.match(
      readFileSync(path.join(state.root, folder, 'ticket.md'), 'utf8'),
      /phase: plan-execution/u,
    );
  },
);

After(function (this: SafewordWorld) {
  const state = states.get(this);
  if (state) {
    rmSync(state.root, { recursive: true, force: true });
    cleanupTrustedReviewerDirectories();
  }
  states.delete(this);
});
