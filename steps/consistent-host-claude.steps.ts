import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Given, Then, When } from '@cucumber/cucumber';

import { proveClaudeNativeCatalogue } from '../packages/cli/tests/helpers/claude-native-catalogue.js';
import { proveClaudeNativeContinuation } from '../packages/cli/tests/helpers/claude-native-continuation.js';
import {
  ClaudeNativeContractActor,
  type ClaudeNativeFixture,
} from '../packages/cli/tests/helpers/claude-native-contract.js';
import type { SafewordWorld } from './world.js';
import './world.js';

interface ClaudeWorld extends SafewordWorld {
  claude?: ClaudeNativeContractActor;
  claudeFixture?: ClaudeNativeFixture;
  disposition?: 'allowed' | 'denied';
  proofError?: unknown;
}
async function prepare(world: ClaudeWorld, host: string, version: string): Promise<void> {
  assert.equal(host, 'Claude Code');
  assert.equal(version, '2.1.170');
  const parameters = world.parameters as { claudeFixtureFile?: string };
  assert.ok(
    parameters.claudeFixtureFile,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: explicit Claude fixture required',
  );
  world.claudeFixture = JSON.parse(
    readFileSync(parameters.claudeFixtureFile, 'utf8'),
  ) as ClaudeNativeFixture;
  world.claude = new ClaudeNativeContractActor(world.claudeFixture);
  await world.claude.prepare();
}
function fixture(world: ClaudeWorld): ClaudeNativeFixture {
  assert.ok(world.claudeFixture);
  return world.claudeFixture;
}
async function observe(world: ClaudeWorld, proof: () => Promise<void>): Promise<void> {
  try {
    await proof();
  } catch (error) {
    world.proofError = error;
  }
}
function assertProof(this: ClaudeWorld): void {
  if (this.proofError) throw this.proofError;
}
Given(
  '{string} version {string} in {string} has its pre-action boundary supplied by the contracted Safeword plugin delivery',
  { timeout: 60_000 },
  async function (this: ClaudeWorld, host: string, version: string, runtime: string) {
    assert.equal(runtime, 'CLI');
    await prepare(this, host, version);
  },
);
Given('the shared policy denies a sentinel file write', function (this: ClaudeWorld) {
  this.disposition = 'denied';
});
Given('the shared policy permits a sentinel file write', function (this: ClaudeWorld) {
  this.disposition = 'allowed';
});
When(
  'that installed host attempts the write',
  { timeout: 300_000 },
  async function (this: ClaudeWorld) {
    assert.ok(this.claude);
    assert.ok(this.disposition);
    const actor = this.claude;
    const disposition = this.disposition;
    await observe(this, () => actor.proveWrite(disposition));
  },
);
Then('the host reports the policy denial and the sentinel file is not created', assertProof);
Then('the sentinel file contains the permitted content', assertProof);
Given(
  'an isolated profile for {string} version {string} in {string} has the Safeword native plugin installed',
  { timeout: 60_000 },
  async function (this: ClaudeWorld, host: string, version: string, runtime: string) {
    assert.equal(runtime, 'CLI');
    await prepare(this, host, version);
  },
);
Given(
  'the canonical catalogue includes a workflow with a referenced guide and a runtime helper returning a known marker',
  function (this: ClaudeWorld) {
    fixture(this);
  },
);
When(
  'that workflow invokes its helper through the native plugin',
  { timeout: 360_000 },
  async function (this: ClaudeWorld) {
    await observe(this, () => proveClaudeNativeCatalogue(fixture(this)));
  },
);
Then(
  'the host loads the canonical workflow and guide and the bundled helper returns the expected marker',
  assertProof,
);
Given(
  '{string} version {string} has its claimed completion guard active with continuation capacity remaining',
  { timeout: 60_000 },
  async function (this: ClaudeWorld, host: string, version: string) {
    await prepare(this, host, version);
  },
);
Given('the current turn is missing required verification evidence', function (this: ClaudeWorld) {
  fixture(this);
});
When(
  'the installed host attempts to finish the conversation',
  { timeout: 300_000 },
  async function (this: ClaudeWorld) {
    await observe(this, () => proveClaudeNativeContinuation(fixture(this)));
  },
);
Then(
  'the host continues the conversation with the unmet verification requirement instead of ending the turn',
  assertProof,
);
