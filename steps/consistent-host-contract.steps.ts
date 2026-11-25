import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { After, Before, Given, Then, When, type ITestCaseHookParameter } from '@cucumber/cucumber';

import hostReleases from '../packages/cli/src/lifecycle/host-releases.json' with { type: 'json' };

import {
  CursorNativeCatalogueActor,
  type CursorNativeFixtureConfig,
} from '../packages/cli/tests/helpers/cursor-native-catalogue.js';
import type { SafewordWorld } from './world.js';
import './world.js';
import { CursorCliCatalogueActor } from '../packages/cli/tests/helpers/cursor-cli-catalogue.js';
import {
  CodexNativeCatalogueActor,
  readPreparedCodexCatalogue,
} from '../packages/cli/tests/helpers/codex-native-catalogue.js';
import { OpenCodeNativeCatalogueActor } from '../packages/cli/tests/helpers/opencode-native-catalogue.js';
import type { OpenCodeNativeFixture } from '../packages/cli/tests/helpers/opencode-native-write.js';
import { CodexInternalWorkflowActor } from '../packages/cli/tests/helpers/codex-internal-workflows.js';
import { CodexWorkflowRuntimeActor } from '../packages/cli/tests/helpers/codex-workflow-runtime.js';
import { codexInternalCases } from '../packages/cli/tests/fixtures/host-contract/native-contract-cases.js';

interface HostContractWorld extends SafewordWorld {
  internalWorkflowCaseId?: string;
  internalWorkflow?: CodexInternalWorkflowActor;
  internalWorkflowArms?: { arm: string; actor: CodexInternalWorkflowActor }[];
  nativeCatalogue?:
    | CursorNativeCatalogueActor
    | CursorCliCatalogueActor
    | CodexNativeCatalogueActor
    | OpenCodeNativeCatalogueActor;
}

Before(
  { tags: '@codex-internal-workflows' },
  function (this: HostContractWorld, { pickle }: ITestCaseHookParameter) {
    this.internalWorkflowCaseId = codexInternalCases().find(
      row => row.scenario === pickle.name,
    )?.id;
  },
);

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
      codexCatalogueFixtureFile?: string;
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
      const prepared = readPreparedCodexCatalogue(parameters.codexCatalogueFixtureFile);
      this.nativeCatalogue = new CodexNativeCatalogueActor(
        prepared.fixture,
        prepared.inputs,
        'provisioned',
        prepared.expectedPackageRoot,
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

Given(
  `native Codex ${hostReleases.codex.version} has internal testing, public BDD and manual-only explain workflows derived from canonical settings`,
  { timeout: 600_000 },
  async function (this: HostContractWorld) {
    const parameters = this.parameters as {
      codexGuardFixtureFile?: string;
      codexProvisioningIdentityFile?: string;
    };
    assert.ok(
      parameters.codexGuardFixtureFile,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: owned guard fixture required',
    );
    assert.ok(
      parameters.codexProvisioningIdentityFile,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: provisioning identity required',
    );
    const fixture = JSON.parse(readFileSync(parameters.codexGuardFixtureFile, 'utf8')) as {
      mode?: string;
    };
    this.internalWorkflow =
      fixture.mode === 'isolated-behavior'
        ? new CodexWorkflowRuntimeActor(
            parameters.codexGuardFixtureFile,
            parameters.codexProvisioningIdentityFile,
            { caseId: this.internalWorkflowCaseId ?? '', arm: 'single' },
          )
        : new CodexInternalWorkflowActor(
            parameters.codexGuardFixtureFile,
            parameters.codexProvisioningIdentityFile,
          );
    if (this.internalWorkflow instanceof CodexWorkflowRuntimeActor)
      await this.internalWorkflow.prepareCanonical();
    else await this.internalWorkflow.prepare();
  },
);

When(
  'the builder inspects the actual native workflow selector',
  { timeout: 120_000 },
  function (this: HostContractWorld) {
    assert.ok(this.internalWorkflow);
    this.internalWorkflow.inspectPicker();
  },
);

Then('testing is absent while BDD and explain remain offered', function (this: HostContractWorld) {
  assert.ok(this.internalWorkflow);
  this.internalWorkflow.assertPicker();
});

After(
  { tags: '@codex-internal-workflows', timeout: 40_000 },
  async function (this: HostContractWorld, { pickle }: ITestCaseHookParameter) {
    const arms =
      this.internalWorkflowArms ??
      (this.internalWorkflow ? [{ arm: 'single', actor: this.internalWorkflow }] : []);
    const failures: unknown[] = [];
    for (const { arm, actor: instance } of arms) {
      try {
        await instance.preserve();
        const artifacts = instance.artifacts;
        const file = nodePath.join(artifacts, 'preservation.json');
        const observation: unknown = JSON.parse(readFileSync(file, 'utf8'));
        this.attach(
          JSON.stringify({
            kind: 'codex-internal-preservation',
            scenario: pickle.name,
            arm,
            artifacts,
            file,
            observation,
          }),
          'application/json',
        );
      } catch (error) {
        failures.push(error);
      }
    }
    assert.equal(failures.length, 0, failures.map(String).join('\n'));
  },
);
