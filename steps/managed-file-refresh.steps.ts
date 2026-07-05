/**
 * Steps for features/managed-file-refresh.feature (ticket A4HG61, #849).
 * Black-box: build a temp project, drive the real safeword CLI
 * (setup/upgrade/diff/reset), and inspect the provenance manifest at
 * .safeword/managed-files.json plus the managed files it governs.
 */

import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CLI_PATH = nodePath.join(PROJECT_ROOT, 'packages/cli/src/cli.ts');
const MANIFEST_RELATIVE_PATH = '.safeword/managed-files.json';

/** Managed files setup always writes into an empty project (BDD lane + codex config). */
const REPRESENTATIVE_MANAGED_FILES = [
  'features/safeword-lane.feature',
  'steps/world.ts',
  'steps/shared.steps.ts',
  '.codex/config.toml',
];

/** A stable static managed file to exercise refresh mechanics against. */
const TARGET_MANAGED_FILE = 'features/safeword-lane.feature';

/** Placeholder bytes standing in for an older safeword revision's output. */
const OLD_REVISION_CONTENT = '# an older safeword revision wrote this\n';

/** Placeholder bytes standing in for a customer's hand edit. */
const CUSTOMER_EDIT_CONTENT = '# the customer edited this file\n';

interface RefreshWorld extends SafewordWorld {
  projectDirectory?: string;
  /** The currently resolved (template) content for the target file, captured post-setup. */
  currentResolved?: string;
  /** Bytes the scenario expects upgrade to leave untouched. */
  frozenBytes?: string;
  /** Manifest entries captured before the When, for preservation asserts. */
  manifestBefore?: Record<string, string>;
}

function projectDir(world: RefreshWorld): string {
  world.projectDirectory ??= mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'managed-refresh-'));
  return world.projectDirectory;
}

