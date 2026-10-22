import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { assertMatchingTree } from './codex-plugin-package.js';
import { openCodeModelFixture } from './opencode-native-driver.js';
import { type OpenCodeNativeFixture, OpenCodeNativeWriteActor } from './opencode-native-write.js';

/** Native module-schema fault injection, never an adapter-thrown registration error. */
export async function proveOpenCodeHostSchemaRejection(
  fixture: OpenCodeNativeFixture,
  runtime: 'CLI' | 'TUI',
): Promise<void> {
  assert.ok(fixture.v2CandidatePackage);
  const root = mkdtempSync(nodePath.join(fixture.runsDirectory, 'opencode-host-schema-'));
  const source = nodePath.join(root, 'candidate');
  cpSync(fixture.v2CandidatePackage, source, { recursive: true });
  const original = readFileSync(nodePath.join(source, 'index.js'));
  writeFileSync(nodePath.join(source, 'valid-definition.js'), original);
  writeFileSync(
    nodePath.join(source, 'index.js'),
    'import definition from "./valid-definition.js";\nexport default { ...definition, id: 42 };\n',
  );
  const actor = new OpenCodeNativeWriteActor({ ...fixture, v2CandidatePackage: source });
  await actor.prepare('OpenCode V2', '2.0.32', runtime);
  let directory = '';
  let candidate = '';
  let project = '';
  const command = 'printf schema-control > native-schema-control.txt';
  await actor.runModelFixture(async paths => {
    ({ directory, candidate, project } = paths);
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
    'HOST_CONTRACT_PROOF_UNAVAILABLE: native control action missing',
  );
  const registration = attempts[0]?.plugins?.find(plugin =>
    plugin.source.path?.startsWith(`${candidate}/`),
  );
  assert.equal(
    registration,
    undefined,
    'V2_REQUIRED_HOST_SCHEMA_REJECTION_MISSING: malformed module was registered',
  );
  const log = readFileSync(nodePath.join(directory, 'data/opencode/log/opencode.log'), 'utf8');
  const rejection = log
    .split(/(?=timestamp=)/u)
    .filter(
      entry =>
        entry.includes('message="failed to load plugin"') && entry.includes(`target=${candidate} `),
    );
  assert.equal(
    rejection.length,
    1,
    'V2_REQUIRED_HOST_SCHEMA_REJECTION_MISSING: native loader rejection not observed',
  );
  const cause = / cause=(?<cause>"(?:[^"\\]|\\.)*")/u.exec(rejection[0] ?? '')?.groups?.cause;
  assert.ok(cause, 'V2_REQUIRED_HOST_SCHEMA_REJECTION_MISSING: native cause missing');
  const error = JSON.parse(cause) as string;
  assert.match(error, /PluginModule.LoadError/u, 'V2_REQUIRED_HOST_SCHEMA_REJECTION_MISSING');
  assert.match(error, /SchemaError/u, 'V2_REQUIRED_HOST_SCHEMA_REJECTION_MISSING');
  assert.match(error, /\["default"\]\["id"\]/u, 'V2_REQUIRED_HOST_SCHEMA_REJECTION_MISSING');
  assert.equal(
    readFileSync(nodePath.join(project, 'native-schema-control.txt'), 'utf8'),
    'schema-control',
  );
  assert.equal(
    existsSync(nodePath.join(directory, 'runtime-observations.jsonl')),
    false,
    'V2_REQUIRED_HOST_SCHEMA_REJECTION_MISSING: rejected package dispatched its runtime',
  );
  writeFileSync(
    nodePath.join(directory, 'host-schema-registration-outcome.json'),
    JSON.stringify(
      {
        runtime,
        native_registration_absent: true,
        native_loader_error: error,
        session: attempts[0]?.session_id,
        guarantee: 'reject_action',
        disposition: 'unmet',
      },
      undefined,
      2,
    ),
  );

  // Paired unchanged production candidate: native activation and real guard work.
  const valid = new OpenCodeNativeWriteActor(fixture);
  await valid.prepare('OpenCode V2', '2.0.32', runtime);
  valid.setPolicy('denied');
  await valid.attempt();
  valid.assertOutcome();
  console.log(
    `OpenCode ${runtime} required host-schema rejection and valid guard passed: ${directory}`,
  );
}
