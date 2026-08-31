/* eslint-disable unicorn/no-null -- migration JSON uses null for unavailable profile facts */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { publicHandler } from '../../src/cli-protocol/public-handlers.js';
import { applyCodexFinalization } from '../../src/codex-plugin/finalization.js';
import { acquireCodexProfileLock } from '../../src/codex-plugin/profile-lock.js';
import {
  CODEX_PLUGIN_HOOK_EVENTS,
  recordCodexHookProof,
  writeCodexActivationMarker,
} from '../../src/codex-plugin/profile-proof.js';
import {
  automaticallyMigrateLegacyCodex,
  removeLegacyCodexHooks,
} from '../../src/commands/migrate-codex-plugin.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';
import { createTemporaryDirectory, removeTemporaryDirectory, runCli } from '../helpers';
import { installFakeCodexRuntime } from '../helpers/fake-codex-runtime.js';

const LEGACY_HOOK_CONFIG = `# Safeword Codex project configuration.

[features]
hooks = true

[[hooks.PreToolUse]]
matcher = "^(apply_patch)$"

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'npx --yes safeword hook codex pre-tool-use'
`;

const LEGACY_PROMPT_CONTEXT_CONFIG = `
[[hooks.UserPromptSubmit]]

[[hooks.UserPromptSubmit.hooks]]
type = "command"
command = 'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/prompt-timestamp.ts"'

[[hooks.UserPromptSubmit]]

[[hooks.UserPromptSubmit.hooks]]
type = "command"
command = 'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/prompt-retro-nudge.ts"'
`;

const USER_CODEX_CONFIG = `
[mcp_servers.github]
command = "gh-mcp"

[projects."/Users/alex/work"]
trust_level = "trusted"
`;

const CUSTOM_PRE_TOOL_HOOK = `
[[hooks.PreToolUse.hooks]]
type = "command"
command = 'echo "keep this user hook"'
`;