/** Drive the real CLI hermetically; record the result on the world. */
function runSafeword(world: RefreshWorld, args: string[]): void {
  const result = spawnSync('bun', [CLI_PATH, ...args], {
    cwd: projectDir(world),
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      SAFEWORD_TEST_DISABLE_AUTO_UPGRADE: '1',
      SAFEWORD_SKIP_INSTALL: '1',
    },
  });
  world.result = {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function readManifest(world: RefreshWorld): { files: Record<string, string> } {
  const manifestPath = nodePath.join(projectDir(world), MANIFEST_RELATIVE_PATH);
  assert.ok(existsSync(manifestPath), `expected provenance manifest at ${MANIFEST_RELATIVE_PATH}`);
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as { files: Record<string, string> };
}

After(function (this: RefreshWorld) {
  if (this.projectDirectory !== undefined) {
    rmSync(this.projectDirectory, { recursive: true, force: true });
  }
});

/** Run setup and capture the target file's resolved content + manifest state. */
function installProject(world: RefreshWorld): void {
  runSafeword(world, ['setup', '--yes']);
  assert.equal(world.result.exitCode, 0, `setup failed:\n${world.result.stderr}`);
  world.currentResolved = readFileSync(
    nodePath.join(projectDir(world), TARGET_MANAGED_FILE),
    'utf8',
  );
}

/** Overwrite the target file AND its record consistently — the state an older install left behind. */
function simulateOlderInstall(world: RefreshWorld): void {
  const dir = projectDir(world);
  writeFileSync(nodePath.join(dir, TARGET_MANAGED_FILE), OLD_REVISION_CONTENT);
  const manifest = readManifest(world);
  manifest.files[TARGET_MANAGED_FILE] = sha256(OLD_REVISION_CONTENT);
  writeFileSync(
    nodePath.join(dir, MANIFEST_RELATIVE_PATH),
    `${JSON.stringify({ version: 1, files: manifest.files }, undefined, 2)}\n`,
  );
}

Given('a fresh project with no safeword install', function (this: RefreshWorld) {
  projectDir(this);
});

Given(
  'a clone of an installed project with a committed provenance manifest',
  function (this: RefreshWorld) {
    installProject(this);
    this.manifestBefore = readManifest(this).files;
  },
);

Given(
  'an installed project whose managed file matches its recorded provenance',
  function (this: RefreshWorld) {
    installProject(this);
    const recorded = readManifest(this).files[TARGET_MANAGED_FILE];
    assert.equal(recorded, sha256(this.currentResolved ?? ''), 'setup left a mismatched record');
  },
);

Given('safeword now resolves different content for that file', function (this: RefreshWorld) {
  // With one CLI build the template cannot change mid-scenario; instead,
  // construct the state an older install left behind — old bytes with a
  // matching record — so the CURRENT template genuinely differs (pristine +
  // stale, exactly the upgrade-from-older-safeword state).
  simulateOlderInstall(this);
});

Given('an installed project whose managed file was deleted', function (this: RefreshWorld) {
  installProject(this);
  rmSync(nodePath.join(projectDir(this), TARGET_MANAGED_FILE));
});

Given(
  'an installed project with a managed-path file that has no provenance entry',
  function (this: RefreshWorld) {
    installProject(this);
    const dir = projectDir(this);
    const manifest = readManifest(this);
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- constructing the unrecorded state
    delete manifest.files[TARGET_MANAGED_FILE];
    writeFileSync(
      nodePath.join(dir, MANIFEST_RELATIVE_PATH),
      `${JSON.stringify({ version: 1, files: manifest.files }, undefined, 2)}\n`,
    );
  },
);

Given(
  "that file's content differs from the currently resolved output",
  function (this: RefreshWorld) {
    this.frozenBytes = CUSTOMER_EDIT_CONTENT;
    writeFileSync(nodePath.join(projectDir(this), TARGET_MANAGED_FILE), CUSTOMER_EDIT_CONTENT);
  },
);

When('safeword upgrade runs', function (this: RefreshWorld) {
  runSafeword(this, ['upgrade']);
});

Then('the upgrade succeeds', function (this: RefreshWorld) {
  assert.equal(this.result.exitCode, 0, `upgrade failed:\n${this.result.stderr}`);
});

Then(
  'the manifest still records every previously recorded managed file',
  function (this: RefreshWorld) {
    const after = readManifest(this).files;
    for (const [path, hash] of Object.entries(this.manifestBefore ?? {})) {
      assert.equal(after[path], hash, `provenance for ${path} was lost or changed by setup`);
    }
  },
);

Then('the file contains the newly resolved content', function (this: RefreshWorld) {
  const onDisk = readFileSync(nodePath.join(projectDir(this), TARGET_MANAGED_FILE), 'utf8');
  assert.equal(onDisk, this.currentResolved, 'file was not refreshed to current resolved content');
});

Then('the manifest records the new content for that file', function (this: RefreshWorld) {
  assert.equal(
    readManifest(this).files[TARGET_MANAGED_FILE],
    sha256(this.currentResolved ?? ''),
    'manifest was not updated to the refreshed content',
  );
});

Then('the file exists with currently resolved content', function (this: RefreshWorld) {
  const fullPath = nodePath.join(projectDir(this), TARGET_MANAGED_FILE);
  assert.ok(existsSync(fullPath), 'deleted managed file was not recreated');
  assert.equal(readFileSync(fullPath, 'utf8'), this.currentResolved);
});

Then("the file's bytes are unchanged", function (this: RefreshWorld) {
  const onDisk = readFileSync(nodePath.join(projectDir(this), TARGET_MANAGED_FILE), 'utf8');
  assert.equal(onDisk, this.frozenBytes, 'a file safeword cannot prove pristine was rewritten');
});

When('safeword setup runs', function (this: RefreshWorld) {
  runSafeword(this, ['setup', '--yes']);
  assert.equal(this.result.exitCode, 0, `setup failed:\n${this.result.stderr}`);
});

Then(
  'the provenance manifest records every managed file setup wrote',
  function (this: RefreshWorld) {
    const manifest = readManifest(this);
    for (const relativePath of REPRESENTATIVE_MANAGED_FILES) {
      assert.ok(
        manifest.files[relativePath] !== undefined,
        `manifest is missing an entry for ${relativePath}`,
      );
    }
  },
);

Then("each recorded hash matches that file's on-disk content", function (this: RefreshWorld) {
  const manifest = readManifest(this);
  for (const [relativePath, recordedHash] of Object.entries(manifest.files)) {
    const absolutePath = nodePath.join(projectDir(this), relativePath);
    assert.ok(existsSync(absolutePath), `recorded file ${relativePath} is missing on disk`);
    assert.equal(
      recordedHash,
      sha256(readFileSync(absolutePath, 'utf8')),
      `recorded hash for ${relativePath} does not match on-disk content`,
    );
  }
});
