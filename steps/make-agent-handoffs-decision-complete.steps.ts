import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import { evaluateDecisionBriefCompliance } from '../packages/cli/templates/hooks/lib/quality.js';
import type { SafewordWorld } from './world.js';

interface HandoffState {
  reply?: string;
  evaluation?: ReturnType<typeof evaluateDecisionBriefCompliance> & {
    contractVersion?: string;
    form?: string;
    requirements?: string[];
  };
}

const states = new WeakMap<SafewordWorld, HandoffState>();
const stateFor = (world: SafewordWorld): HandoffState => {
  let state = states.get(world);
  if (!state) {
    state = {};
    states.set(world, state);
  }
  return state;
};

Given(
  'a long work update ending in a Next decision that requires a human choice, with every decision role in plain language',
  function (this: SafewordWorld) {
    stateFor(this).reply = [
      'The implementation and focused tests are complete. Production rollout remains intentionally separate.',
      '**CONFIDENT** — The implementation is ready, but the release target needs a human choice.',
      '**Decided:** Keep the release scoped to one channel.',
      '**Open:** human: choose the release channel.',
      '**Next:** Choice: release to the beta channel or the stable channel. Recommendation: choose beta. Reason: beta limits exposure while we verify production telemetry. Impact: beta delays the stable release by one day; stable reaches everyone immediately with more rollback risk. Reply: `beta` or `stable`.',
    ].join('\n\n');
  },
);

Given(
  'the observed pre-contract long reply that mixes a verify-or-scaffold choice, a legacy Open value, and an incomplete Next paragraph',
  function (this: SafewordWorld) {
    stateFor(this).reply = [
      'Verification is available now. I can run it, or I can scaffold the next feature first.',
      '**CONFIDENT** — The implementation is complete and needs a direction for the next step.',
      '**Decided:** Keep the current change intact.',
      '**Open:** Choose whether to verify or scaffold next.',
      '**Next:** Choose the intended target.',
    ].join('\n\n');
  },
);

Given(
  'a blocked work update ending in a Need decision that requires a human choice, with every decision role in plain language',
  function (this: SafewordWorld) {
    stateFor(this).reply = [
      '**BLOCKED** — The release channel requires a human choice.',
      '**Tried:** Verified both release channels are available.',
      '**Need:** Choice: release to beta or stable. Recommendation: choose beta. Reason: beta limits exposure while telemetry is verified. Impact: beta delays the stable release by one day; stable reaches everyone immediately with greater rollback risk. Reply: `beta` or `stable`.',
    ].join('\n\n');
  },
);

When(
  'the shared deterministic terminal-handoff evaluator checks the reply',
  function (this: SafewordWorld) {
    const state = stateFor(this);
    assert.ok(state.reply, 'reply fixture was not initialized');
    state.evaluation = evaluateDecisionBriefCompliance(state.reply);
  },
);

Then('the decision handoff is accepted as self-contained', function (this: SafewordWorld) {
  assert.deepEqual(stateFor(this).evaluation, {
    compliant: true,
    contractVersion: 'terminal-handoff/v1',
    form: 'decision',
    examinedCharacters: stateFor(this).evaluation?.examinedCharacters,
  });
});

Then(
  'the decision handoff is rejected with the missing decision roles named',
  function (this: SafewordWorld) {
    const evaluation = stateFor(this).evaluation;
    assert.equal(evaluation?.compliant, false);
    assert.equal(evaluation?.form, 'decision');
    assert.deepEqual(evaluation?.requirements, [
      'concrete choice',
      'recommendation',
      'controlling reason',
      'material tradeoff or consequences',
      'exact reply',
    ]);
  },
);

Then('the blocked handoff is accepted as self-contained', function (this: SafewordWorld) {
  assert.equal(stateFor(this).evaluation?.compliant, true);
  assert.equal(stateFor(this).evaluation?.form, 'decision');
});
