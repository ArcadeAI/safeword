import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Given, Then, When } from '@cucumber/cucumber';

import { CursorNativeWriteActor } from '../packages/cli/tests/helpers/cursor-native-write.js';
import { CursorCliWriteActor } from '../packages/cli/tests/helpers/cursor-cli-write.js';
import type { CursorNativeFixtureConfig } from '../packages/cli/tests/helpers/cursor-native-window.js';
import type { SafewordWorld } from './world.js';
import './world.js';

interface WriteWorld extends SafewordWorld {
  nativeWrite?: CursorNativeWriteActor | CursorCliWriteActor;
}
function actor(world: WriteWorld): CursorNativeWriteActor | CursorCliWriteActor {
  assert.ok(world.nativeWrite, 'Native write fixture must be ready');
  return world.nativeWrite;
}
Given(
  '{string} version {string} in {string} has its pre-action boundary supplied by the contracted Safeword plugin delivery',
  { timeout: 600_000 },
  async function (this: WriteWorld, host: string, version: string, runtime: string) {
    const parameters = this.parameters as { cursorFixtureFile?: string; cursorCli?: string };
    if (runtime === 'CLI') {
      assert.ok(parameters.cursorCli, 'CURSOR_CLI_UNAVAILABLE: set SAFEWORD_CURSOR_CLI');
      this.nativeWrite = new CursorCliWriteActor(parameters.cursorCli);
    } else {
      assert.ok(parameters.cursorFixtureFile);
      const config = JSON.parse(
        readFileSync(parameters.cursorFixtureFile, 'utf8'),
      ) as CursorNativeFixtureConfig;
      this.nativeWrite = new CursorNativeWriteActor(config);
    }
    await actor(this).prepare(host, version, runtime);
  },
);
Given('the shared policy denies a sentinel file write', function (this: WriteWorld) {
  actor(this).setPolicy('denied');
});
Given('the shared policy permits a sentinel file write', function (this: WriteWorld) {
  actor(this).setPolicy('allowed');
});
When(
  'that installed host attempts the write',
  { timeout: 360_000 },
  async function (this: WriteWorld) {
    await actor(this).attempt();
  },
);
Then(
  'the host reports the policy denial and the sentinel file is not created',
  function (this: WriteWorld) {
    actor(this).assertOutcome();
  },
);
Then('the sentinel file contains the permitted content', function (this: WriteWorld) {
  actor(this).assertOutcome();
});
