import { strict as assert } from 'node:assert';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

import { reviewerScript } from '../packages/cli/tests/fixtures/planning-reviewers.js';
import { coordinate, prepare } from './keep-plan-reviews-independence.steps.js';
import type { SafewordWorld } from './world.js';

type RouteState = Awaited<ReturnType<typeof prepare>> & { modelLog: string; unknown: boolean };
const states = new WeakMap<SafewordWorld, RouteState>();

Given(
  /^the real review route registry and project configuration select (a reviewer model at least as capable as the verified author model|a reviewer model with unavailable, stale, or conflicting pair capability)$/,
  { timeout: 120_000 },
  async function (this: SafewordWorld, capability: string) {
    const state = await prepare(this, true);
    const modelLog = path.join(path.dirname(state.marker), 'requested-models');
    const unknown = capability.includes('unavailable');
    states.set(this, Object.assign(state, { modelLog, unknown }));
    const configPath = path.join(state.root, '.safeword/config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    writeFileSync(
      configPath,
      JSON.stringify({
        ...config,
        crossAgentReviewRoutes: {
          claude: [
            ...(unknown ? [{ reviewer: 'codex', model: 'gpt-6.1-sol-unqualified' }] : []),
            { reviewer: 'codex', model: 'gpt-6.1-sol' },
          ],
        },
      }),
    );
    const script = reviewerScript(
      'codex',
      state.marker,
      path.join(path.dirname(state.marker), 'packet.json'),
      false,
      true,
    );
    const launch = `writeFileSync(${JSON.stringify(state.marker)}, 'yes');`;
    const launched = script.replace(
      launch,
      `${launch}\nrequire('node:fs').appendFileSync(${JSON.stringify(`${modelLog}.launches`)}, 'launch\\n');`,
    );
    assert.notEqual(launched, script);
    const observed = launched.replace(
      'if (message.id === 2) console.log',
      `if (message.id === 2) require('node:fs').appendFileSync(${JSON.stringify(modelLog)}, message.params.model + '\\n');\n    if (message.id === 2) console.log`,
    );
    assert.notEqual(observed, launched);
    writeFileSync(path.join(path.dirname(state.marker), 'codex'), observed, { mode: 0o755 });
  },
);

When(
  'the coordinator selects an independent route while mocking only the agent invocation',
  { timeout: 120_000 },
  async function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    await coordinate(state);
  },
);

Then('that route is attempted as an independent review', function (this: SafewordWorld) {
  const state = states.get(this);
  assert.ok(state?.result);
  assert.equal(readFileSync(`${state.modelLog}.launches`, 'utf8'), 'launch\n');
  assert.deepEqual(readFileSync(state.modelLog, 'utf8').trim().split('\n'), ['gpt-6.1-sol']);
  assert.equal(state.result.data.independence, 'cross-agent');
  assert.deepEqual(state.result.data.review_routes, [
    {
      reviewer: 'codex',
      model: 'gpt-6.1-sol',
      independence: 'cross-agent',
      status: 'attempted',
    },
  ]);
});

Then(
  'that route is not attempted as independent and selection continues to the next permitted route',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state?.unknown && state.result);
    assert.equal(
      readFileSync(`${state.modelLog}.launches`, 'utf8'),
      'launch\n',
      'Unqualified route must not invoke the reviewer process',
    );
    assert.deepEqual(
      readFileSync(state.modelLog, 'utf8').trim().split('\n'),
      ['gpt-6.1-sol'],
      'Unqualified route must not invoke the reviewer process',
    );
    assert.equal(state.result.data.independence, 'cross-agent');
    assert.deepEqual(state.result.data.review_routes, [
      {
        reviewer: 'codex',
        model: 'gpt-6.1-sol-unqualified',
        independence: 'cross-agent',
        status: 'skipped',
        failure: 'reviewer_capability_unknown',
      },
      { reviewer: 'codex', model: 'gpt-6.1-sol', independence: 'cross-agent', status: 'attempted' },
    ]);
  },
);
