import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

// Explicitly approved proof repair: execute genuine pre-fix Git source, never
// roll back the author's working source or manufacture a candidate mutation.
const baseline = '23585eab6fa256b6f34c4b0e288e18f2d549526f';
const source = nodePath.resolve(import.meta.dirname, '../../../..');
const owned = mkdtempSync(nodePath.join(tmpdir(), 'safeword-options-baseline-'));
const checkout = nodePath.join(owned, 'checkout');
const copies = [
  'packages/cli/tests/host-contract/policy-options.test.ts',
  'packages/cli/tests/fixtures/host-contract/documented-option-composition.json',
  'packages/cli/tests/helpers.ts',
  'packages/cli/tests/helpers/contract-repo-fixture.ts',
];
const production = [
  'packages/cli/src/commands/plan-approval.ts',
  'packages/cli/templates/hooks/lib/plan-gate.ts',
  'packages/cli/templates/hooks/pre-tool-quality.ts',
  'packages/cli/src/host-contract/source-ownership.ts',
  'packages/cli/scripts/check-host-contract.ts',
];
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function run(program: string, args: string[], cwd = source) {
  const result = spawnSync(program, args, {
    cwd,
    maxBuffer: 128 * 1024 * 1024,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal ?? undefined, undefined);
  assert.equal(result.status, 0, result.stderr.toString());
  return result.stdout;
}

try {
  mkdirSync(checkout);
  const archive = nodePath.join(owned, 'baseline.tar');
  run('git', ['archive', '--format=tar', `--output=${archive}`, baseline]);
  run('tar', ['-xf', archive, '-C', checkout]);
  const tree = run('git', ['rev-parse', `${baseline}:`])
    .toString()
    .trim();
  const sourceHashes = Object.fromEntries(
    production.map(path => {
      const bytes = readFileSync(nodePath.join(checkout, path));
      assert.equal(sha256(bytes), sha256(run('git', ['show', `${baseline}:${path}`])));
      return [path, sha256(bytes)];
    }),
  );
  // Build metadata uses real immutable history. All writes are to this owned
  // independent Git directory/index; original object storage is read-only input.
  run('git', ['init', '-q', checkout]);
  const objects = run('git', ['rev-parse', '--path-format=absolute', '--git-path', 'objects'])
    .toString()
    .trim();
  writeFileSync(nodePath.join(checkout, '.git/objects/info/alternates'), `${objects}\n`);
  run('git', ['update-ref', 'HEAD', baseline], checkout);
  run('git', ['read-tree', baseline], checkout);
  const copiedHashes = Object.fromEntries(
    copies.map(path => {
      const destination = nodePath.join(checkout, path);
      mkdirSync(nodePath.dirname(destination), { recursive: true });
      copyFileSync(nodePath.join(source, path), destination);
      const digest = sha256(readFileSync(destination));
      const original = readFileSync(nodePath.join(source, path));
      assert.equal(digest, sha256(original));
      return [path, digest];
    }),
  );
  for (const path of ['node_modules', 'packages/cli/node_modules']) {
    symlinkSync(nodePath.join(source, path), nodePath.join(checkout, path), 'dir');
  }
  const environment = {
    PATH: process.env.PATH,
    HOME: nodePath.join(owned, 'home'),
    XDG_CONFIG_HOME: nodePath.join(owned, 'config'),
    TMPDIR: tmpdir(),
    SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '1800000',
  };
  mkdirSync(environment.HOME);
  mkdirSync(environment.XDG_CONFIG_HOME);
  const args = [
    'run',
    'test',
    'tests/host-contract/policy-options.test.ts',
    '-t',
    'requires enabled design approval at the installed pre-action planning boundary',
  ];
  const lockBytes = readFileSync(nodePath.join(checkout, 'bun.lock'));
  const manifest = {
    kind: 'approved-genuine-baseline-execution',
    baseline,
    tree,
    archive_sha256: sha256(readFileSync(archive)),
    source_sha256: sourceHashes,
    copied_sha256: copiedHashes,
    lock_sha256: sha256(lockBytes),
    runtime: {
      executable: process.execPath,
      sha256: sha256(readFileSync(process.execPath)),
      versions: process.versions,
    },
    dependency_paths: ['node_modules', 'packages/cli/node_modules'].map(path =>
      nodePath.join(source, path),
    ),
    environment,
    execute: [process.execPath, ...args],
    cwd: nodePath.join(checkout, 'packages/cli'),
  };
  process.stdout.write(`${JSON.stringify(manifest)}\n`);
  const result = spawnSync(process.execPath, args, {
    cwd: nodePath.join(checkout, 'packages/cli'),
    env: environment,
    stdio: 'inherit',
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal ?? undefined, undefined);
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(owned, { recursive: true, force: true });
}
