import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { Then, When } from '@cucumber/cucumber';

import {
  assertIsolatedHostProfile,
  hostProfileSandbox,
} from '../../tests/helpers/host-profile-sandbox.ts';

// Deliberately observes the live process environment rather than a fixture:
// the behaviour under test is that the lane's BeforeAll guard actually ran in
// this runner, which no amount of in-test setup can stand in for.
When('a scenario in this lane reaches its first step', function noSetupRequired() {
  // The guard runs in BeforeAll, so by this point the lane is either isolated
  // or it is not. Nothing to arrange.
});

Then("the Claude host profile points at Safeword's test sandbox", () => {
  assert.equal(
    process.env.CLAUDE_CONFIG_DIR,
    hostProfileSandbox(),
    'the acceptance lane did not run the host-profile guard — Cucumber may no longer discover features/steps/host-profile-sandbox.steps.ts, so scenarios would write install records into the real ~/.claude (#4776)',
  );
});

Then("the Claude host profile is outside the developer's home directory", () => {
  assertIsolatedHostProfile(process.env);
  const homePrefix = nodePath.resolve(homedir()) + nodePath.sep;
  assert.ok(
    !(process.env.CLAUDE_CONFIG_DIR ?? '').startsWith(homePrefix),
    'the acceptance lane resolved a profile inside the home directory',
  );
});
