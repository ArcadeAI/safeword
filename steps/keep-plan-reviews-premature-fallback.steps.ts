import { strict as assert } from 'node:assert';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { installedReviewCli } from '../packages/cli/tests/fixtures/execution-review.js';
import { reviewerScript } from '../packages/cli/tests/fixtures/planning-reviewers.js';
import { prepare } from './keep-plan-reviews-independence.steps.js';
import type { SafewordWorld } from './world.js';

type State = Awaited<ReturnType<typeof prepare>> & { release: string; reviewId?: string };
const states = new WeakMap<SafewordWorld, State>();
const folder = '.project/tickets/CTX123-current-context';

Given(
  'at least one independent reviewer route remains available and unattempted',
  { timeout: 120_000 },
  async function (this: SafewordWorld) {
    const base = await prepare(this, true);
    const release = `${base.marker}-release`;
    const state = Object.assign(base, { release });
    states.set(this, state);
    const configPath = path.join(state.root, '.safeword/config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    config.crossAgentReviewRoutes.claude = [
      { reviewer: 'claude' },
      { reviewer: 'codex', model: 'gpt-6.1-sol' },
    ];
    writeFileSync(configPath, JSON.stringify(config));
    state.fallbackMarker = `${state.marker}-headless`;
    writeFileSync(
      path.join(path.dirname(state.marker), 'claude'),
      reviewerScript(
        'claude',
        state.fallbackMarker,
        `${state.fallbackMarker}.packet`,
        false,
        false,
      ),
      { mode: 0o755 },
    );
    const producer = reviewerScript('codex', state.marker, `${state.marker}.packet`, false, true);
    const held = producer.replace(
      'function reviewOutput(packet) {',
      `function reviewOutput(packet) {
    const deadline = Date.now() + 30000;
    while (!require('node:fs').existsSync(${JSON.stringify(release)})) {
      if (Date.now() > deadline) process.exit(7);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
    process.exit(7);`,
    );
    assert.notEqual(held, producer);
    writeFileSync(path.join(path.dirname(state.marker), 'codex'), held, { mode: 0o755 });
    assert.equal(existsSync(state.marker), false);
    assert.equal(existsSync(state.fallbackMarker), false);
  },
);

When(
  'the permitted fallback is requested',
  { timeout: 60_000 },
  async function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    // The caller ranks headless first; the public coordinator must still dispatch
    // independent review first. Only courtesy waiting is shortened, not funding.
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
      { cwd: state.root, env: { ...state.env, SAFEWORD_REVIEW_FOREGROUND_MS: '100' } },
    );
    assert.equal(result.exitCode, 2, result.stdout);
    const output = JSON.parse(result.stdout);
    state.reviewId = output.data.review_id;
    assert.equal(output.data.status, 'pending', result.stdout);
    const deadline = Date.now() + 10000;
    while (!existsSync(state.marker) && !existsSync(state.fallbackMarker!) && Date.now() < deadline)
      await new Promise(resolve => setTimeout(resolve, 100));
    const refused = await installedReviewCli(state.root)(
      [
        'review',
        'continue',
        state.reviewId!,
        '--tier',
        'fresh-context',
        '--failure',
        'process_failed',
        '--json',
        '--cwd',
        state.root,
      ],
      { cwd: state.root, env: state.env },
    );
    assert.equal(refused.exitCode, 1, refused.stdout);
    assert.deepEqual(
      JSON.parse(refused.stdout).errors.map((error: { code: string }) => error.code),
      ['REVIEW_JOB_INVALID'],
    );
  },
);

Then(
  'fallback is refused and the phase remains blocked pending independent review',
  { timeout: 60_000 },
  async function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state?.reviewId && state.fallbackMarker);
    const cli = installedReviewCli(state.root);
    const blocked = await cli(
      ['ticket', 'approve-plan', 'CTX123', '--json', '--no-input', '--cwd', state.root],
      { cwd: state.root, env: state.env },
    );
    assert.equal(blocked.exitCode, 2, blocked.stdout);
    const pending = await cli(['review', 'status', state.reviewId, '--json', '--cwd', state.root], {
      cwd: state.root,
      env: state.env,
    });
    assert.equal(JSON.parse(pending.stdout).data.status, 'pending');
    assert.equal(existsSync(state.marker), true, 'The independent route is actually working.');
    assert.equal(
      existsSync(state.fallbackMarker),
      false,
      'Funded headless review must wait for independent exhaustion.',
    );
    assert.match(
      readFileSync(path.join(state.root, folder, 'ticket.md'), 'utf8'),
      /phase: plan-implementation/u,
    );
    writeFileSync(state.release, 'release');
    let completion;
    const deadline = Date.now() + 10000;
    do {
      await new Promise(resolve => setTimeout(resolve, 100));
      const result = await cli(
        ['review', 'status', state.reviewId, '--json', '--cwd', state.root],
        { cwd: state.root, env: state.env },
      );
      completion = JSON.parse(result.stdout).data;
    } while (completion.status === 'pending' && Date.now() < deadline);
    assert.equal(completion.status, 'approved', JSON.stringify(completion));
    assert.equal(completion.independence, 'reduced');
    assert.deepEqual(completion.review_routes, [
      {
        reviewer: 'codex',
        model: 'gpt-6.1-sol',
        independence: 'cross-agent',
        status: 'attempted',
        failure: 'process_failed',
      },
      { reviewer: 'claude', independence: 'degraded', status: 'attempted' },
    ]);
    assert.equal(
      existsSync(state.fallbackMarker),
      true,
      'Fallback becomes callable after the independent failure.',
    );
  },
);

After(async function (this: SafewordWorld) {
  const state = states.get(this);
  if (!state) return;
  if (existsSync(path.dirname(state.release))) writeFileSync(state.release, 'release');
  if (state.reviewId)
    await installedReviewCli(state.root)(
      ['review', 'cancel', state.reviewId, '--json', '--cwd', state.root],
      { cwd: state.root, env: state.env },
    );
  states.delete(this);
});
