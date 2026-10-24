import assert from 'node:assert/strict';

import { After, Given, Then, When } from '@cucumber/cucumber';

import {
  createObserverCandidate,
  expectCompleteObservation,
  type ObserverCandidate,
  type ObserverCommand,
  runObserverCli,
} from '../../tests/fixtures/bounded-observation.js';

interface ObserverWorld {
  observerCandidate?: ObserverCandidate;
  observerResult?: ObserverCommand;
}

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
