/**
 * Steps for features/managed-file-refresh.feature (ticket A4HG61, #849).
 * Black-box: build a temp project, drive the real safeword CLI
 * (setup/upgrade/diff/reset), and inspect the provenance manifest at
 * .safeword/managed-files.json plus the managed files it governs.
 */

import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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

interface RefreshWorld extends SafewordWorld {
  projectDirectory?: string;
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

Given('a fresh project with no safeword install', function (this: RefreshWorld) {
  projectDir(this);
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