describe('migrate codex-plugin command', () => {
  const directories: string[] = [];

  function createMigrationFixture(
    config: string,
    {
      pluginEnabled = true,
      pluginInitiallyInstalled = true,
      pluginVersion,
    }: {
      pluginEnabled?: boolean;
      pluginInitiallyInstalled?: boolean;
      pluginVersion?: string;
    } = {},
  ) {
    const directory = createTemporaryDirectory();
    directories.push(directory);
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(directory, '.codex'), { recursive: true });
    writeFileSync(nodePath.join(directory, '.safeword/version'), '0.68.0\n');
    const configPath = nodePath.join(directory, '.codex/config.toml');
    writeFileSync(configPath, config);

    const runtime = installFakeCodexRuntime(directory, {
      pluginEnabled,
      pluginInitiallyInstalled,
      pluginVersion,
    });
    return {
      directory,
      configPath,
      bin: runtime.bin,
      codexHome: runtime.codexHome,
      logPath: runtime.logPath,
    };
  }

  function runMigration(
    fixture: ReturnType<typeof createMigrationFixture>,
    {
      cleanupLegacyHooks = false,
      environment = {},
    }: { cleanupLegacyHooks?: boolean; environment?: NodeJS.ProcessEnv } = {},
  ) {
    if (cleanupLegacyHooks) recordCurrentProof(fixture);
    return runCli(
      [
        'migrate',
        'codex-plugin',
        ...(cleanupLegacyHooks ? ['--remove-legacy-hooks', '--yes'] : []),
      ],
      {
        cwd: fixture.directory,
        env: {
          PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
          SAFEWORD_CODEX_LOG: fixture.logPath,
          CODEX_HOME: fixture.codexHome,
          ...environment,
        },
      },
    );
  }

  function runCodexCommand(
    fixture: ReturnType<typeof createMigrationFixture>,
    arguments_: string[],
    environment: NodeJS.ProcessEnv = {},
  ) {
    return runCli(arguments_, {
      cwd: fixture.directory,
      env: {
        PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
        SAFEWORD_CODEX_LOG: fixture.logPath,
        CODEX_HOME: fixture.codexHome,
        ...environment,
      },
    });
  }

  function stubAutomaticMigrationEnvironment(
    fixture: ReturnType<typeof createMigrationFixture>,
  ): NodeJS.ProcessEnv {
    const environment = { CODEX_HOME: fixture.codexHome };
    vi.stubEnv('PATH', `${fixture.bin}:${process.env.PATH ?? ''}`);
    vi.stubEnv('SAFEWORD_CODEX_LOG', fixture.logPath);
    vi.stubEnv('CODEX_HOME', environment.CODEX_HOME);
    return environment;
  }

  function recordCurrentProof(fixture: ReturnType<typeof createMigrationFixture>): void {
    const environment = { CODEX_HOME: fixture.codexHome };
    const markerPath = nodePath.join(fixture.codexHome, 'safeword/activation-pending-v2.json');
    const activationPending = existsSync(markerPath);
    if (activationPending) {
      const marker = JSON.parse(readFileSync(markerPath, 'utf8')) as { activation_id: string };
      writeCodexActivationMarker(environment, new Date(Date.now() - 1000), {
        activationId: marker.activation_id,
        activeHosts: [{ pid: 100, started_at: '2026-08-14T08:00:00.000Z' }],
      });
      recordCodexHookProof('session-start', environment, new Date(), {
        currentHost: { pid: 200, started_at: '2026-08-14T09:00:00.000Z' },
      });
    }
    for (const event of CODEX_PLUGIN_HOOK_EVENTS) {
      if (event === 'session-start' && activationPending) continue;
      recordCodexHookProof(event, environment);
    }
  }

  async function finalizeCodex(
    fixture: ReturnType<typeof createMigrationFixture>,
    environment: NodeJS.ProcessEnv = {},
    json = false,
  ) {
    const preview = await runCodexCommand(fixture, ['codex', 'migrate', '--finalize', '--json']);
    const planId = (JSON.parse(preview.stdout) as { data: { plan: { id: string } } }).data.plan.id;
    return runCodexCommand(
      fixture,
      ['codex', 'migrate', '--finalize', '--yes', '--plan', planId, ...(json ? ['--json'] : [])],
      environment,
    );
  }

  async function recoverCodex(fixture: ReturnType<typeof createMigrationFixture>, json = false) {
    const preview = await runCodexCommand(fixture, ['codex', 'recover', '--json']);
    const planId = (JSON.parse(preview.stdout) as { data: { plan: { id: string } } }).data.plan.id;
    return runCodexCommand(fixture, [
      'codex',
      'recover',
      '--yes',
      '--plan',
      planId,
      ...(json ? ['--json'] : []),
    ]);
  }

  function readBackedUpFile(
    fixture: ReturnType<typeof createMigrationFixture>,
    relativePath: string,
  ): string {
    const backupDirectory = nodePath.join(fixture.directory, '.safeword/codex-migration-backup');
    const manifest = JSON.parse(
      readFileSync(nodePath.join(backupDirectory, 'manifest.json'), 'utf8'),
    ) as {
      entries: { path: string; before: { payload?: string } }[];
    };
    const payload = manifest.entries.find(entry => entry.path === relativePath)?.before.payload;
    if (payload === undefined) throw new Error(`No backup payload for ${relativePath}`);
    return readFileSync(nodePath.join(backupDirectory, payload), 'utf8');
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const directory of directories) removeTemporaryDirectory(directory);
    directories.length = 0;
  });

  it('leaves legacy hooks untouched and explains the reviewed-plugin handoff', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    const { directory, configPath, logPath: log } = fixture;

    const result = await runMigration(fixture);

    expect(result.exitCode, result.stderr).toBe(2);
    expect(readFileSync(configPath, 'utf8')).toBe(LEGACY_HOOK_CONFIG);
    expect(`${result.stdout}\n${result.stderr}`).toContain('/hooks');
    expect(`${result.stdout}\n${result.stderr}`).toContain('codex migrate');
    expect(existsSync(nodePath.join(directory, '.codex/config.toml.safeword.bak'))).toBe(false);
    const calls = readFileSync(log, 'utf8');
    expect(calls).toContain('plugin list --json');
    expect(calls).not.toContain('plugin marketplace add');
    expect(calls).not.toContain('plugin add safeword@safeword');
  });

  it('automatically installs the plugin without finalizing recognized legacy state', () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG, {
      pluginInitiallyInstalled: false,
    });
    const legacySkill = nodePath.join(fixture.directory, '.agents/skills/audit/SKILL.md');
    mkdirSync(nodePath.dirname(legacySkill), { recursive: true });
    writeFileSync(legacySkill, 'legacy audit skill\n');
    const environment = stubAutomaticMigrationEnvironment(fixture);

    expect(automaticallyMigrateLegacyCodex(fixture.directory, environment)).toBe(true);

    // Automatic migration installs the plugin but leaves legacy protection in
    // place: removing it is an explicit `--finalize` decision, so an unattended
    // setup must never drop the hooks that are currently protecting the repo.
    expect(readFileSync(fixture.configPath, 'utf8')).toBe(LEGACY_HOOK_CONFIG);
    expect(readFileSync(legacySkill, 'utf8')).toBe('legacy audit skill\n');
    const calls = readFileSync(fixture.logPath, 'utf8');
    expect(calls).toContain('plugin marketplace add');
    expect(calls).toContain('plugin add safeword@safeword');
    expect(existsSync(nodePath.join(fixture.directory, '.safeword/codex-plugin.json'))).toBe(false);
    expect(
      existsSync(
        nodePath.join(fixture.directory, '.safeword/codex-migration-backup/manifest.json'),
      ),
    ).toBe(false);
  });

  // The declining handoff is covered by the acceptance lane's TB1.R4 rule. This
  // pins the succeeding path through plugin installation and proof-backed
  // finalization, where files actually move and get rewritten.
  it('preserves user-owned project data and authored skills through a successful handoff', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG, {
      pluginInitiallyInstalled: false,
    });
    const userOwnedFiles = {
      '.project/tickets/ABC123/spec.md': '# Authored spec\n\nOwned by the user, not Safeword.\n',
      '.project/learnings/handoff-notes.md': '# Handoff notes\n\nDo not clobber authored notes.\n',
      '.agents/skills/company-workflow/SKILL.md': 'User-authored company workflow skill\n',
    };
    for (const [relativePath, contents] of Object.entries(userOwnedFiles)) {
      const absolutePath = nodePath.join(fixture.directory, relativePath);
      mkdirSync(nodePath.dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, contents);
    }
    // A Safeword-owned skill sharing the directory the authored one lives in:
    // removing it is what proves the migration reached and rewrote this tree,
    // so the survival assertions below are not just describing an inert repo.
    const safewordSkill = nodePath.join(fixture.directory, '.agents/skills/audit/SKILL.md');
    mkdirSync(nodePath.dirname(safewordSkill), { recursive: true });
    writeFileSync(safewordSkill, 'legacy audit skill\n');
    const environment = stubAutomaticMigrationEnvironment(fixture);

    expect(automaticallyMigrateLegacyCodex(fixture.directory, environment)).toBe(true);
    expect(existsSync(safewordSkill)).toBe(true);
    expect(existsSync(nodePath.join(fixture.directory, '.safeword/codex-plugin.json'))).toBe(false);

    recordCurrentProof(fixture);
    const finalization = await finalizeCodex(fixture);

    expect(finalization.exitCode, finalization.stderr).toBe(0);
    expect(readFileSync(fixture.logPath, 'utf8')).toContain('plugin add safeword@safeword --json');
    expect(existsSync(safewordSkill)).toBe(false);
    expect(existsSync(nodePath.join(fixture.directory, '.safeword/codex-plugin.json'))).toBe(true);
    for (const [relativePath, contents] of Object.entries(userOwnedFiles)) {
      expect(
        readFileSync(nodePath.join(fixture.directory, relativePath), 'utf8'),
        relativePath,
      ).toBe(contents);
    }
  });

  it('retains complete legacy state when automatic plugin installation fails', () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG, {
      pluginInitiallyInstalled: false,
    });
    const environment = stubAutomaticMigrationEnvironment(fixture);
    vi.stubEnv('SAFEWORD_FAIL_PLUGIN_INSTALL', '1');

    expect(() => automaticallyMigrateLegacyCodex(fixture.directory, environment)).toThrow(
      'marketplace unavailable',
    );

    expect(readFileSync(fixture.configPath, 'utf8')).toBe(LEGACY_HOOK_CONFIG);
    expect(existsSync(nodePath.join(fixture.directory, '.safeword/codex-plugin.json'))).toBe(false);
    expect(existsSync(nodePath.join(fixture.directory, '.safeword/codex-migration-backup'))).toBe(
      false,
    );
  });

  it('removes legacy hooks only after the explicit handoff cleanup request', async () => {
    const original = `${LEGACY_HOOK_CONFIG}${LEGACY_PROMPT_CONTEXT_CONFIG}${USER_CODEX_CONFIG}`;
    const fixture = createMigrationFixture(original);
    const { directory, configPath } = fixture;
    const legacyHooksDirectory = nodePath.join(directory, '.safeword/hooks/codex');
    const legacyRuntimeHookPath = nodePath.join(legacyHooksDirectory, 'pre-tool-quality.ts');
    const sharedRuntimeHookPaths = [
      nodePath.join(directory, '.safeword/hooks/session-safeword-context.ts'),
      nodePath.join(directory, '.safeword/hooks/prompt-timestamp.ts'),
      nodePath.join(directory, '.safeword/hooks/prompt-retro-nudge.ts'),
    ];
    const userHookPath = nodePath.join(legacyHooksDirectory, 'custom.ts');
    mkdirSync(legacyHooksDirectory, { recursive: true });
    writeFileSync(legacyRuntimeHookPath, '// legacy Safeword hook\n');
    writeFileSync(userHookPath, '// user hook\n');
    for (const path of sharedRuntimeHookPaths) {
      mkdirSync(nodePath.dirname(path), { recursive: true });
      writeFileSync(path, '// shared Safeword hook\n');
    }

    const result = await runMigration(fixture, { cleanupLegacyHooks: true });

    expect(result.exitCode, result.stderr).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'Backed up the complete legacy Codex state',
    );
    const migrated = readFileSync(configPath, 'utf8');
    expect(migrated).not.toContain('safeword hook codex pre-tool-use');
    expect(migrated).not.toContain('[[hooks.PreToolUse]]');
    expect(migrated).not.toContain('prompt-timestamp.ts');
    expect(migrated).not.toContain('prompt-retro-nudge.ts');
    expect(migrated).toContain(USER_CODEX_CONFIG.trim());
    expect(readBackedUpFile(fixture, '.codex/config.toml')).toBe(original);
    expect(existsSync(legacyRuntimeHookPath)).toBe(false);
    for (const path of sharedRuntimeHookPaths) {
      expect(readFileSync(path, 'utf8')).toBe('// shared Safeword hook\n');
    }
    expect(existsSync(userHookPath)).toBe(true);
  });

  it('removes legacy hooks after review without reinstalling the profile plugin', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    const { configPath } = fixture;

    const result = await runMigration(fixture, { cleanupLegacyHooks: true });

    expect(result.exitCode, result.stderr).toBe(0);
    expect(readFileSync(configPath, 'utf8')).not.toContain('safeword hook codex pre-tool-use');
    const calls = readFileSync(fixture.logPath, 'utf8');
    expect(calls).toContain('plugin list --json');
    expect(calls).not.toContain('plugin marketplace add');
    expect(calls).not.toContain('plugin add safeword@safeword --json');
  });

  it('refuses cleanup when config changes during finalization preflight', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    const { configPath } = fixture;

    const result = await runMigration(fixture, {
      cleanupLegacyHooks: true,
      environment: {
        SAFEWORD_CONFIG_PATH: configPath,
        SAFEWORD_MUTATE_CONFIG: '1',
      },
    });

    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('finalization plan changed');
    expect(readFileSync(configPath, 'utf8')).toContain('# concurrent config update');
    expect(existsSync(`${configPath}.safeword.bak`)).toBe(false);
  });

  it('removes only the Safeword handler during explicit handoff cleanup', async () => {
    const original = `${LEGACY_HOOK_CONFIG}${CUSTOM_PRE_TOOL_HOOK}${USER_CODEX_CONFIG}`;
    const fixture = createMigrationFixture(original);
    const { configPath } = fixture;

    const result = await runMigration(fixture, { cleanupLegacyHooks: true });

    expect(result.exitCode, result.stderr).toBe(0);
    const migrated = readFileSync(configPath, 'utf8');
    expect(migrated).not.toContain('safeword hook codex pre-tool-use');
    expect(migrated).toContain('[[hooks.PreToolUse]]');
    expect(migrated).toContain(CUSTOM_PRE_TOOL_HOOK.trim());
    expect(migrated).toContain(USER_CODEX_CONFIG.trim());
    expect(readBackedUpFile(fixture, '.codex/config.toml')).toBe(original);
  });

  it('preserves lookalike user hook commands during explicit handoff cleanup', async () => {
    const original = `[[hooks.PreToolUse]]
matcher = "^(apply_patch)$"

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'npx --yes safeword hook codex pre-tool-use'

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'safeword-tools hook codex pre-tool-use'

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'npx --yes safeword@evil hook codex pre-tool-use'

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'bunx --bun safeword@1.2.3 hook codex pre-tool-use'

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'safeword hook codex pre-tool-use'
`;
    const fixture = createMigrationFixture(original);
    const { configPath } = fixture;

    const result = await runMigration(fixture, { cleanupLegacyHooks: true });

    expect(result.exitCode, result.stderr).toBe(0);
    const migrated = readFileSync(configPath, 'utf8');
    expect(migrated).not.toContain("command = 'npx --yes safeword hook codex pre-tool-use'");
    expect(migrated).toContain("command = 'safeword-tools hook codex pre-tool-use'");
    expect(migrated).toContain("command = 'npx --yes safeword@evil hook codex pre-tool-use'");
    expect(migrated).toContain("command = 'bunx --bun safeword@1.2.3 hook codex pre-tool-use'");
    expect(migrated).toContain("command = 'safeword hook codex pre-tool-use'");
    expect(readBackedUpFile(fixture, '.codex/config.toml')).toBe(original);
  });

  it('preserves user scripts beside an exact historical Safeword hook', async () => {
    const original = `[[hooks.PreToolUse]]
matcher = "^(apply_patch)$"

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/codex/pre-tool-quality.ts"'

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/codex/custom.ts"'
`;
    const fixture = createMigrationFixture(original);
    const { configPath } = fixture;

    const result = await runMigration(fixture, { cleanupLegacyHooks: true });

    expect(result.exitCode, result.stderr).toBe(0);
    const migrated = readFileSync(configPath, 'utf8');
    expect(migrated).not.toContain('codex/pre-tool-quality.ts');
    expect(migrated).toContain('codex/custom.ts');
    expect(readBackedUpFile(fixture, '.codex/config.toml')).toBe(original);
  });

  it('preserves an inert parent scaffold with custom metadata after removing its owned child', async () => {
    const original = `[[hooks.PreToolUse]]
matcher = "^(apply_patch)$"
owner = "user-defined"

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'npx --yes safeword hook codex pre-tool-use'
`;
    const fixture = createMigrationFixture(original);

    const result = await runMigration(fixture, { cleanupLegacyHooks: true });

    expect(result.exitCode, result.stderr).toBe(0);
    const migrated = readFileSync(fixture.configPath, 'utf8');
    expect(migrated).toContain('[[hooks.PreToolUse]]');
    expect(migrated).toContain('owner = "user-defined"');
    expect(migrated).not.toContain('safeword hook codex pre-tool-use');
    expect(migrated).not.toContain('[[hooks.PreToolUse.hooks]]');
  });

  it('ends a hook section before an unrelated table whose name ends in hooks', async () => {
    const original = `${LEGACY_HOOK_CONFIG}
[[custom.hooks]]
command = 'echo "keep this custom table"'
`;
    const fixture = createMigrationFixture(original);

    const result = await runMigration(fixture, { cleanupLegacyHooks: true });

    expect(result.exitCode, result.stderr).toBe(0);
    const migrated = readFileSync(fixture.configPath, 'utf8');
    expect(migrated).not.toContain('safeword hook codex pre-tool-use');
    expect(migrated).toContain('[[custom.hooks]]');
    expect(migrated).toContain('keep this custom table');
  });

  it.each([
    {
      label: 'whitespace',
      parent: '[[ hooks.PreToolUse ]]',
      nested: '[[ hooks.PreToolUse.hooks ]]',
    },
    {
      label: 'quoted event keys',
      parent: '[[hooks."PreToolUse"]]',
      nested: '[[hooks."PreToolUse".hooks]]',
    },
  ])('removes legacy hooks written with $label', async ({ parent, nested }) => {
    const original = `${parent}
matcher = "^(apply_patch)$"

${nested}
type = "command"
command = 'npx --yes safeword hook codex pre-tool-use'
`;
    const fixture = createMigrationFixture(original);

    const result = await runMigration(fixture, { cleanupLegacyHooks: true });

    expect(result.exitCode, result.stderr).toBe(0);
    expect(readFileSync(fixture.configPath, 'utf8')).not.toContain(
      'safeword hook codex pre-tool-use',
    );
  });

  it('fails closed when semantic legacy hooks cannot be mapped to source ranges', async () => {
    const original = `[[hooks.PreToolUse]]
matcher = "^(apply_patch)$"

[[hooks.PreToolUse.hooks]]
type = "command"
command = """npx --yes safeword hook codex pre-tool-use"""
`;
    const fixture = createMigrationFixture(original);

    const result = await runMigration(fixture, { cleanupLegacyHooks: true });

    expect(result.exitCode).not.toBe(0);
    expect(readFileSync(fixture.configPath, 'utf8')).toBe(original);
    expect(`${result.stdout}\n${result.stderr}`).toContain('unsupported Safeword hook formatting');
  });

  it('refuses explicit cleanup when the Codex configuration is malformed', async () => {
    const original = `${LEGACY_HOOK_CONFIG}\n[broken\n`;
    const fixture = createMigrationFixture(original);
    const { directory, configPath, logPath: codexLogPath } = fixture;
    const legacyRuntimeHookPath = nodePath.join(
      directory,
      '.safeword/hooks/codex/pre-tool-quality.ts',
    );
    mkdirSync(nodePath.dirname(legacyRuntimeHookPath), { recursive: true });
    writeFileSync(legacyRuntimeHookPath, '// legacy Safeword hook\n');

    const result = await runMigration(fixture, { cleanupLegacyHooks: true });

    expect(result.exitCode).not.toBe(0);
    expect(readFileSync(configPath, 'utf8')).toBe(original);
    expect(existsSync(nodePath.join(directory, '.codex/config.toml.safeword.bak'))).toBe(false);
    expect(existsSync(legacyRuntimeHookPath)).toBe(true);
    expect(existsSync(codexLogPath)).toBe(false);
  });

  it('refuses cleanup before profile mutation when the Codex configuration is a symbolic link', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    const { directory, configPath, logPath: codexLogPath } = fixture;
    const targetPath = nodePath.join(directory, 'dotfiles-config.toml');
    writeFileSync(targetPath, LEGACY_HOOK_CONFIG);
    rmSync(configPath);
    symlinkSync('dotfiles-config.toml', configPath);

    const result = await runMigration(fixture, { cleanupLegacyHooks: true });

    expect(result.exitCode).not.toBe(0);
    expect(readFileSync(targetPath, 'utf8')).toBe(LEGACY_HOOK_CONFIG);
    expect(lstatSync(configPath).isSymbolicLink()).toBe(true);
    expect(existsSync(`${configPath}.safeword.bak`)).toBe(false);
    expect(existsSync(codexLogPath)).toBe(false);
  });

  it('does not treat a Safeword marker in a comment as an owned handler', async () => {
    const original = `[[hooks.PreToolUse]]
matcher = "^custom$"

[[hooks.PreToolUse.hooks]]
# former command: bunx --bun safeword@0.68.0 hook codex pre-tool-use
type = "command"
command = 'echo "keep this user hook"'
`;
    const fixture = createMigrationFixture(original);
    const { directory, configPath } = fixture;

    const result = await runMigration(fixture, { cleanupLegacyHooks: true });

    expect(result.exitCode, result.stderr).toBe(0);
    const finalized = readFileSync(configPath, 'utf8');
    expect(finalized).toContain(original.trim());
    expect(finalized).toContain('bunx --bun safeword@latest codex bootstrap');
    expect(existsSync(nodePath.join(directory, '.codex/config.toml.safeword.bak'))).toBe(false);
  });

  it('refuses cleanup instead of replacing an existing migration backup', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    const backupPath = nodePath.join(fixture.directory, '.safeword/codex-migration-backup');
    mkdirSync(backupPath, { recursive: true });
    writeFileSync(nodePath.join(backupPath, 'keep.txt'), 'existing backup\n');

    const result = await runMigration(fixture, { cleanupLegacyHooks: true });

    expect(result.exitCode).not.toBe(0);
    expect(readFileSync(fixture.configPath, 'utf8')).toBe(LEGACY_HOOK_CONFIG);
    expect(readFileSync(nodePath.join(backupPath, 'keep.txt'), 'utf8')).toBe('existing backup\n');
  });

  it('re-enables a disabled profile plugin while retaining legacy hooks', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG, { pluginEnabled: false });
    const { configPath } = fixture;
    const before = readFileSync(configPath, 'utf8');

    const result = await runMigration(fixture);

    expect(result.exitCode).toBe(2);
    const status = await runCodexCommand(fixture, ['codex', 'status', '--json']);
    expect(JSON.parse(status.stdout)).toMatchObject({
      data: {
        migration_state: 'plugin_installed_restart_required',
        migration: {
          schema_version: '2',
          state: 'plugin_installed_app_restart_required',
        },
      },
    });
    expect(readFileSync(configPath, 'utf8')).toBe(before);
    expect(existsSync(configPath)).toBe(true);
  });

  it('updates an enabled older profile plugin while retaining legacy hooks', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG, { pluginVersion: '0.68.0' });
    const before = readFileSync(fixture.configPath, 'utf8');

    const result = await runCodexCommand(fixture, ['codex', 'install', '--json']);

    expect(result.exitCode, result.stdout).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      changed: true,
      data: {
        migration_state: 'plugin_installed_restart_required',
        migration: {
          schema_version: '2',
          state: 'plugin_installed_app_restart_required',
        },
        plugin: { version: SAFEWORD_SCHEMA.version },
      },
      effects: {
        configuration: [{ kind: 'update', target: 'Safeword Codex profile plugin' }],
      },
    });
    expect(readFileSync(fixture.configPath, 'utf8')).toBe(before);
    const calls = readFileSync(fixture.logPath, 'utf8');
    expect(calls).toContain('plugin marketplace list --json');
    expect(calls).toContain('plugin marketplace upgrade safeword --json');
    expect(calls).toContain('plugin add safeword@safeword --json');
    expect(calls.indexOf('plugin marketplace upgrade')).toBeLessThan(
      calls.indexOf('plugin add safeword@safeword'),
    );
  });

  it('does not install from stale metadata when marketplace refresh fails', async () => {
    const fixture = createMigrationFixture('', { pluginVersion: '0.68.0' });

    const result = await runCodexCommand(fixture, ['codex', 'install', '--json'], {
      SAFEWORD_FAIL_MARKETPLACE_UPGRADE: '1',
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      errors: [
        {
          code: 'PLUGIN_MARKETPLACE_FAILED',
          message: expect.stringContaining('marketplace refresh failed'),
        },
      ],
    });
    const calls = readFileSync(fixture.logPath, 'utf8');
    expect(calls).toContain('plugin marketplace upgrade safeword --json');
    expect(calls).not.toContain('plugin add safeword@safeword --json');
  });

  it('leaves the profile unchanged when another task is installing the plugin', async () => {
    const fixture = createMigrationFixture('', { pluginInitiallyInstalled: false });
    const profileEnvironment = { CODEX_HOME: fixture.codexHome };
    expect(
      acquireCodexProfileLock(profileEnvironment, { owner: 'another-codex-task' }),
    ).toBeDefined();

    const result = await runCodexCommand(fixture, ['codex', 'install', '--json']);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      changed: false,
      errors: [
        {
          code: 'PLUGIN_PROFILE_BUSY',
          message: expect.stringContaining('Another Safeword task is updating this Codex profile'),
        },
      ],
    });
    const calls = readFileSync(fixture.logPath, 'utf8');
    expect(calls).toContain('plugin list --json');
    expect(calls).not.toContain('plugin marketplace');
    expect(calls).not.toContain('plugin add safeword@safeword --json');
  });

  it('rejects a Git marketplace that reuses the Safeword name for another source', async () => {
    const fixture = createMigrationFixture('', { pluginVersion: '0.68.0' });

    const result = await runCodexCommand(fixture, ['codex', 'install', '--json'], {
      SAFEWORD_MISMATCHED_GIT_MARKETPLACE: '1',
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      errors: [
        {
          code: 'PLUGIN_MARKETPLACE_FAILED',
          message: expect.stringContaining('does not point to ArcadeAI/safeword'),
        },
      ],
    });
    const calls = readFileSync(fixture.logPath, 'utf8');
    expect(calls).not.toContain('plugin marketplace upgrade safeword --json');
    expect(calls).not.toContain('plugin add safeword@safeword --json');
  });

  it('refreshes the official Safeword marketplace when configured with an SSH Git URL', async () => {
    const fixture = createMigrationFixture('', { pluginVersion: '0.68.0' });

    const result = await runCodexCommand(fixture, ['codex', 'install'], {
      SAFEWORD_SSH_GIT_MARKETPLACE: '1',
    });

    expect(result.exitCode).toBe(2);
    const calls = readFileSync(fixture.logPath, 'utf8');
    expect(calls).toContain('plugin marketplace upgrade safeword --json');
    expect(calls).toContain('plugin add safeword@safeword --json');
  });

  it('moves an official main-branch marketplace onto the stable channel before installing', async () => {
    const fixture = createMigrationFixture('', { pluginVersion: '0.68.0' });
    writeFileSync(
      nodePath.join(fixture.directory, 'profile/config.toml'),
      '[marketplaces.safeword]\nsource = "https://github.com/ArcadeAI/safeword.git"\nref = "main"\n',
    );

    const result = await runCodexCommand(fixture, ['codex', 'install']);

    expect(result.exitCode).toBe(2);
    const calls = readFileSync(fixture.logPath, 'utf8');
    expect(calls).toContain('plugin marketplace remove safeword --json');
    expect(calls).toContain('plugin marketplace add ArcadeAI/safeword --ref stable');
    expect(calls).not.toContain('plugin marketplace upgrade safeword --json');
    expect(calls.indexOf('plugin marketplace remove')).toBeLessThan(
      calls.indexOf('plugin marketplace add'),
    );
    expect(calls.indexOf('plugin marketplace add')).toBeLessThan(
      calls.indexOf('plugin add safeword@safeword'),
    );
  });

  it('reports profile mutation and recovery when stable enrollment and restoration both fail', async () => {
    const fixture = createMigrationFixture('', { pluginVersion: '0.68.0' });
    writeFileSync(
      nodePath.join(fixture.directory, 'profile/config.toml'),
      '[marketplaces.safeword]\nsource = "https://github.com/ArcadeAI/safeword.git"\nref = "main"\n',
    );

    const result = await runCodexCommand(fixture, ['codex', 'install', '--json'], {
      SAFEWORD_FAIL_PLUGIN_INSTALL: '1',
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      changed: true,
      effects: {
        configuration: [
          {
            kind: 'remove',
            target: 'Safeword Codex marketplace',
            operation: 'restoration-failed',
          },
        ],
      },
      recovery: [
        {
          command: expect.stringContaining(
            "'codex' 'plugin' 'marketplace' 'add' 'https://github.com/ArcadeAI/safeword.git' '--ref' 'main'",
          ),
        },
      ],
      errors: [
        {
          code: 'PLUGIN_MARKETPLACE_FAILED',
          message: expect.stringContaining('profile no longer has that marketplace'),
        },
      ],
    });
    const calls = readFileSync(fixture.logPath, 'utf8');
    expect(calls.match(/plugin marketplace add/gu)).toHaveLength(2);
    expect(calls).not.toContain('plugin add safeword@safeword --json');
  });

  it('shell-quotes an untrusted marketplace source in double-failure recovery', async () => {
    const fixture = createMigrationFixture('', { pluginVersion: '0.68.0' });
    const sentinel = nodePath.join(fixture.directory, 'should-not-run');
    const hostileSource = `$(touch ${sentinel})'suffix`;
    writeFileSync(
      nodePath.join(fixture.directory, 'profile/config.toml'),
      `[marketplaces.safeword]\nsource = ${JSON.stringify(hostileSource)}\nref = "main"\n`,
    );

    const result = await runCodexCommand(fixture, ['codex', 'install', '--json'], {
      SAFEWORD_FAIL_PLUGIN_INSTALL: '1',
    });
    const recovery = JSON.parse(result.stdout).recovery[0].command as string;

    expect(recovery).toContain(`'$(touch ${sentinel})'"'"'suffix'`);
    const restored = spawnSync('sh', ['-c', recovery], {
      cwd: fixture.directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
        SAFEWORD_CODEX_LOG: fixture.logPath,
        CODEX_HOME: fixture.codexHome,
      },
    });
    expect(restored.status).toBe(0);
    expect(existsSync(sentinel)).toBe(false);
  });

  it.each(['v9.0.0', '9.0.0'])(
    'preserves newer explicit marketplace pin %s without profile mutation',
    async ref => {
      const fixture = createMigrationFixture('', { pluginVersion: '0.68.0' });
      writeFileSync(
        nodePath.join(fixture.directory, 'profile/config.toml'),
        `[marketplaces.safeword]\nsource = "ArcadeAI/safeword"\nref = "${ref}"\n`,
      );

      const result = await runCodexCommand(fixture, ['codex', 'install', '--json']);

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'failed',
        changed: false,
        errors: [{ code: 'PLUGIN_NEWER_PIN_PRESERVED' }],
      });
      const calls = readFileSync(nodePath.join(fixture.directory, 'codex.log'), 'utf8');
      expect(calls).not.toContain('plugin marketplace remove');
      expect(calls).not.toContain('plugin marketplace add');
      expect(calls).not.toContain('plugin add safeword@safeword');
    },
  );
  it.each([
    ['failed', { SAFEWORD_FAIL_MARKETPLACE_LIST: '1' }],
    ['malformed', { SAFEWORD_MALFORMED_MARKETPLACE_LIST: '1' }],
    ['unsupported', { SAFEWORD_UNSUPPORTED_MARKETPLACE_LIST: '1' }],
  ])('fails closed when marketplace discovery is %s', async (_name, environment) => {
    const fixture = createMigrationFixture('', { pluginInitiallyInstalled: false });

    const result = await runCodexCommand(fixture, ['codex', 'install', '--json'], environment);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      errors: [{ code: 'PLUGIN_MARKETPLACE_FAILED' }],
    });
    const calls = readFileSync(fixture.logPath, 'utf8');
    expect(calls).not.toContain('plugin marketplace add');
    expect(calls).not.toContain('plugin add safeword@safeword --json');
  });

  it('fails closed for a configured non-Git marketplace with the same name', async () => {
    const fixture = createMigrationFixture('', { pluginInitiallyInstalled: false });

    const result = await runCodexCommand(fixture, ['codex', 'install', '--json'], {
      SAFEWORD_MARKETPLACE_SOURCE_TYPE: 'local',
    });

    // A same-named non-Git marketplace is someone else's entry. Adding over it
    // would silently repoint their marketplace at Safeword, so this reports the
    // conflict instead of writing through it.
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      changed: false,
      errors: [
        {
          code: 'PLUGIN_MARKETPLACE_FAILED',
          message: expect.stringContaining('not a Git marketplace'),
        },
      ],
    });
    const calls = readFileSync(fixture.logPath, 'utf8');
    expect(calls).not.toContain('plugin marketplace add ArcadeAI/safeword');
    expect(calls).not.toContain('plugin marketplace upgrade safeword --json');
  });

  it('refuses finalization when proof and the installed plugin version differ', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG, { pluginVersion: '0.68.0' });
    recordCurrentProof(fixture);

    const result = await runCodexCommand(fixture, ['codex', 'migrate', '--finalize', '--json']);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      errors: [{ code: 'PLUGIN_UPDATE_REQUIRED' }],
      data: { migration_state: 'plugin_update_required' },
    });
    expect(readFileSync(fixture.configPath, 'utf8')).toBe(LEGACY_HOOK_CONFIG);
  });

  it('uses manifest-bound proof when an older Codex omits installed plugin version metadata', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(fixture);

    const result = await finalizeCodex(fixture, {}, true);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'changed',
      errors: [],
      data: {
        migration_state: 'plugin',
        plugin: { version: null },
      },
    });
    expect(readFileSync(fixture.configPath, 'utf8')).not.toContain('safeword hook codex');
  });

  it('installs and verifies the profile plugin without creating project Codex configuration', async () => {
    const fixture = createMigrationFixture('', { pluginInitiallyInstalled: false });
    const { directory, logPath } = fixture;
    rmSync(nodePath.join(directory, '.codex'), { recursive: true });

    const result = await runCodexCommand(fixture, ['codex', 'install']);

    expect(result.exitCode, result.stderr).toBe(2);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'This Codex app may keep its loaded Safeword catalogue',
    );
    expect(`${result.stdout}\n${result.stderr}`).toContain('Fully restart Codex');
    expect(`${result.stdout}\n${result.stderr}`).toContain('resume this task');
    expect(existsSync(nodePath.join(directory, '.codex'))).toBe(false);
    const calls = readFileSync(logPath, 'utf8');
    expect(calls).toContain(
      'plugin marketplace add ArcadeAI/safeword --ref stable --sparse .agents/plugins --sparse packages/cli/codex-plugin --json',
    );
    expect(calls).toContain('plugin add safeword@safeword --json');
    expect(calls).toContain('plugin list --json');
  });

  it('expands to the profile plugin without removing legacy hooks', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG, {
      pluginInitiallyInstalled: false,
    });
    const { configPath } = fixture;

    const result = await runCodexCommand(fixture, ['codex', 'migrate']);

    expect(result.exitCode, result.stderr).toBe(2);
    expect(`${result.stdout}\n${result.stderr}`).toContain('Fully restart Codex');
    expect(`${result.stdout}\n${result.stderr}`).toContain('resume this task');
    expect(readFileSync(configPath, 'utf8')).toBe(LEGACY_HOOK_CONFIG);
    expect(readFileSync(fixture.logPath, 'utf8')).toContain('plugin marketplace add');
  });

  it('leaves recognized legacy protection unchanged when plugin installation fails', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG, {
      pluginInitiallyInstalled: false,
    });
    const legacySkillPath = nodePath.join(fixture.directory, '.agents/skills/review-spec/SKILL.md');
    mkdirSync(nodePath.dirname(legacySkillPath), { recursive: true });
    writeFileSync(legacySkillPath, '# legacy protection\n');

    const beforeConfig = readFileSync(fixture.configPath, 'utf8');
    const result = await runCodexCommand(fixture, ['codex', 'migrate'], {
      SAFEWORD_FAIL_PLUGIN_INSTALL: '1',
    });

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain('marketplace unavailable');
    expect(readFileSync(fixture.configPath, 'utf8')).toBe(beforeConfig);
    expect(readFileSync(legacySkillPath, 'utf8')).toBe('# legacy protection\n');
    expect(existsSync(nodePath.join(fixture.directory, '.safeword/codex-plugin.json'))).toBe(false);
  });

  it('reports unknown enablement without changing the repository after partial installation', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG, {
      pluginInitiallyInstalled: false,
    });
    const beforeConfig = readFileSync(fixture.configPath, 'utf8');

    const result = await runCodexCommand(fixture, ['codex', 'migrate', '--json'], {
      SAFEWORD_FAIL_PLUGIN_VERIFY: '1',
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      changed: true,
      effects: {
        configuration: [
          {
            kind: 'install',
            target: 'Safeword Codex profile plugin',
            operation: 'enablement-unverified',
          },
        ],
      },
      errors: [{ code: 'PLUGIN_ENABLEMENT_UNKNOWN' }],
    });
    expect(readFileSync(fixture.configPath, 'utf8')).toBe(beforeConfig);
    expect(existsSync(nodePath.join(fixture.directory, '.safeword/codex-plugin.json'))).toBe(false);
  });

  it('reports an enabled plugin without current hook proof as unproven', async () => {
    const fixture = createMigrationFixture('');
    const codexHome = fixture.codexHome;
    mkdirSync(codexHome, { recursive: true });

    const result = await runCodexCommand(fixture, ['codex', 'status'], {
      CODEX_HOME: codexHome,
    });

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain('plugin_enabled_hook_unproven');
    expect(result.stdout).toContain('restarted Codex app');
    expect(result.stdout.match(/^Next:/gm)).toHaveLength(1);
  });

  it('writes only the versioned result to stdout for actionable JSON status', async () => {
    const fixture = createMigrationFixture('');

    const result = await runCodexCommand(fixture, ['codex', 'status', '--json']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe(`${JSON.stringify(JSON.parse(result.stdout))}\n`);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schema_version: 1,
      state: 'action_required',
      next_actions: [
        {
          kind: 'human',
          instruction:
            'Review the installed hooks in Codex Desktop under Settings > Hooks (or with /hooks in the terminal TUI). Fully restart Codex, then resume this task.',
          mutates: false,
          requires_human: true,
        },
      ],
      data: { migration_state: 'plugin_enabled_hook_unproven' },
    });
  });

  it('returns a stable schema-1 error when profile status cannot be observed', async () => {
    const fixture = createMigrationFixture('');

    const result = await runCodexCommand(fixture, ['codex', 'status', '--json'], {
      SAFEWORD_FAIL_PLUGIN_VERIFY: '1',
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe(`${JSON.stringify(JSON.parse(result.stdout))}\n`);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schema_version: 1,
      ok: false,
      data: {
        plugin: { installed: false, enabled: null, version: null, observation: 'unknown' },
      },
      errors: [
        {
          code: 'PLUGIN_OBSERVATION_FAILED',
          message: 'profile observation failed',
          retryable: true,
        },
      ],
    });
  });

  it.each([
    { label: 'live', target: 'dotfiles-config.toml' },
    { label: 'dangling', target: 'missing-config.toml' },
  ])(
    'returns a stable config observation error for a $label config symlink',
    async ({ target }) => {
      const fixture = createMigrationFixture('');
      if (target === 'dotfiles-config.toml') {
        writeFileSync(
          nodePath.join(nodePath.dirname(fixture.configPath), target),
          LEGACY_HOOK_CONFIG,
        );
      }
      rmSync(fixture.configPath);
      symlinkSync(target, fixture.configPath);

      const result = await runCodexCommand(fixture, ['codex', 'status', '--json']);

      expect(result).toMatchObject({ exitCode: 1, stderr: '' });
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'failed',
        changed: false,
        errors: [
          {
            code: 'CODEX_CONFIG_UNREADABLE',
            message: 'Codex configuration is a symbolic link and cannot be observed safely.',
            retryable: false,
          },
        ],
      });
      expect(result.stdout).not.toContain(fixture.directory);
    },
  );

  it.each([
    { label: 'live', target: 'external-codex' },
    { label: 'dangling', target: 'missing-codex' },
  ])(
    'returns a stable config observation error for a $label config-directory symlink',
    async ({ target }) => {
      const fixture = createMigrationFixture('');
      const codexDirectory = nodePath.dirname(fixture.configPath);
      const targetDirectory = nodePath.join(fixture.directory, target);
      rmSync(codexDirectory, { recursive: true });
      if (target === 'external-codex') {
        mkdirSync(targetDirectory);
        writeFileSync(nodePath.join(targetDirectory, 'config.toml'), LEGACY_HOOK_CONFIG);
      }
      symlinkSync(target, codexDirectory);

      const result = await runCodexCommand(fixture, ['codex', 'status', '--json']);

      expect(result).toMatchObject({ exitCode: 1, stderr: '' });
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'failed',
        changed: false,
        errors: [
          {
            code: 'CODEX_CONFIG_UNREADABLE',
            message:
              'Codex configuration directory is a symbolic link and cannot be observed safely.',
            retryable: false,
          },
        ],
      });
      expect(result.stdout).not.toContain(fixture.directory);
    },
  );

  it('reports only runnable legacy events as protection for an unproven plugin', async () => {
    const scriptConfig = `[[hooks.PreToolUse]]
matcher = "^(apply_patch)$"

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/codex/pre-tool-quality.ts"'
`;
    const fixture = createMigrationFixture(scriptConfig);
    const runtimePath = nodePath.join(
      fixture.directory,
      '.safeword/hooks/codex/pre-tool-quality.ts',
    );
    mkdirSync(nodePath.dirname(runtimePath), { recursive: true });
    writeFileSync(runtimePath, '// runnable legacy hook\n');

    const protectedResult = await runCodexCommand(fixture, ['codex', 'status', '--json']);
    rmSync(runtimePath);
    const unprotectedResult = await runCodexCommand(fixture, ['codex', 'status', '--json']);

    expect(protectedResult.exitCode).toBe(2);
    expect(JSON.parse(protectedResult.stdout)).toMatchObject({
      state: 'action_required',
      data: {
        migration_state: 'plugin_enabled_hook_unproven',
        protected: 'protected',
        legacy: { viable_events: ['PreToolUse'] },
      },
    });
    expect(unprotectedResult.exitCode).toBe(2);
    expect(JSON.parse(unprotectedResult.stdout)).toMatchObject({
      state: 'action_required',
      data: {
        migration_state: 'plugin_enabled_hook_unproven',
        protected: 'unprotected',
        legacy: { viable_events: [] },
      },
    });
  });

  it('reports edited legacy global guidance from Codex status and doctor without mutation', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    const agentsPath = nodePath.join(fixture.directory, 'profile/AGENTS.md');
    mkdirSync(nodePath.dirname(agentsPath), { recursive: true });
    const editedLegacy = [
      '# Global Instructions for AI Coding Agents',
      '## Feature Development Workflow (CRITICAL - Always Follow)',
      'Search planning/user-stories/ before coding.',
      'Read ~/.agents/coding/guides/testing-methodology.md.',
      'My local addition.',
    ].join('\n');
    writeFileSync(agentsPath, editedLegacy);

    const codexStatus = await runCodexCommand(fixture, ['codex', 'status', '--json']);
    const doctor = await runCodexCommand(fixture, ['doctor', '--json']);

    for (const result of [codexStatus, doctor]) {
      expect(result.exitCode).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'action_required',
        findings: expect.arrayContaining([
          expect.objectContaining({
            code: 'CODEX_LEGACY_GLOBAL_GUIDANCE_SUSPECTED',
            metadata: {
              classification: 'suspected_legacy',
              disposition: 'manual_review',
            },
          }),
        ]),
        data: {
          global_guidance: { state: 'suspected_legacy', path: agentsPath },
        },
      });
    }
    expect(readFileSync(agentsPath, 'utf8')).toBe(editedLegacy);
  });

  it('records restart-required state after successful profile installation', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG, {
      pluginInitiallyInstalled: false,
    });
    const codexHome = fixture.codexHome;

    const result = await runCodexCommand(fixture, ['codex', 'migrate'], {
      CODEX_HOME: codexHome,
    });

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain('Fully restart Codex');
    expect(result.stdout).toContain('resume this task');
    const status = await runCodexCommand(fixture, ['codex', 'status', '--json']);
    expect(JSON.parse(status.stdout)).toMatchObject({
      data: {
        migration_state: 'plugin_installed_restart_required',
        migration: {
          schema_version: '2',
          state: 'plugin_installed_app_restart_required',
        },
      },
    });
    expect(readFileSync(fixture.configPath, 'utf8')).toBe(LEGACY_HOOK_CONFIG);
    const marker = JSON.parse(
      readFileSync(nodePath.join(codexHome, 'safeword/activation-pending-v2.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(marker.schema_version).toBe(2);
    expect(marker.plugin_version).toMatch(/^\d+\.\d+\.\d+/u);
    expect(marker.manifest_sha256).toMatch(/^[\da-f]{64}$/u);
    expect(marker.activation_id).toEqual(expect.any(String));
    expect(marker.installed_at).toEqual(expect.any(String));
    // Developer machines may have a live app-server while CI does not. The
    // contract is the coherent pair: observed means at least one concrete
    // host; unavailable means no host identities were trusted.
    expect(['observed', 'unavailable']).toContain(marker.host_observation);
    expect(marker.active_hosts).toEqual(expect.any(Array));
    if (marker.host_observation === 'observed') {
      expect(marker.active_hosts).not.toHaveLength(0);
    } else {
      expect(marker.active_hosts).toHaveLength(0);
    }
  });

  it('reports a structured profile mutation when installed plugin verification mismatches', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG, {
      pluginInitiallyInstalled: false,
    });

    const result = await runCodexCommand(fixture, ['codex', 'migrate', '--json'], {
      SAFEWORD_FAKE_INSTALLED_PLUGIN_VERSION: '0.0.0',
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      changed: true,
      errors: [
        {
          code: 'PLUGIN_ENABLEMENT_FAILED',
          message: expect.stringContaining('0.0.0'),
          retryable: true,
        },
      ],
    });
  });

  it('refuses finalization without current plugin-hook proof', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    const before = readFileSync(fixture.configPath, 'utf8');

    const result = await runCodexCommand(fixture, ['codex', 'migrate', '--finalize', '--yes']);

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain('current plugin hook proof');
    expect(readFileSync(fixture.configPath, 'utf8')).toBe(before);
    expect(existsSync(nodePath.join(fixture.directory, '.safeword/codex-plugin.json'))).toBe(false);
    expect(existsSync(nodePath.join(fixture.directory, '.safeword/codex-migration-backup'))).toBe(
      false,
    );

    const jsonResult = await runCodexCommand(fixture, [
      'codex',
      'migrate',
      '--finalize',
      '--yes',
      '--json',
    ]);
    expect(jsonResult.exitCode).toBe(1);
    expect(jsonResult.stderr).toBe('');
    expect(JSON.parse(jsonResult.stdout)).toMatchObject({
      errors: [{ code: 'FINALIZATION_PROOF_REQUIRED' }],
    });
  });

  it('refuses finalization before prompting or checking the profile when recovery is required', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(fixture);
    const backupDirectory = nodePath.join(fixture.directory, '.safeword/codex-migration-backup');
    mkdirSync(backupDirectory, { recursive: true });
    writeFileSync(nodePath.join(backupDirectory, 'keep.txt'), 'unresolved recovery evidence\n');
    const before = readFileSync(fixture.configPath, 'utf8');
    const confirm = vi.fn(() => Promise.resolve(true));
    const priorExitCode = process.exitCode;
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      await expect(
        removeLegacyCodexHooks(fixture.directory, {
          environment: { CODEX_HOME: fixture.codexHome },
          confirm,
        }),
      ).resolves.toBe(false);
    } finally {
      process.exitCode = priorExitCode;
      stdout.mockRestore();
    }

    expect(confirm).not.toHaveBeenCalled();
    expect(readFileSync(fixture.configPath, 'utf8')).toBe(before);
    expect(existsSync(fixture.logPath)).toBe(false);

    const result = await runCodexCommand(fixture, [
      'codex',
      'migrate',
      '--finalize',
      '--yes',
      '--json',
    ]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      changed: false,
      data: { migration_state: 'recovery_required' },
      next_actions: [{ command: 'safeword codex recover' }],
    });
    expect(readFileSync(fixture.configPath, 'utf8')).toBe(before);
    expect(existsSync(fixture.logPath)).toBe(false);
  });

  it('passes exact config blocks and paths from the real planner to confirmation', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(fixture);
    let displayedPlan = '';

    await removeLegacyCodexHooks(fixture.directory, {
      environment: { CODEX_HOME: fixture.codexHome },
      confirm: plan => {
        displayedPlan = plan;
        return Promise.resolve(false);
      },
    });

    expect(displayedPlan).toContain('- update .codex/config.toml');
    expect(displayedPlan).toContain(
      LEGACY_HOOK_CONFIG.slice(LEGACY_HOOK_CONFIG.indexOf('[[hooks.PreToolUse]]')).trim(),
    );
    expect(displayedPlan).toContain('- create .safeword/codex-plugin.json');
    expect(displayedPlan).toContain('- create .agents/skills/safeword-plugin-setup/SKILL.md');
  });

  it('rejects repository drift after confirmation instead of expanding the plan', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(fixture);
    const lateAsset = nodePath.join(fixture.directory, '.agents/skills/bdd/SKILL.md');
    mkdirSync(nodePath.dirname(lateAsset), { recursive: true });
    writeFileSync(lateAsset, '# content shown in the confirmed plan\n');

    const result = await finalizeCodex(fixture, { SAFEWORD_LEGACY_ASSET_PATH: lateAsset }, true);

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      changed: false,
      findings: [{ code: 'PLAN_STALE' }],
    });
    expect(existsSync(lateAsset)).toBe(true);
    expect(readFileSync(lateAsset, 'utf8')).toBe('# appeared after confirmation\n');
    expect(existsSync(nodePath.join(fixture.directory, '.safeword/codex-plugin.json'))).toBe(false);
  });

  it('keeps JSON failure reporting valid when project observation also fails', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(fixture);
    rmSync(fixture.configPath);
    mkdirSync(fixture.configPath);

    const result = await runCodexCommand(fixture, [
      'codex',
      'migrate',
      '--finalize',
      '--yes',
      '--json',
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      schema_version: 1,
      changed: false,
      errors: [{ code: 'UNSAFE_MIGRATION_PATH' }],
    });
  });

  it.each([
    ['neither flag', []],
    ['finalize only', ['--finalize']],
    ['yes only', ['--yes']],
  ])('does not finalize non-interactively with %s', async (_name, flags) => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(fixture);
    const before = readFileSync(fixture.configPath, 'utf8');

    await runCodexCommand(fixture, ['codex', 'migrate', ...flags]);

    expect(readFileSync(fixture.configPath, 'utf8')).toBe(before);
    expect(existsSync(nodePath.join(fixture.directory, '.safeword/codex-plugin.json'))).toBe(false);
    expect(existsSync(nodePath.join(fixture.directory, '.safeword/codex-migration-backup'))).toBe(
      false,
    );
  });

  it('creates a recoverable plugin-only project after confirmed finalization', async () => {
    const fixture = createMigrationFixture(`${LEGACY_HOOK_CONFIG}${CUSTOM_PRE_TOOL_HOOK}`);
    recordCurrentProof(fixture);
    const legacySkillPath = nodePath.join(fixture.directory, '.agents/skills/review-spec/SKILL.md');
    mkdirSync(nodePath.dirname(legacySkillPath), { recursive: true });
    writeFileSync(legacySkillPath, '# legacy skill\n');

    const result = await finalizeCodex(fixture);

    expect(result.exitCode, result.stderr).toBe(0);
    const migrated = readFileSync(fixture.configPath, 'utf8');
    expect(migrated).not.toContain('safeword hook codex pre-tool-use');
    expect(migrated).toContain(CUSTOM_PRE_TOOL_HOOK.trim());
    expect(existsSync(legacySkillPath)).toBe(false);
    const markerPath = nodePath.join(fixture.directory, '.safeword/codex-plugin.json');
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
    expect(marker).toMatchObject({
      schema_version: 1,
      mode: 'plugin',
      transaction_id: expect.any(String),
      plan_sha256: expect.stringMatching(/^[\da-f]{64}$/u),
    });
    expect(
      readFileSync(
        nodePath.join(fixture.directory, '.agents/skills/safeword-plugin-setup/SKILL.md'),
        'utf8',
      ),
    ).toContain('safeword codex migrate');
    const manifestPath = nodePath.join(
      fixture.directory,
      '.safeword/codex-migration-backup/manifest.json',
    );
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest).toMatchObject({ schema_version: 1, status: 'finalized' });
  });

  it('leaves new teammates a setup-only Codex plugin bootstrap', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(fixture);
    const finalized = await finalizeCodex(fixture);
    expect(finalized.exitCode, finalized.stderr).toBe(0);

    const bootstrap = readFileSync(
      nodePath.join(fixture.directory, '.agents/skills/safeword-plugin-setup/SKILL.md'),
      'utf8',
    );
    expect(bootstrap).toContain('safeword codex migrate');
    expect(bootstrap).toContain('Fully restart Codex');
    expect(bootstrap).toContain('resume this task');
    expect(bootstrap).toContain('/hooks');
    expect(bootstrap).toContain('safeword codex status');
    expect(bootstrap).not.toMatch(/\b(?:BDD|TDD|quality review|ticket workflow)\b/u);
  });

  it('accepts complete finalization confirmation in a non-interactive process', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(fixture);

    const result = await finalizeCodex(fixture);

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stdout).toContain('Backed up the complete legacy Codex state');
    expect(readFileSync(fixture.configPath, 'utf8')).not.toContain(
      'safeword hook codex pre-tool-use',
    );
    expect(existsSync(nodePath.join(fixture.directory, '.safeword/codex-plugin.json'))).toBe(true);
  });

  it('previews stable finalization file effects as JSON without mutation', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(fixture);
    const legacySkillPath = nodePath.join(fixture.directory, '.agents/skills/review-spec/SKILL.md');
    mkdirSync(nodePath.dirname(legacySkillPath), { recursive: true });
    writeFileSync(legacySkillPath, '# legacy skill\n');
    const before = readFileSync(fixture.configPath, 'utf8');

    const result = await runCodexCommand(fixture, ['codex', 'migrate', '--finalize', '--json']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe('');
    const preview = JSON.parse(result.stdout);
    expect(preview).toMatchObject({
      schema_version: 1,
      changed: false,
      data: {
        plan: {
          effects: {
            files: expect.arrayContaining([
              { target: '.codex/config.toml', kind: 'update', operation: 'update' },
              {
                target: '.agents/skills/review-spec/SKILL.md',
                kind: 'remove',
                operation: 'remove',
              },
              {
                target: '.safeword/codex-plugin.json',
                kind: 'create',
                operation: 'create',
              },
              {
                target: '.agents/skills/safeword-plugin-setup/SKILL.md',
                kind: 'create',
                operation: 'create',
              },
            ]),
          },
        },
      },
    });
    expect(
      preview.data.plan.effects.files.every((file: { kind: string }) =>
        ['create', 'update', 'remove', 'restore'].includes(file.kind),
      ),
    ).toBe(true);
    expect(readFileSync(fixture.configPath, 'utf8')).toBe(before);
    expect(existsSync(legacySkillPath)).toBe(true);
  });

  it('binds typed finalization replay to the exact previewed plan and config blocks', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(fixture);
    const before = readFileSync(fixture.configPath, 'utf8');

    const preview = await runCodexCommand(fixture, ['codex', 'migrate', '--finalize', '--json']);
    const previewEnvelope = JSON.parse(preview.stdout) as {
      data: {
        plan: {
          id: string;
          exact_config_blocks: string[];
        };
      };
    };

    expect(preview.exitCode).toBe(2);
    expect(previewEnvelope.data.plan.id).toMatch(/^[\da-f]{64}$/u);
    expect(previewEnvelope.data.plan.exact_config_blocks).toEqual([
      expect.stringContaining("command = 'npx --yes safeword hook codex pre-tool-use'"),
    ]);
    expect(readFileSync(fixture.configPath, 'utf8')).toBe(before);

    const applied = await runCodexCommand(fixture, [
      'codex',
      'migrate',
      '--finalize',
      '--yes',
      '--plan',
      previewEnvelope.data.plan.id,
      '--json',
    ]);

    expect(applied.exitCode, applied.stderr).toBe(0);
    expect(JSON.parse(applied.stdout)).toMatchObject({
      state: 'changed',
      changed: true,
      data: { migration_state: 'plugin' },
    });
  });

  it('refuses typed finalization when repository state drifted after preview', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(fixture);
    const preview = await runCodexCommand(fixture, ['codex', 'migrate', '--finalize', '--json']);
    const planId = (JSON.parse(preview.stdout) as { data: { plan: { id: string } } }).data.plan.id;
    writeFileSync(fixture.configPath, `${LEGACY_HOOK_CONFIG}\n# teammate edit\n`);

    const applied = await runCodexCommand(fixture, [
      'codex',
      'migrate',
      '--finalize',
      '--yes',
      '--plan',
      planId,
      '--json',
    ]);

    expect(applied.exitCode).toBe(2);
    expect(JSON.parse(applied.stdout)).toMatchObject({
      state: 'action_required',
      changed: false,
      findings: [{ code: 'PLAN_STALE' }],
    });
    expect(readFileSync(fixture.configPath, 'utf8')).toContain('# teammate edit');
    expect(existsSync(nodePath.join(fixture.directory, '.safeword/codex-migration-backup'))).toBe(
      false,
    );
  });

  it('rechecks typed finalization after preflight before using the accepted plan', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(fixture);
    vi.stubEnv('PATH', `${fixture.bin}:${process.env.PATH ?? ''}`);
    vi.stubEnv('SAFEWORD_CODEX_LOG', fixture.logPath);
    vi.stubEnv('CODEX_HOME', fixture.codexHome);
    const handler = publicHandler('codex migrate');
    const preview = await handler({
      cwd: fixture.directory,
      noInput: true,
      offline: false,
      options: { finalize: true },
      operands: [],
    });
    const planId = (preview.data as { plan: { id: string } }).plan.id;

    const applied = await handler({
      cwd: fixture.directory,
      noInput: true,
      offline: false,
      options: { finalize: true, yes: true, plan: planId },
      operands: [],
      progress: {
        start: () => {
          writeFileSync(fixture.configPath, `${LEGACY_HOOK_CONFIG}\n# changed after preflight\n`);
        },
        stop: () => {},
      },
    });

    expect(applied).toMatchObject({
      state: 'action_required',
      changed: false,
      findings: [{ code: 'PLAN_STALE' }],
    });
    expect(readFileSync(fixture.configPath, 'utf8')).toContain('# changed after preflight');
    expect(existsSync(nodePath.join(fixture.directory, '.safeword/codex-migration-backup'))).toBe(
      false,
    );
  });

  it('rechecks typed recovery after preflight before using the accepted plan', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(fixture);
    const finalized = await finalizeCodex(fixture, {}, true);
    expect(finalized.exitCode).toBe(0);
    const handler = publicHandler('codex recover');
    const preview = await handler({
      cwd: fixture.directory,
      noInput: true,
      offline: false,
      options: {},
      operands: [],
    });
    const planId = (preview.data as { plan: { id: string } }).plan.id;
    const manifestPath = nodePath.join(
      fixture.directory,
      '.safeword/codex-migration-backup/manifest.json',
    );

    const recovered = await handler({
      cwd: fixture.directory,
      noInput: true,
      offline: false,
      options: { yes: true, plan: planId },
      operands: [],
      progress: {
        start: () => {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<
            string,
            unknown
          >;
          writeFileSync(manifestPath, JSON.stringify({ ...manifest, reviewed_by: 'teammate' }));
        },
        stop: () => {},
      },
    });

    expect(recovered).toMatchObject({
      state: 'action_required',
      changed: false,
      findings: [{ code: 'PLAN_STALE' }],
    });
    expect(existsSync(manifestPath)).toBe(true);
  });

  it('reports repeated typed finalization and absent recovery as no-ops', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(fixture);
    const preview = await runCodexCommand(fixture, ['codex', 'migrate', '--finalize', '--json']);
    const planId = (JSON.parse(preview.stdout) as { data: { plan: { id: string } } }).data.plan.id;
    const first = await runCodexCommand(fixture, [
      'codex',
      'migrate',
      '--finalize',
      '--yes',
      '--plan',
      planId,
      '--json',
    ]);
    expect(first.exitCode, first.stderr).toBe(0);

    const repeated = await runCodexCommand(fixture, [
      'codex',
      'migrate',
      '--finalize',
      '--yes',
      '--json',
    ]);
    expect(repeated.exitCode, repeated.stderr).toBe(0);
    expect(JSON.parse(repeated.stdout)).toMatchObject({
      state: 'healthy',
      changed: false,
      effects: { files: [], configuration: [] },
    });

    const recovered = await recoverCodex(fixture);
    expect(recovered.exitCode, recovered.stderr).toBe(0);
    const absentRecovery = await runCodexCommand(fixture, ['codex', 'recover', '--yes', '--json']);
    expect(absentRecovery.exitCode, absentRecovery.stderr).toBe(0);
    expect(JSON.parse(absentRecovery.stdout)).toMatchObject({
      state: 'healthy',
      changed: false,
      effects: { files: [], configuration: [] },
    });
  });

  it('reports a finalized plugin-only project without another action', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(fixture);
    const finalized = await finalizeCodex(fixture);
    expect(finalized.exitCode, finalized.stderr).toBe(0);

    const status = await runCodexCommand(fixture, ['codex', 'status']);

    expect(status.exitCode, status.stderr).toBe(0);
    expect(status.stdout).toContain('Codex migration state: plugin.');
    expect(status.stdout).not.toContain('Next:');

    const jsonStatus = await runCodexCommand(fixture, ['codex', 'status', '--json']);
    expect(jsonStatus.exitCode, jsonStatus.stderr).toBe(0);
    expect(jsonStatus.stderr).toBe('');
    expect(JSON.parse(jsonStatus.stdout)).toMatchObject({
      schema_version: 1,
      ok: true,
      state: 'healthy',
      data: { migration_state: 'plugin', protected: 'protected' },
      next_actions: [],
    });
  });

  it('returns one schema result for JSON migration, finalization, and recovery', async () => {
    const installing = createMigrationFixture(LEGACY_HOOK_CONFIG, {
      pluginInitiallyInstalled: false,
    });
    const install = await runCodexCommand(installing, ['codex', 'migrate', '--json']);
    expect(install.stderr).toBe('');
    expect(JSON.parse(install.stdout)).toMatchObject({
      schema_version: 1,
      changed: true,
      state: 'action_required',
      data: {
        migration_state: 'plugin_installed_restart_required',
        migration: {
          schema_version: '2',
          state: 'plugin_installed_app_restart_required',
        },
      },
    });

    const finalizing = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(finalizing);
    const finalize = await finalizeCodex(finalizing, {}, true);
    expect(finalize.exitCode, finalize.stderr).toBe(0);
    expect(finalize.stderr).toBe('');
    expect(JSON.parse(finalize.stdout)).toMatchObject({
      schema_version: 1,
      changed: true,
      state: 'changed',
      data: { migration_state: 'plugin' },
    });

    const recover = await recoverCodex(finalizing, true);
    expect(recover.stderr).toBe('');
    expect(JSON.parse(recover.stdout)).toMatchObject({
      schema_version: 1,
      changed: true,
      state: 'changed',
      data: { migration_state: 'compatibility' },
      effects: {
        files: expect.arrayContaining([
          { target: '.codex/config.toml', kind: 'restore', operation: 'restore' },
          { target: '.safeword/codex-plugin.json', kind: 'restore', operation: 'restore' },
        ]),
        configuration: [],
      },
    });
  });

  it('returns a schema error instead of prose when JSON migration fails', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG, {
      pluginInitiallyInstalled: false,
    });

    const result = await runCodexCommand(fixture, ['codex', 'migrate', '--json'], {
      SAFEWORD_FAIL_PLUGIN_INSTALL: '1',
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      schema_version: 1,
      changed: false,
      errors: [{ code: 'PLUGIN_MARKETPLACE_FAILED', retryable: true }],
    });
  });

  it('treats repeated finalization of a plugin-only project as a no-op', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(fixture);
    const first = await finalizeCodex(fixture);
    expect(first.exitCode, first.stderr).toBe(0);
    const markerPath = nodePath.join(fixture.directory, '.safeword/codex-plugin.json');
    const manifestPath = nodePath.join(
      fixture.directory,
      '.safeword/codex-migration-backup/manifest.json',
    );
    const before = {
      config: readFileSync(fixture.configPath, 'utf8'),
      marker: readFileSync(markerPath, 'utf8'),
      manifest: readFileSync(manifestPath, 'utf8'),
    };

    const second = await runCodexCommand(fixture, ['codex', 'migrate', '--finalize', '--yes']);

    expect(second.exitCode, second.stderr).toBe(0);
    expect(readFileSync(fixture.configPath, 'utf8')).toBe(before.config);
    expect(readFileSync(markerPath, 'utf8')).toBe(before.marker);
    expect(readFileSync(manifestPath, 'utf8')).toBe(before.manifest);
  });

  it('converges repeated migration while app-restart activation is pending', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    writeCodexActivationMarker({
      CODEX_HOME: fixture.codexHome,
    });
    const first = await runCodexCommand(fixture, ['codex', 'migrate']);
    expect(first.exitCode, first.stderr).toBe(2);
    const markerPath = nodePath.join(
      fixture.directory,
      'profile/safeword/activation-pending-v2.json',
    );
    const marker = readFileSync(markerPath, 'utf8');

    const second = await runCodexCommand(fixture, ['codex', 'migrate']);

    expect(second.exitCode, second.stderr).toBe(2);
    const status = await runCodexCommand(fixture, ['codex', 'status', '--json']);
    expect(JSON.parse(status.stdout)).toMatchObject({
      data: {
        migration_state: 'plugin_installed_restart_required',
        migration: {
          schema_version: '2',
          state: 'plugin_installed_app_restart_required',
        },
      },
    });
    expect(readFileSync(markerPath, 'utf8')).toBe(marker);
    const calls = readFileSync(fixture.logPath, 'utf8');
    expect(calls).not.toContain('plugin marketplace add');
  });

  it('does not request another restart after the restart receipt has partial hook proof', async () => {
    const fixture = createMigrationFixture('');
    const environment = { CODEX_HOME: fixture.codexHome };
    writeCodexActivationMarker(environment, new Date('2026-08-14T08:30:00.000Z'), {
      activationId: 'activation-partial',
      activeHosts: [{ pid: 100, started_at: '2026-08-14T08:00:00.000Z' }],
    });
    recordCodexHookProof('session-start', environment, new Date('2026-08-14T09:01:00.000Z'), {
      currentHost: { pid: 200, started_at: '2026-08-14T09:00:00.000Z' },
    });

    const status = await runCodexCommand(fixture, ['codex', 'status', '--json']);

    expect(status.exitCode, status.stderr).toBe(2);
    expect(JSON.parse(status.stdout)).toMatchObject({
      next_actions: [
        {
          kind: 'human',
          instruction:
            'Continue in this Codex session. Safeword will confirm protection after the remaining lifecycle hooks run.',
        },
      ],
      data: {
        migration: {
          state: 'plugin_enabled_hook_unproven',
        },
      },
    });
  });

  it('does not reinstall an enabled plugin whose hook proof is still unproven', async () => {
    const fixture = createMigrationFixture('');

    const result = await runCodexCommand(fixture, ['codex', 'migrate']);

    expect(result.exitCode, result.stderr).toBe(2);
    expect(result.stdout).toContain('plugin_enabled_hook_unproven');
    expect(
      existsSync(nodePath.join(fixture.directory, 'profile/safeword/activation-pending-v2.json')),
    ).toBe(false);
    expect(readFileSync(fixture.logPath, 'utf8')).not.toContain('plugin marketplace add');
  });

  it('reinstalls an absent plugin even when a stale activation marker remains', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG, {
      pluginInitiallyInstalled: false,
    });
    const environment = {
      CODEX_HOME: fixture.codexHome,
    };
    writeCodexActivationMarker(environment);

    const result = await runCodexCommand(fixture, ['codex', 'migrate', '--json']);

    expect(JSON.parse(result.stdout)).toMatchObject({
      changed: true,
      data: { plugin: { installed: true, enabled: true } },
    });
    expect(readFileSync(fixture.logPath, 'utf8')).toContain('plugin add safeword@safeword --json');
  });

  it('does not regress compatibility mode to app-restart-required on repeated migration', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(fixture);

    const result = await runCodexCommand(fixture, ['codex', 'migrate']);

    expect(result.exitCode, result.stderr).toBe(2);
    expect(result.stdout).toContain('protected by the current profile plugin');
    expect(
      existsSync(nodePath.join(fixture.directory, 'profile/safeword/activation-pending-v2.json')),
    ).toBe(false);
    expect(readFileSync(fixture.logPath, 'utf8')).not.toContain('plugin marketplace add');
  });

  it('blocks migration while recovery evidence is unresolved', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    const backupDirectory = nodePath.join(fixture.directory, '.safeword/codex-migration-backup');
    mkdirSync(backupDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(backupDirectory, 'manifest.json'),
      JSON.stringify({ schema_version: 1, status: 'prepared', entries: [] }),
    );
    const before = readFileSync(fixture.configPath, 'utf8');

    const result = await runCodexCommand(fixture, ['codex', 'migrate']);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain('recovery_required');
    expect(result.stdout).toContain('Next: safeword codex recover');
    expect(result.stdout.match(/^Next:/gm)).toHaveLength(1);
    expect(readFileSync(fixture.configPath, 'utf8')).toBe(before);
    expect(existsSync(fixture.logPath)).toBe(false);

    const preview = await runCodexCommand(fixture, ['codex', 'migrate', '--finalize', '--json']);
    expect(preview.exitCode).toBe(2);
    expect(preview.stderr).toBe('');
    expect(JSON.parse(preview.stdout)).toMatchObject({
      state: 'action_required',
      data: { migration_state: 'recovery_required' },
      errors: [],
      next_actions: [{ command: 'safeword codex recover' }],
    });
    expect(existsSync(fixture.logPath)).toBe(false);
  });

  it('reports linked or dangling reserved backup roots as recovery required', async () => {
    const linkedFixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    applyCodexFinalization(linkedFixture.directory, [
      { path: '.agents/skills/bdd/SKILL.md', content: '# migrated\n' },
      { path: '.safeword/codex-plugin.json', content: '{}\n' },
    ]);
    const backup = nodePath.join(linkedFixture.directory, '.safeword/codex-migration-backup');
    const externalBackup = nodePath.join(linkedFixture.directory, 'external-backup');
    renameSync(backup, externalBackup);
    symlinkSync(externalBackup, backup, 'dir');

    const linkedStatus = await runCodexCommand(linkedFixture, ['codex', 'status', '--json']);
    expect(linkedStatus.exitCode).toBe(2);
    expect(JSON.parse(linkedStatus.stdout)).toMatchObject({
      state: 'action_required',
      data: { migration_state: 'recovery_required' },
    });

    const danglingFixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    const danglingBackup = nodePath.join(
      danglingFixture.directory,
      '.safeword/codex-migration-backup',
    );
    mkdirSync(nodePath.dirname(danglingBackup), { recursive: true });
    symlinkSync(nodePath.join(danglingFixture.directory, 'missing-backup'), danglingBackup, 'dir');

    const danglingRecovery = await runCodexCommand(danglingFixture, [
      'codex',
      'recover',
      '--yes',
      '--json',
    ]);
    expect(danglingRecovery.exitCode).toBe(1);
    expect(JSON.parse(danglingRecovery.stdout)).toMatchObject({
      state: 'failed',
      changed: false,
      errors: [{ code: 'UNSAFE_MIGRATION_PATH' }],
    });
  });

  it('restores the complete backed-up legacy state through recovery', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(fixture);
    const legacySkillPath = nodePath.join(fixture.directory, '.agents/skills/review-spec/SKILL.md');
    mkdirSync(nodePath.dirname(legacySkillPath), { recursive: true });
    writeFileSync(legacySkillPath, '# legacy skill\n');
    const originalConfig = readFileSync(fixture.configPath, 'utf8');
    const finalized = await finalizeCodex(fixture);
    expect(finalized.exitCode, finalized.stderr).toBe(0);

    const recovered = await recoverCodex(fixture);

    expect(recovered.exitCode, recovered.stderr).toBe(0);
    expect(readFileSync(fixture.configPath, 'utf8')).toBe(originalConfig);
    expect(readFileSync(legacySkillPath, 'utf8')).toBe('# legacy skill\n');
    expect(existsSync(nodePath.join(fixture.directory, '.safeword/codex-plugin.json'))).toBe(false);
    expect(
      existsSync(nodePath.join(fixture.directory, '.agents/skills/safeword-plugin-setup/SKILL.md')),
    ).toBe(false);
    expect(existsSync(nodePath.join(fixture.directory, '.safeword/codex-migration-backup'))).toBe(
      false,
    );
  });

  it('refuses recovery rather than overwriting an intervening edit', async () => {
    const fixture = createMigrationFixture(LEGACY_HOOK_CONFIG);
    recordCurrentProof(fixture);
    const finalized = await finalizeCodex(fixture);
    expect(finalized.exitCode, finalized.stderr).toBe(0);
    writeFileSync(fixture.configPath, '# teammate edit after finalization\n');

    const recovered = await runCodexCommand(fixture, ['codex', 'recover', '--yes']);

    expect(recovered.exitCode).toBe(1);
    expect(`${recovered.stdout}\n${recovered.stderr}`).toContain('recovery conflict');
    expect(readFileSync(fixture.configPath, 'utf8')).toBe('# teammate edit after finalization\n');
    expect(existsSync(nodePath.join(fixture.directory, '.safeword/codex-migration-backup'))).toBe(
      true,
    );
  });

  it('cleans legacy hooks through the explicit Codex migration command without reinstalling', async () => {
    const fixture = createMigrationFixture(`${LEGACY_HOOK_CONFIG}${CUSTOM_PRE_TOOL_HOOK}`);
    const { configPath } = fixture;
    recordCurrentProof(fixture);

    const result = await runCodexCommand(fixture, [
      'codex',
      'migrate',
      '--remove-legacy-hooks',
      '--yes',
    ]);

    expect(result.exitCode, result.stderr).toBe(0);
    const migrated = readFileSync(configPath, 'utf8');
    expect(migrated).not.toContain('safeword hook codex pre-tool-use');
    expect(migrated).toContain(CUSTOM_PRE_TOOL_HOOK.trim());
    const markerPath = nodePath.join(fixture.directory, '.safeword/codex-plugin.json');
    const manifestPath = nodePath.join(
      fixture.directory,
      '.safeword/codex-migration-backup/manifest.json',
    );
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(marker).toMatchObject({
      schema_version: 1,
      mode: 'plugin',
      transaction_id: expect.any(String),
      plan_sha256: expect.stringMatching(/^[\da-f]{64}$/u),
    });
    expect(manifest).toMatchObject({
      schema_version: 1,
      status: 'finalized',
      transaction_id: marker.transaction_id,
      plan_sha256: marker.plan_sha256,
    });
    const calls = readFileSync(fixture.logPath, 'utf8');
    expect(calls).toContain('plugin list --json');
    expect(calls).not.toContain('plugin marketplace add');
    expect(calls).not.toContain('plugin add safeword@safeword --json');
  });
});
