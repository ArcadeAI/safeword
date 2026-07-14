import { strict as assert } from 'node:assert';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { Given, Then, When } from '@cucumber/cucumber';

import { createTemporaryDirectory, runCli } from '../../tests/helpers.js';
import type { SafewordWorld } from './world.js';

const LEGACY_HOOK = `[[hooks.PreToolUse]]
matcher = "^(apply_patch)$"

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'npx --yes safeword hook codex pre-tool-use'
`;
const CUSTOM_HOOK = `[[hooks.PreToolUse]]
matcher = "^custom$"

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'echo custom'
`;

interface MigrationWorld extends SafewordWorld {
  migrationDirectory?: string;
  migrationBin?: string;
  migrationResult?: { stdout: string; stderr: string; exitCode: number };
  originalCodexConfig?: string;
}

function worldDirectory(world: MigrationWorld): string {
  if (!world.migrationDirectory) throw new Error('migration fixture was not initialized');
  return world.migrationDirectory;
}

function writeExecutable(path: string, content: string): void {
  writeFileSync(path, content, { mode: 0o755 });
  chmodSync(path, 0o755);
}

function createFixture(world: MigrationWorld, config: string): void {
  const directory = createTemporaryDirectory();
  world.migrationDirectory = directory;
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  mkdirSync(nodePath.join(directory, '.codex'), { recursive: true });
  writeFileSync(nodePath.join(directory, '.safeword/version'), '0.68.0\n');
  writeFileSync(nodePath.join(directory, '.codex/config.toml'), config);
  world.originalCodexConfig = config;
}

function installRuntime(
  world: MigrationWorld,
  mode: 'enabled' | 'disabled' | 'install-fails',
): void {
  const directory = worldDirectory(world);
  const bin = nodePath.join(directory, 'bin');
  mkdirSync(bin, { recursive: true });
  writeExecutable(nodePath.join(bin, 'bun'), '#!/bin/sh\nexit 0\n');
  const pluginAdd = mode === 'install-fails' ? 'exit 2' : "echo '{}'";
  const enabled = mode === 'enabled' ? 'true' : 'false';
  writeExecutable(
    nodePath.join(bin, 'codex'),
    `#!/bin/sh
case "$*" in
  '--version') echo 'codex 0.141.0' ;;
  'plugin marketplace add '* ) echo '{}' ;;
  'plugin add safeword@safeword --json') ${pluginAdd} ;;
  'plugin list --json') echo '{"installed":[{"pluginId":"safeword@safeword","enabled":${enabled}}]}' ;;
  *) exit 2 ;;
esac
`,
  );
  world.migrationBin = bin;
}

async function migrate(world: MigrationWorld, withoutBun = false): Promise<void> {
  const directory = worldDirectory(world);
  world.migrationResult = await runCli(['migrate', 'codex-plugin'], {
    cwd: directory,
    env: {
      PATH: withoutBun ? '' : `${world.migrationBin}:${process.env.PATH ?? ''}`,
    },
  });
}

function codexConfig(world: MigrationWorld): string {
  return readFileSync(nodePath.join(worldDirectory(world), '.codex/config.toml'), 'utf8');
}

function migrationOutput(world: MigrationWorld): string {
  return `${world.migrationResult?.stdout}\n${world.migrationResult?.stderr}`;
}

function codexConfigPath(world: MigrationWorld): string {
  return nodePath.join(worldDirectory(world), '.codex/config.toml');
}

Given('a Safe Word project has legacy Codex hooks', function (this: MigrationWorld) {
  createFixture(this, `${LEGACY_HOOK}\n`);
  installRuntime(this, 'enabled');
});

Given(
  'a Safe Word project has legacy Codex hooks and a custom Codex hook',
  function (this: MigrationWorld) {
    createFixture(this, `${LEGACY_HOOK}\n${CUSTOM_HOOK}`);
    installRuntime(this, 'enabled');
  },
);

Given(
  'a Safe Word project has a custom Codex hook but no legacy Codex hooks',
  function (this: MigrationWorld) {
    createFixture(this, CUSTOM_HOOK);
    installRuntime(this, 'enabled');
  },
);

Given('a project has no Codex configuration', function (this: MigrationWorld) {
  const directory = createTemporaryDirectory();
  this.migrationDirectory = directory;
  writeFileSync(nodePath.join(directory, 'package.json'), '{"name":"fixture","version":"1.0.0"}\n');
});

Given(
  'the Safe Word Codex plugin can be installed and is enabled',
  function (this: MigrationWorld) {
    installRuntime(this, 'enabled');
  },
);

Given('the Safe Word Codex plugin cannot be installed', function (this: MigrationWorld) {
  installRuntime(this, 'install-fails');
});

Given('Codex reports the Safe Word plugin is disabled', function (this: MigrationWorld) {
  installRuntime(this, 'disabled');
});

Given('Bun is unavailable', function (this: MigrationWorld) {
  this.migrationBin = undefined;
});

When('the builder upgrades Safe Word', async function (this: MigrationWorld) {
  this.migrationResult = await runCli(['upgrade', '--no-migrate-namespace'], {
    cwd: worldDirectory(this),
    env: { SAFEWORD_SKIP_INSTALL: '1' },
  });
});

When('the builder sets up Safe Word', async function (this: MigrationWorld) {
  this.migrationResult = await runCli(['setup', '--yes', '--no-modify'], {
    cwd: worldDirectory(this),
    env: { SAFEWORD_SKIP_INSTALL: '1' },
  });
});

When('the builder migrates Codex to the plugin', async function (this: MigrationWorld) {
  await migrate(this);
});

When('the release contract runs', () => {
  throw new Error('Release-contract scenarios run in the release test suite.');
});

Then('the legacy Codex hooks remain unchanged', function (this: MigrationWorld) {
  assert.equal(codexConfig(this), this.originalCodexConfig);
});

Then('the project has no Safe Word Codex hook configuration', function (this: MigrationWorld) {
  assert.equal(this.migrationResult?.exitCode, 0);
  assert.equal(existsSync(codexConfigPath(this)), false);
});

Then('the active Codex profile has the enabled Safe Word plugin', function (this: MigrationWorld) {
  assert.equal(
    this.migrationResult?.exitCode,
    0,
    this.migrationResult?.stderr ?? 'migration failed',
  );
});

Then('the project has no Safe Word Codex hooks', function (this: MigrationWorld) {
  assert.ok(!codexConfig(this).includes('safeword hook codex'));
});

Then('the migration fails with a remediation message', function (this: MigrationWorld) {
  assert.notEqual(this.migrationResult?.exitCode, 0);
  assert.ok(migrationOutput(this).length > 0);
});

Then('the custom Codex hook remains unchanged', function (this: MigrationWorld) {
  assert.ok(codexConfig(this).includes("command = 'echo custom'"));
});
