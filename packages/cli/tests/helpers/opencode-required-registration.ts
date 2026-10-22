import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { assertMatchingTree } from './codex-plugin-package.js';
import { openCodeModelFixture } from './opencode-native-driver.js';
import { type OpenCodeNativeFixture, OpenCodeNativeWriteActor } from './opencode-native-write.js';

/** An unrepresentable required worker constraint must fail native activation. */
export async function proveOpenCodeRequiredRegistration(
  fixture: OpenCodeNativeFixture,
  runtime: 'CLI' | 'TUI',
): Promise<void> {
  assert.ok(fixture.v2CandidatePackage);
  const root = mkdtempSync(nodePath.join(fixture.runsDirectory, 'opencode-required-'));
  const source = nodePath.join(root, 'candidate');
  cpSync(fixture.v2CandidatePackage, source, { recursive: true });
  const inventory = nodePath.join(source, 'workers.json');
  const workers = JSON.parse(readFileSync(inventory, 'utf8')) as {
    name: string;
    tools?: string[];
  }[];
  const worker = workers.find(entry => entry.name === 'safeword-reviewer');
  assert.ok(worker);
  assert.ok(worker.tools?.includes('Read'));
  worker.tools = ['UnavailableFixtureTool'];
  writeFileSync(inventory, JSON.stringify(workers));
  const actor = new OpenCodeNativeWriteActor({ ...fixture, v2CandidatePackage: source });
  await actor.prepare('OpenCode V2', '2.0.32', runtime);
  let directory = '';
  let candidate = '';
  let target = '';
  const command = 'printf required-control > required-registration-control.txt';
  await actor.runModelFixture(async paths => {
    ({ directory, candidate } = paths);
    target = nodePath.join(paths.project, 'required-registration-control.txt');
    return openCodeModelFixture(command, directory);
  });
  assertMatchingTree(source, candidate);
  const observations = readFileSync(nodePath.join(directory, 'native-observations.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(
      line =>
        JSON.parse(line) as {
          tool?: string;
          input?: { command?: string };
          session_id?: string;
          plugins?: { source: { path?: string }; state: { status: string; error?: unknown } }[];
        },
    );
  const attempts = observations.filter(
    row => row.tool === 'shell' && row.input?.command === command,
  );
  assert.equal(
    attempts.length,
    1,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: missing native control action',
  );
  const registration = attempts[0]?.plugins?.find(
    plugin => plugin.source.path === candidate || plugin.source.path?.startsWith(`${candidate}/`),
  );
  assert.ok(registration, 'HOST_CONTRACT_PROOF_UNAVAILABLE: candidate state was not observed');
  writeFileSync(
    nodePath.join(directory, 'required-registration-outcome.json'),
    JSON.stringify(
      { runtime, worker: worker.name, registration, session: attempts[0]?.session_id },
      undefined,
      2,
    ),
  );
  assert.notEqual(registration.state.status, 'active', 'V2_REQUIRED_REGISTRATION_STILL_ACTIVE');
  assert.match(
    String(registration.state.error),
    /OpenCode V2 cannot preserve worker tool authority/u,
  );
  assert.ok(String(registration.state.error).includes(`${worker.name}/UnavailableFixtureTool`));
  // Native rollback removes registrations from the failed package. This is an
  // ordinary control write, never permission to run unguarded customer work.
  assert.equal(
    existsSync(target),
    true,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: native control did not run',
  );
  assert.equal(readFileSync(target, 'utf8'), 'required-control');
  console.log(`OpenCode ${runtime} required registration is unavailable: ${directory}`);
}
