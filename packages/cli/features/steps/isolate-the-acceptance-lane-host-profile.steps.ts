import assert from 'node:assert/strict';

import { Then, When } from '@cucumber/cucumber';

import {
  assertIsolatedHostProfile,
  hostProfileSandbox,
} from '../../tests/helpers/host-profile-sandbox.ts';
import type { SafewordWorld } from './world.ts';

// Reads the live process environment rather than a fixture on purpose: the
// behaviour under test is that this lane's BeforeAll guard actually ran in this
// runner, and no amount of in-step setup can stand in for that.
When(
  'Safeword reads the Claude host profile this lane is running under',
  function readHostProfile(this: SafewordWorld) {
    this.observedHostProfile = process.env.CLAUDE_CONFIG_DIR;
  },
);

Then("that profile is Safeword's test sandbox", function assertSandbox(this: SafewordWorld) {
  assert.equal(
    this.observedHostProfile,
    hostProfileSandbox(),
    'the acceptance lane did not run the host-profile guard — Cucumber may no longer discover features/steps/host-profile-sandbox.steps.ts, so scenarios would write install records into the real ~/.claude (#4776)',
  );
});

Then(
  "that profile is outside the developer's home directory",
  function assertOutsideHome(this: SafewordWorld) {
    // assertIsolatedHostProfile is the whole check: it rejects the home
    // directory itself as well as anything nested under it. A hand-rolled
    // startsWith here duplicated that and was strictly weaker, missing the
    // exact-equals-home case.
    assertIsolatedHostProfile({ CLAUDE_CONFIG_DIR: this.observedHostProfile });
  },
);
