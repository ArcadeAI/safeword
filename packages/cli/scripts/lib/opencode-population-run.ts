import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { openCodeV2PayloadDigest } from '../../src/opencode/v2-enrollment.js';
import { proveOpenCodeHostSchemaRejection } from '../../tests/helpers/opencode-host-schema-registration.js';
import { OpenCodeNativeCatalogueActor } from '../../tests/helpers/opencode-native-catalogue.js';
import { proveOpenCodeCoexistence } from '../../tests/helpers/opencode-native-coexistence.js';
import { proveOpenCodeOptionalRegistration } from '../../tests/helpers/opencode-native-registration.js';
import { proveOpenCodeWorker } from '../../tests/helpers/opencode-native-worker.js';
import {
  type OpenCodeNativeFixture,
  OpenCodeNativeWriteActor,
} from '../../tests/helpers/opencode-native-write.js';
import { proveOpenCodeRequiredRegistration } from '../../tests/helpers/opencode-required-registration.js';
import {
  type OpenCodeCase,
  openCodePopulation,
  runOpenCodePopulation,
} from './opencode-population.js';

const specialized = {
  worker: proveOpenCodeWorker,
  'required-worker': proveOpenCodeRequiredRegistration,
  'required-registration': proveOpenCodeHostSchemaRejection,
  'optional-registration': proveOpenCodeOptionalRegistration,
  coexistence: proveOpenCodeCoexistence,
};
async function execute(fixture: OpenCodeNativeFixture, batch: OpenCodeCase[]): Promise<void> {
  const row = batch[0];
  assert.ok(row);
  if (Object.hasOwn(specialized, row.kind)) {
    const invoke = specialized[row.kind as keyof typeof specialized];
    await invoke(fixture, row.runtime);
    return;
  }
  if (row.kind === 'allowed-write' || row.kind === 'denied-write') {
    const actor = new OpenCodeNativeWriteActor(fixture);
    await actor.prepare(row.host, row.version, row.runtime);
    actor.setPolicy(row.kind === 'allowed-write' ? 'allowed' : 'denied');
    await actor.attempt();
    actor.assertOutcome();
    return;
  }
  const actor = new OpenCodeNativeCatalogueActor(
    fixture,
    row.kind === 'commands' ? 'command' : 'skill',
  );
  await actor.prepare(row.host, row.version, row.runtime);
  actor.confirmCanonicalProbe();
  await actor.invokeWorkflow();
  actor.assertPackagedResult();
}
async function main(): Promise<number> {
  const required = openCodePopulation();
  console.log(`OPENCODE_REQUIRED_CASES: ${JSON.stringify(required)}`);
  const file = process.env.SAFEWORD_OPENCODE_TEST_CONFIG;
  assert.ok(file, 'HOST_CONTRACT_PROOF_UNAVAILABLE: explicit OpenCode fixture required');
  const fixture = JSON.parse(readFileSync(file, 'utf8')) as OpenCodeNativeFixture;
  assert.ok(
    fixture.v2CandidatePackage,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: generated candidate required',
  );
  const payload = openCodeV2PayloadDigest(fixture.v2CandidatePackage);
  const outcome = await runOpenCodePopulation(required, batch => execute(fixture, batch));
  assert.equal(
    openCodeV2PayloadDigest(fixture.v2CandidatePackage),
    payload,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: OpenCode candidate changed during execution',
  );
  const directory =
    process.argv[2] ?? mkdtempSync(nodePath.join(tmpdir(), 'safeword-opencode-population-'));
  writeFileSync(
    nodePath.join(directory, process.argv[2] ? 'opencode-cases.json' : 'cases.json'),
    JSON.stringify(
      {
        purpose: 'diagnostic-only',
        admission_eligible: false,
        candidate_payload_sha256: payload,
        required,
        ...outcome,
      },
      undefined,
      2,
    ),
  );
  console.log(`OpenCode exact cases: ${JSON.stringify(outcome.results)}; report: ${directory}`);
  return outcome.exit;
}
async function run(): Promise<number> {
  try {
    return await main();
  } catch (error) {
    console.error(error);
    return 3;
  }
}
process.exitCode = await run();
