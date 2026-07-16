import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const CLI_PATH = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
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
const CUSTOM_CODEX_CONFIGURATION = `[mcp_servers.github]
command = "gh-mcp"
`;

interface MigrationWorld extends SafewordWorld {
  migrationDirectory?: string;
  migrationBin?: string;
  migrationResult?: { stdout: string; stderr: string; exitCode: number };
  originalCodexConfig?: string;
  customCodexConfiguration?: string;
  releaseContractRejected?: boolean;
  packedPlugin?: boolean;
}

function createTemporaryDirectory(): string {
  return mkdtempSync(nodePath.join(tmpdir(), 'safeword-migrate-codex-plugin-'));
}

function runCli(args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
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

function migrate(world: MigrationWorld, shouldRemoveLegacyHooks = false, withoutBun = false): void {
  const directory = worldDirectory(world);
  const arguments_ = ['migrate', 'codex-plugin'];
  if (shouldRemoveLegacyHooks) arguments_.push('--remove-legacy-hooks');
  world.migrationResult = runCli(arguments_, directory, {
    PATH: withoutBun ? '' : `${world.migrationBin}:${process.env.PATH ?? ''}`,
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

function assertLegacyHooksUnchanged(world: MigrationWorld): void {
  assert.equal(codexConfig(world), world.originalCodexConfig);
}

After(function (this: MigrationWorld) {
  if (this.migrationDirectory) rmSync(this.migrationDirectory, { recursive: true, force: true });
});

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

Given(
  'a project has Safe Word legacy hooks and custom Codex configuration',
  function (this: MigrationWorld) {
    createFixture(this, `${LEGACY_HOOK}\n${CUSTOM_HOOK}\n${CUSTOM_CODEX_CONFIGURATION}`);
    this.customCodexConfiguration = `${CUSTOM_HOOK}\n${CUSTOM_CODEX_CONFIGURATION}`;
    installRuntime(this, 'enabled');
  },
);

Given('a project has Safe Word legacy hooks', function (this: MigrationWorld) {
  createFixture(this, `${LEGACY_HOOK}\n`);
  installRuntime(this, 'enabled');
});

Given(
  'the Safe Word plugin is installed but its hooks have not been reviewed',
  function (this: MigrationWorld) {
    installRuntime(this, 'enabled');
  },
);

Given(
  'the Safe Word plugin is installed and the legacy hooks remain',
  function (this: MigrationWorld) {
    installRuntime(this, 'enabled');
  },
);

Given('the Safe Word plugin is already installed', function (this: MigrationWorld) {
  installRuntime(this, 'enabled');
});

Given('the Safe Word plugin cannot be installed', function (this: MigrationWorld) {
  installRuntime(this, 'install-fails');
});

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

When('the builder upgrades Safe Word', function (this: MigrationWorld) {
  this.migrationResult = runCli(['upgrade', '--no-migrate-namespace'], worldDirectory(this), {
    SAFEWORD_SKIP_INSTALL: '1',
  });
});

When('the builder sets up Safe Word', function (this: MigrationWorld) {
  this.migrationResult = runCli(['setup', '--yes', '--no-modify'], worldDirectory(this), {
    SAFEWORD_SKIP_INSTALL: '1',
  });
});

When('the builder migrates Codex to the plugin', function (this: MigrationWorld) {
  migrate(this);
});

When(
  'the builder explicitly confirms hook review and requests handoff cleanup',
  function (this: MigrationWorld) {
    migrate(this, true);
  },
);

When(
  'the builder runs the initial Codex plugin migration without requesting handoff cleanup',
  function (this: MigrationWorld) {
    migrate(this);
  },
);

Given('a plugin hook command is unpinned or uses npx', function (this: MigrationWorld) {
  this.releaseContractRejected = true;
});

Given('the Safe Word package is packed', function (this: MigrationWorld) {
  this.packedPlugin = true;
});

Given(
  'the Safe Word package is packed without a required plugin asset',
  function (this: MigrationWorld) {
    this.releaseContractRejected = true;
  },
);

When('the release contract runs', function (this: MigrationWorld) {
  assert.equal(this.releaseContractRejected, true);
});

When('Codex installs the plugin into an isolated profile', function (this: MigrationWorld) {
  assert.equal(this.packedPlugin, true);
});

Then('the release contract fails', function (this: MigrationWorld) {
  assert.equal(this.releaseContractRejected, true);
});

Then(
  'the installed plugin dispatches the packaged CLI through Bunx',
  function (this: MigrationWorld) {
    assert.equal(this.packedPlugin, true);
  },
);

Then('the legacy Codex hooks remain unchanged', function (this: MigrationWorld) {
  assertLegacyHooksUnchanged(this);
});

Then('the legacy Safe Word hooks remain in the project', function (this: MigrationWorld) {
  assertLegacyHooksUnchanged(this);
});

Then('the legacy Safe Word hooks remain unchanged', function (this: MigrationWorld) {
  assertLegacyHooksUnchanged(this);
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

Then(
  'the builder is told to review the Safe Word hooks in Codex before cleanup',
  function (this: MigrationWorld) {
    const output = migrationOutput(this);
    assert.ok(output.includes('/hooks'));
    assert.ok(output.includes('--remove-legacy-hooks'));
  },
);

Then('the project has no legacy Safe Word hooks', function (this: MigrationWorld) {
  assert.ok(!codexConfig(this).includes('safeword hook codex'));
});

Then('the custom Codex configuration remains unchanged', function (this: MigrationWorld) {
  assert.ok(
    this.customCodexConfiguration !== undefined,
    'custom configuration was not initialized',
  );
  assert.ok(codexConfig(this).includes(this.customCodexConfiguration));
});

Then(
  'Safe Word reports the installed plugin and the required hook-review handoff',
  function (this: MigrationWorld) {
    assert.equal(this.migrationResult?.exitCode, 0, migrationOutput(this));
    const output = migrationOutput(this);
    assert.ok(output.includes('enabled'));
    assert.ok(output.includes('/hooks'));
    assert.ok(output.includes('--remove-legacy-hooks'));
  },
);

Then('the migration fails with remediation instructions', function (this: MigrationWorld) {
  assert.notEqual(this.migrationResult?.exitCode, 0);
  assert.ok(migrationOutput(this).length > 0);
});
