import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import { evaluateDecisionBriefCompliance } from '../packages/cli/templates/hooks/lib/quality.js';
import type { SafewordWorld } from './world.js';

interface HandoffState {
  reply?: string;
  evaluation?: ReturnType<typeof evaluateDecisionBriefCompliance> & {
    contractVersion?: string;
    form?: string;
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
