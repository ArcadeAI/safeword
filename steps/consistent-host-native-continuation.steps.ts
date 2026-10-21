import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Given, Then, When } from '@cucumber/cucumber';

import { CursorNativeContinuationActor } from '../packages/cli/tests/helpers/cursor-native-continuation.js';
import type { CursorNativeFixtureConfig } from '../packages/cli/tests/helpers/cursor-native-window.js';
import type { SafewordWorld } from './world.js';
import './world.js';

interface ContinuationWorld extends SafewordWorld {
  continuation?: CursorNativeContinuationActor;
}
function actor(world: ContinuationWorld): CursorNativeContinuationActor {
  assert.ok(world.continuation);
  return world.continuation;
}
Given(
  '{string} version {string} has its claimed completion guard active with continuation capacity remaining',
  { timeout: 600_000 },
  async function (this: ContinuationWorld, host: string, version: string) {
    const parameters = this.parameters as { cursorFixtureFile?: string };
    assert.ok(parameters.cursorFixtureFile);
    const config = JSON.parse(
      readFileSync(parameters.cursorFixtureFile, 'utf8'),
    ) as CursorNativeFixtureConfig;
    this.continuation = new CursorNativeContinuationActor(config, 'unfinished-ticket-stop');
    await actor(this).prepareContinuation(host, version);
  },
);
Given(
  'the current turn is missing required verification evidence',
  function (this: ContinuationWorld) {
    actor(this).setMissingVerification();
  },
);
When(
  'the installed host attempts to finish the conversation',
  { timeout: 360_000 },
  async function (this: ContinuationWorld) {
    await actor(this).attemptCompletion();
  },
);
Then(
  'the host continues the conversation with the unmet verification requirement instead of ending the turn',
  function (this: ContinuationWorld) {
    actor(this).assertContinuation();
  },
);
