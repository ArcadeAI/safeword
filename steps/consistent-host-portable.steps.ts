import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  CodexPortableCatalogueActor,
  type CodexPortableFixtureConfig,
} from '../packages/cli/tests/helpers/codex-portable-catalogue.js';
import { CursorCliCatalogueActor } from '../packages/cli/tests/helpers/cursor-cli-catalogue.js';
import { CursorNativeCatalogueActor } from '../packages/cli/tests/helpers/cursor-native-catalogue.js';
import hostReleases from '../packages/cli/src/lifecycle/host-releases.json' with { type: 'json' };
import type { SafewordWorld } from './world.js';
import './world.js';

interface PortableWorld extends SafewordWorld {
  portableCatalogue?:
    CodexPortableCatalogueActor | CursorCliCatalogueActor | CursorNativeCatalogueActor;
}
function actor(world: PortableWorld): NonNullable<PortableWorld['portableCatalogue']> {
  assert.ok(world.portableCatalogue, 'Portable candidate must be installed');
  return world.portableCatalogue;
}

Given(
  'a portable Agent Plugins package and its host-specific enforcement extension are installed in {string} version {string} in {string}',
  { timeout: 300_000 },
  async function (this: PortableWorld, host: string, version: string, runtime: string) {
    const parameters = this.parameters as {
      codexFixtureFile?: unknown;
      portableRuntime?: string;
      cursorCli?: string;
      cursorFixtureFile?: string;
    };
    assert.equal(runtime, parameters.portableRuntime);
    if (host === 'Cursor') {
      if (parameters.portableRuntime === 'CLI') {
        assert.ok(parameters.cursorCli);
        const instance = new CursorCliCatalogueActor(parameters.cursorCli);
        this.portableCatalogue = instance;
        assert.equal(version, hostReleases.cursorCli.version);
        await instance.prepare(host, version, runtime);
      } else {
        assert.equal(parameters.portableRuntime, 'IDE');
        assert.ok(parameters.cursorFixtureFile);
        const instance = new CursorNativeCatalogueActor(
          JSON.parse(readFileSync(parameters.cursorFixtureFile, 'utf8')),
        );
        this.portableCatalogue = instance;
        assert.equal(version, hostReleases.cursorIde.version);
        await instance.prepare(host, version, runtime, 'portable');
      }
      return;
    }
    assert.equal(host, 'Codex');
    assert.equal(version, hostReleases.codex.version);
    assert.equal(runtime, 'CLI');
    assert.equal(typeof parameters.codexFixtureFile, 'string');
    const config = JSON.parse(
      readFileSync(parameters.codexFixtureFile as string, 'utf8'),
    ) as CodexPortableFixtureConfig;
    for (const field of ['binary', 'authenticatedFixtureProfile', 'runsDirectory'] as const) {
      assert.equal(typeof config[field], 'string');
      assert.ok(nodePath.isAbsolute(config[field]));
    }
    this.portableCatalogue = new CodexPortableCatalogueActor(config);
    await this.portableCatalogue.prepare(host);
  },
);
When(
  "the host loads the package's skill and referenced resource",
  { timeout: 240_000 },
  async function (this: PortableWorld) {
    const instance = actor(this);
    if (instance instanceof CodexPortableCatalogueActor) await instance.load();
    else await instance.invokeWorkflow();
  },
);
Then(
  'their content resolves from the portable bundle without treating that loading result as enforcement proof',
  function (this: PortableWorld) {
    const instance = actor(this);
    if (instance instanceof CodexPortableCatalogueActor) instance.assertPortableSelection();
    // Helper attribution is an observation prerequisite, not a portable-resource guarantee.
    // Missing model/observer/helper evidence must retain unavailable classification.
    else instance.assertPackagedResult();
  },
);
