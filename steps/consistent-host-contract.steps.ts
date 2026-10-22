import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  CursorNativeCatalogueActor,
  type CursorNativeFixtureConfig,
} from '../packages/cli/tests/helpers/cursor-native-catalogue.js';
import type { SafewordWorld } from './world.js';
import './world.js';
import { CursorCliCatalogueActor } from '../packages/cli/tests/helpers/cursor-cli-catalogue.js';
import { CodexNativeCatalogueActor } from '../packages/cli/tests/helpers/codex-native-catalogue.js';
import type { CodexGuardFixture } from '../packages/cli/tests/helpers/codex-native-continuation.js';
import { OpenCodeNativeCatalogueActor } from '../packages/cli/tests/helpers/opencode-native-catalogue.js';
import type { OpenCodeNativeFixture } from '../packages/cli/tests/helpers/opencode-native-write.js';

interface HostContractWorld extends SafewordWorld {
  nativeCatalogue?:
    | CursorNativeCatalogueActor
    | CursorCliCatalogueActor
    | CodexNativeCatalogueActor
    | OpenCodeNativeCatalogueActor;
}

function actor(world: HostContractWorld): NonNullable<HostContractWorld['nativeCatalogue']> {
  assert.ok(world.nativeCatalogue, 'Native catalogue fixture must be prepared');
  return world.nativeCatalogue;
}

Given(
  'an isolated profile for {string} version {string} in {string} has the Safeword native plugin installed',
  { timeout: 600_000 },
  async function (this: HostContractWorld, host: string, version: string, runtime: string) {
    const parameters = this.parameters as {
      cursorFixtureFile?: unknown;
      cursorCli?: string;
      codexGuardFixtureFile?: string;
      opencodeFixtureFile?: string;
    };
    if (host === 'OpenCode V2') {
      assert.ok(parameters.opencodeFixtureFile);
      this.nativeCatalogue = new OpenCodeNativeCatalogueActor(
        JSON.parse(readFileSync(parameters.opencodeFixtureFile, 'utf8')) as OpenCodeNativeFixture,
      );
      await actor(this).prepare(host, version, runtime);
      return;
    }
    if (host === 'Codex') {
      assert.ok(parameters.codexGuardFixtureFile);
      this.nativeCatalogue = new CodexNativeCatalogueActor(
        JSON.parse(readFileSync(parameters.codexGuardFixtureFile, 'utf8')) as CodexGuardFixture,
      );
      await this.nativeCatalogue.prepare(host, version, runtime);
      return;
    }
    if (host === 'Cursor' && runtime === 'CLI') {
      assert.ok(parameters.cursorCli, 'CURSOR_CLI_UNAVAILABLE: set SAFEWORD_CURSOR_CLI');
      this.nativeCatalogue = new CursorCliCatalogueActor(parameters.cursorCli);
      await actor(this).prepare(host, version, runtime);
      return;
    }
    assert.equal(host, 'Cursor', 'HOST_CONTRACT_PROOF_UNAVAILABLE: unsupported catalogue host');
    assert.equal(typeof parameters.cursorFixtureFile, 'string', 'Native fixture path is required');
    const config = JSON.parse(
      readFileSync(parameters.cursorFixtureFile as string, 'utf8'),
    ) as CursorNativeFixtureConfig;
    for (const field of [
      'applicationBundle',
      'profileDirectory',
      'extensionsDirectory',
      'runsDirectory',
    ] as const) {
      assert.equal(typeof config[field], 'string', `Missing fixture ${field}`);
      assert.ok(nodePath.isAbsolute(config[field]), `Expected absolute fixture ${field}`);
    }
    this.nativeCatalogue = new CursorNativeCatalogueActor(config);
    await this.nativeCatalogue.prepare(host, version, runtime);
  },
);

Given(
  'the canonical catalogue includes a workflow with a referenced guide and a runtime helper returning a known marker',
  function (this: HostContractWorld) {
    actor(this).confirmCanonicalProbe();
  },
);

When(
  'that workflow invokes its helper through the native plugin',
  { timeout: 300_000 },
  async function (this: HostContractWorld) {
    await actor(this).invokeWorkflow();
  },
);

Then(
  'the host loads the canonical workflow and guide and the bundled helper returns the expected marker',
  function (this: HostContractWorld) {
    actor(this).assertPackagedResult();
  },
);
