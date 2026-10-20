import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  CodexPortableCatalogueActor,
  type CodexPortableFixtureConfig,
} from '../packages/cli/tests/helpers/codex-portable-catalogue.js';
import type { SafewordWorld } from './world.js';
import './world.js';

interface PortableWorld extends SafewordWorld {
  portableCatalogue?: CodexPortableCatalogueActor;
}
function actor(world: PortableWorld): CodexPortableCatalogueActor {
  assert.ok(world.portableCatalogue, 'Portable candidate must be installed');
  return world.portableCatalogue;
}

Given(
  'a portable Agent Plugins package and its host-specific enforcement extension are installed in {string}',
  { timeout: 300_000 },
  async function (this: PortableWorld, host: string) {
    const parameters = this.parameters as { codexFixtureFile?: unknown };
    assert.equal(typeof parameters.codexFixtureFile, 'string');
    const config = JSON.parse(
      readFileSync(parameters.codexFixtureFile as string, 'utf8'),
    ) as CodexPortableFixtureConfig;
    for (const field of ['binary', 'authenticatedFixtureProfile', 'runsDirectory'] as const) {
      assert.equal(typeof config[field], 'string');
      assert.ok(nodePath.isAbsolute(config[field]));
    }
    this.portableCatalogue = new CodexPortableCatalogueActor(config);
    await actor(this).prepare(host);
  },
);
When(
  "the host loads the package's skill and referenced resource",
  { timeout: 240_000 },
  async function (this: PortableWorld) {
    await actor(this).load();
  },
);
Then(
  'their content resolves from the portable bundle without treating that loading result as enforcement proof',
  function (this: PortableWorld) {
    actor(this).assertPortableSelection();
  },
);
