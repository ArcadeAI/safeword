import assert from 'node:assert/strict';

import { After, Given, Then, When } from '@cucumber/cucumber';

import {
  createObserverCandidate,
  expectCompleteObservation,
  expectFixedRequestRefusal,
  type ObserverCandidate,
  type ObserverCommand,
  runObserverCli,
  runSubstitutedCommand,
} from '../../tests/fixtures/bounded-observation.js';
import {
  createRequiredOutcomeCandidate,
  expectNamedRequiredRecovery,
} from '../../tests/fixtures/bounded-observation-failures.js';

interface ObserverWorld {
  observerCandidate?: ObserverCandidate;
  observerResult?: ObserverCommand;
}

Given(
  /^a bound candidate whose fixed proof lane reports a required assertion as (absent from the report|skipped|failed)$/u,
  function (this: ObserverWorld, result: string) {
    const normalized = result === 'absent from the report' ? 'absent' : result;
    const outcome = (['absent', 'skipped', 'failed'] as const).find(item => item === normalized);
    assert.ok(outcome !== undefined);
    this.observerCandidate = createRequiredOutcomeCandidate(outcome);
  },
);

Then('no successful observation is issued', function (this: ObserverWorld) {
  assert.ok(this.observerResult);
  assert.notEqual(this.observerResult.exitCode, 0, this.observerResult.stdout);
  assert.equal(this.observerResult.output.ok, false);
  assert.notEqual(this.observerResult.output.data?.status, 'observed');
});

Then(
  'the result names that assertion and the corrective rerun action',
  function (this: ObserverWorld) {
    assert.ok(this.observerCandidate);
    assert.ok(this.observerResult);
    expectNamedRequiredRecovery(this.observerCandidate, this.observerResult);
  },
);

Given(
  'a clean bound candidate whose fixed lane has passing required assertions for all 37 delivery cases',
  function (this: ObserverWorld) {
    this.observerCandidate = createObserverCandidate();
  },
);

When(
  'the maintainer requests a local observation through the Safeword CLI',
  function (this: ObserverWorld) {
    assert.ok(this.observerCandidate);
    this.observerResult = runObserverCli(this.observerCandidate, [
      'proof',
      'observe-bounded-delivery',
    ]);
  },
);

Then(
  'the CLI returns a verifiable observation identifying its command, candidate, runtime, inputs and complete results',
  function (this: ObserverWorld) {
    assert.ok(this.observerCandidate);
    assert.ok(this.observerResult);
    expectCompleteObservation(this.observerResult, this.observerCandidate);
    const id = this.observerResult.output.data?.attempt_id;
    assert.ok(id);
    const verified = runObserverCli(this.observerCandidate, [
      'proof',
      'verify-bounded-delivery',
      id,
    ]);
    assert.equal(verified.exitCode, 0, verified.stdout);
    assert.equal(verified.output.data?.current, true);
  },
);

Then(
  'the retained full report supports every declared required assertion',
  function (this: ObserverWorld) {
    assert.ok(this.observerCandidate);
    assert.ok(this.observerResult);
    expectCompleteObservation(this.observerResult, this.observerCandidate);
  },
);

After(function (this: ObserverWorld) {
  this.observerCandidate?.dispose();
});

Given(
  'a request that substitutes a command for the fixed proof lane',
  function (this: ObserverWorld) {
    this.observerCandidate = createObserverCandidate();
  },
);

When(
  'the maintainer submits the observation request through the Safeword CLI',
  function (this: ObserverWorld) {
    assert.ok(this.observerCandidate);
    this.observerResult = runSubstitutedCommand(this.observerCandidate);
  },
);

Then('execution is refused before that command runs', function (this: ObserverWorld) {
  assert.ok(this.observerCandidate);
  assert.ok(this.observerResult);
  expectFixedRequestRefusal(this.observerResult, this.observerCandidate);
});

Then(
  'the result names the unsupported override and the fixed request to use',
  function (this: ObserverWorld) {
    assert.ok(this.observerCandidate);
    assert.ok(this.observerResult);
    expectFixedRequestRefusal(this.observerResult, this.observerCandidate);
  },
);
