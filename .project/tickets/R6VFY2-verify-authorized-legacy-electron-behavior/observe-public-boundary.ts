import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

// Local-host acceptance proof, not a portable Vitest fixture. The real installed
// runtime must prepare and execute the committed Soulless original and mutant.
const project = '/Users/alex/.codex/worktrees/cc7f/soulless-monorepo';
const requestPath =
  '.project/tickets/SGWMBS-open-save-soul-electron/retrospective-proof/cased-suffix.request.json';
const requestBytes = readFileSync(path.join(project, requestPath));
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
assert.equal(
  digest(requestBytes),
  '0f88eebc631ae944bdebdc633aeb76ec0f9482547074a0af21d2a0cc92bfebd0',
  'The committed proof request must remain the reviewed fixture',
);
const request = JSON.parse(requestBytes.toString('utf8')) as {
  ticketId: string;
  scenario: string;
  testFile: string;
  testLine: number;
  testFullName: string;
  implementationPath: string;
  mutation: { before: string; after: string; expectedFailure: string; assertionLocation: string };
  supportFiles: string[];
};
const implementation = readFileSync(path.join(project, request.implementationPath));
const testSource = readFileSync(path.join(project, request.testFile));
assert.equal(digest(implementation), '8055b6bd8ae81e5c27ffc8d5bb65e22539c19f6c97eff7dddb52ddf376d7da72');
assert.equal(digest(testSource), '47dc28ed3a6e2c0f37b29f546628d8f4ee01383c62bff02065aedbe1535cf1b4');
assert.equal(implementation.toString('utf8').split(request.mutation.before).length, 2);
assert.equal(
  testSource.toString('utf8').split('\n')[request.testLine - 1],
  "test('A differently cased soul suffix opens as a package', async () => {",
);
for (const support of request.supportFiles) assert.equal(statSync(path.join(project, support)).isFile(), true);

const inventoryResult = spawnSync('codex', ['plugin', 'list', '--json'], { encoding: 'utf8' });
assert.equal(inventoryResult.status, 0, inventoryResult.stderr);
const inventory = JSON.parse(inventoryResult.stdout) as {
  installed: { pluginId: string; version: string; installed: boolean; enabled: boolean;
    source?: { source?: string; path?: string } }[];
};
const plugins = inventory.installed.filter(plugin =>
  plugin.pluginId === 'safeword@safeword' && plugin.installed && plugin.enabled);
assert.equal(plugins.length, 1, 'Exactly one enabled supported Safeword installation is required');
const plugin = plugins[0]!;
assert.match(plugin.version, /^[a-zA-Z0-9][a-zA-Z0-9.+-]*$/u);
const codexHome = process.env.CODEX_HOME ?? path.join(homedir(), '.codex');
const runtime = path.join(codexHome, 'plugins/cache/safeword/safeword', plugin.version, 'runtime/cli.js');
assert.equal(plugin.source?.source, 'local', 'This proof uses the registered local development bundle');
assert.equal(typeof plugin.source?.path, 'string');
assert.equal(
  digest(readFileSync(runtime)),
  digest(readFileSync(path.join(plugin.source!.path!, 'runtime/cli.js'))),
  'The installed runtime must match the generated supported marketplace bundle',
);
const result = spawnSync(
  process.execPath,
  [runtime, '--cwd', project, 'review', 'observe', 'retrospective', '--request', requestPath, '--json'],
  { encoding: 'utf8', timeout: 600_000, maxBuffer: 8 * 1024 * 1024 },
);
const envelope = JSON.parse(result.stdout) as {
  ok?: boolean;
  data?: {
    command?: string;
    status?: string;
    observation?: {
      commit: string;
      request: { ticketId: string; scenario: string };
      sourceSha256: string;
      supportSha256: Record<string, string>;
      mutatedSupportSha256: Record<string, string>;
      isolation: {
        original: { snapshot: string; build: string; profileRoot: string; rendererPort: number };
        mutated: { snapshot: string; build: string; profileRoot: string; rendererPort: number };
      };
      passing: { exitCode: number; test: string; passedTests: number; failedTests: number };
      mutated: { exitCode: number; test: string; passedTests: number; failedTests: number; failure: string };
    };
  };
};
assert.equal(envelope.ok, true, `Expected real isolated Electron observation: ${result.stdout}`);
assert.equal(result.status, 0, result.stderr);
assert.equal(envelope.data?.command, 'review observe retrospective');
assert.equal(envelope.data?.status, 'observed');
const observation = envelope.data?.observation;
const head = spawnSync('git', ['--no-replace-objects', '-C', project, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
assert.equal(head.status, 0, head.stderr);
assert.equal(observation?.commit, head.stdout.trim());
assert.equal(observation?.request.ticketId, 'SGWMBS');
assert.equal(observation?.request.scenario, request.scenario);
assert.deepEqual(observation?.request, request);
assert.equal(observation?.sourceSha256, digest(implementation));
for (const input of [
  requestPath, request.testFile, request.implementationPath, ...request.supportFiles,
  'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'packages/desktop/package.json',
]) {
  assert.equal(observation?.supportSha256[input], digest(readFileSync(path.join(project, input))), input);
}
const mutant = implementation.toString('utf8').replace(request.mutation.before, () => request.mutation.after);
assert.deepEqual(observation?.mutatedSupportSha256, {
  ...observation?.supportSha256,
  [request.implementationPath]: digest(Buffer.from(mutant)),
});
for (const key of ['snapshot', 'build', 'profileRoot'] as const) {
  const original = observation?.isolation.original[key];
  const mutated = observation?.isolation.mutated[key];
  assert.equal(typeof original, 'string', key);
  assert.equal(typeof mutated, 'string', key);
  assert.equal(path.isAbsolute(original!), true, key);
  assert.equal(path.isAbsolute(mutated!), true, key);
  assert.notEqual(original, mutated, key);
}
const originalPort = observation?.isolation.original.rendererPort;
const mutatedPort = observation?.isolation.mutated.rendererPort;
assert.equal(Number.isInteger(originalPort), true);
assert.equal(Number.isInteger(mutatedPort), true);
assert.notEqual(originalPort, mutatedPort);
assert.deepEqual(observation?.passing, {
  exitCode: 0,
  test: request.testFullName,
  passedTests: 1,
  failedTests: 0,
});
assert.equal(observation?.mutated.passedTests, 0);
assert.equal(observation?.mutated.failedTests, 1);
assert.equal(observation?.mutated.test, request.testFullName);
assert.equal(Number.isInteger(observation?.mutated.exitCode), true);
assert.notEqual(observation?.mutated.exitCode, 0);
assert.equal(observation?.mutated.failure.includes(request.mutation.expectedFailure), true);
assert.equal(observation?.mutated.failure.includes(request.mutation.assertionLocation), true);
console.log('Real installed public observation: original PASS and declared mutation assertion FAIL.');
