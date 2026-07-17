import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory, runCli } from '../helpers';

const LEGACY_HOOK_CONFIG = `# Safeword Codex project configuration.

[features]
hooks = true

[[hooks.PreToolUse]]
matcher = "^(apply_patch)$"

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'npx --yes safeword hook codex pre-tool-use'
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

function writeExecutable(path: string, content: string): void {
  writeFileSync(path, content, { mode: 0o755 });
  chmodSync(path, 0o755);
}

function installFakeRuntime(directory: string, pluginEnabled: boolean): string {
  const bin = nodePath.join(directory, 'bin');
  mkdirSync(bin, { recursive: true });
  writeExecutable(nodePath.join(bin, 'bun'), '#!/bin/sh\nexit 0\n');
  writeExecutable(
    nodePath.join(bin, 'codex'),
    String.raw`#!/bin/sh
set -eu
printf '%s\\n' "$*" >> "$SAFEWORD_CODEX_LOG"
case "$*" in
  '--version') echo 'codex 0.141.0' ;;
  'plugin marketplace add '* ) echo '{"marketplaceName":"safeword"}' ;;
  'plugin add safeword@safeword --json') echo '{"pluginId":"safeword@safeword"}' ;;
  'plugin list --json') echo '{"installed":[{"pluginId":"safeword@safeword","enabled":${pluginEnabled}}]}' ;;
  *) exit 2 ;;
esac
`,
  );
  return bin;
}

describe('migrate codex-plugin command', () => {
  const directories: string[] = [];

  function createMigrationFixture(config: string, pluginEnabled = true) {
    const directory = createTemporaryDirectory();
    directories.push(directory);
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(directory, '.codex'), { recursive: true });
    writeFileSync(nodePath.join(directory, '.safeword/version'), '0.68.0\n');
    const configPath = nodePath.join(directory, '.codex/config.toml');
    writeFileSync(configPath, config);

    return { directory, configPath, bin: installFakeRuntime(directory, pluginEnabled) };
  }

  afterEach(() => {
    for (const directory of directories) removeTemporaryDirectory(directory);
    directories.length = 0;
  });

  it('leaves legacy hooks untouched and explains the reviewed-plugin handoff', async () => {
    const { directory, configPath, bin } = createMigrationFixture(LEGACY_HOOK_CONFIG);
    const log = nodePath.join(directory, 'codex.log');

    const result = await runCli(['migrate', 'codex-plugin'], {
      cwd: directory,
      env: {
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        SAFEWORD_CODEX_LOG: log,
      },
    });

    expect(result.exitCode, result.stderr).toBe(0);
    expect(readFileSync(configPath, 'utf8')).toBe(LEGACY_HOOK_CONFIG);
    expect(`${result.stdout}\n${result.stderr}`).toContain('/hooks');
    expect(`${result.stdout}\n${result.stderr}`).toContain('--remove-legacy-hooks');
    expect(existsSync(nodePath.join(directory, '.codex/config.toml.safeword.bak'))).toBe(false);
    const calls = readFileSync(log, 'utf8');
    expect(calls).toContain(
      'plugin marketplace add ArcadeAI/safeword --sparse .agents/plugins --sparse packages/cli/codex-plugin --json',
    );
    expect(calls).toContain('plugin list --json');
  });

  it('removes legacy hooks only after the explicit handoff cleanup request', async () => {
    const original = `${LEGACY_HOOK_CONFIG}${USER_CODEX_CONFIG}`;
    const { directory, configPath, bin } = createMigrationFixture(original);

    const result = await runCli(['migrate', 'codex-plugin', '--remove-legacy-hooks'], {
      cwd: directory,
      env: {
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        SAFEWORD_CODEX_LOG: nodePath.join(directory, 'codex.log'),
      },
    });

    expect(result.exitCode, result.stderr).toBe(0);
    const migrated = readFileSync(configPath, 'utf8');
    expect(migrated).not.toContain('safeword hook codex pre-tool-use');
    expect(migrated).not.toContain('[[hooks.PreToolUse]]');
    expect(migrated).toContain(USER_CODEX_CONFIG.trim());
    expect(readFileSync(nodePath.join(directory, '.codex/config.toml.safeword.bak'), 'utf8')).toBe(
      original,
    );
  });

  it('removes only the Safe Word handler during explicit handoff cleanup', async () => {
    const original = `${LEGACY_HOOK_CONFIG}${CUSTOM_PRE_TOOL_HOOK}${USER_CODEX_CONFIG}`;
    const { directory, configPath, bin } = createMigrationFixture(original);

    const result = await runCli(['migrate', 'codex-plugin', '--remove-legacy-hooks'], {
      cwd: directory,
      env: {
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        SAFEWORD_CODEX_LOG: nodePath.join(directory, 'codex.log'),
      },
    });

    expect(result.exitCode, result.stderr).toBe(0);
    const migrated = readFileSync(configPath, 'utf8');
    expect(migrated).not.toContain('safeword hook codex pre-tool-use');
    expect(migrated).toContain('[[hooks.PreToolUse]]');
    expect(migrated).toContain(CUSTOM_PRE_TOOL_HOOK.trim());
    expect(migrated).toContain(USER_CODEX_CONFIG.trim());
    expect(readFileSync(nodePath.join(directory, '.codex/config.toml.safeword.bak'), 'utf8')).toBe(
      original,
    );
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
    const { directory, configPath, bin } = createMigrationFixture(original);

    const result = await runCli(['migrate', 'codex-plugin', '--remove-legacy-hooks'], {
      cwd: directory,
      env: {
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        SAFEWORD_CODEX_LOG: nodePath.join(directory, 'codex.log'),
      },
    });

    expect(result.exitCode, result.stderr).toBe(0);
    const migrated = readFileSync(configPath, 'utf8');
    expect(migrated).not.toContain("command = 'npx --yes safeword hook codex pre-tool-use'");
    expect(migrated).toContain("command = 'safeword-tools hook codex pre-tool-use'");
    expect(migrated).toContain("command = 'npx --yes safeword@evil hook codex pre-tool-use'");
    expect(migrated).toContain("command = 'bunx --bun safeword@1.2.3 hook codex pre-tool-use'");
    expect(migrated).toContain("command = 'safeword hook codex pre-tool-use'");
    expect(readFileSync(`${configPath}.safeword.bak`, 'utf8')).toBe(original);
  });

  it('preserves user scripts beside an exact historical Safe Word hook', async () => {
    const original = `[[hooks.PreToolUse]]
matcher = "^(apply_patch)$"

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/codex/pre-tool-quality.ts"'

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/codex/custom.ts"'
`;
    const { directory, configPath, bin } = createMigrationFixture(original);

    const result = await runCli(['migrate', 'codex-plugin', '--remove-legacy-hooks'], {
      cwd: directory,
      env: {
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        SAFEWORD_CODEX_LOG: nodePath.join(directory, 'codex.log'),
      },
    });

    expect(result.exitCode, result.stderr).toBe(0);
    const migrated = readFileSync(configPath, 'utf8');
    expect(migrated).not.toContain('codex/pre-tool-quality.ts');
    expect(migrated).toContain('codex/custom.ts');
    expect(readFileSync(`${configPath}.safeword.bak`, 'utf8')).toBe(original);
  });

  it('refuses explicit cleanup when the Codex configuration is malformed', async () => {
    const original = `${LEGACY_HOOK_CONFIG}\n[broken\n`;
    const { directory, configPath, bin } = createMigrationFixture(original);

    const result = await runCli(['migrate', 'codex-plugin', '--remove-legacy-hooks'], {
      cwd: directory,
      env: {
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        SAFEWORD_CODEX_LOG: nodePath.join(directory, 'codex.log'),
      },
    });

    expect(result.exitCode).not.toBe(0);
    expect(readFileSync(configPath, 'utf8')).toBe(original);
    expect(existsSync(nodePath.join(directory, '.codex/config.toml.safeword.bak'))).toBe(false);
  });

  it('does not treat a Safe Word marker in a comment as an owned handler', async () => {
    const original = `[[hooks.PreToolUse]]
matcher = "^custom$"

[[hooks.PreToolUse.hooks]]
# former command: bunx --bun safeword@0.68.0 hook codex pre-tool-use
type = "command"
command = 'echo "keep this user hook"'
`;
    const { directory, configPath, bin } = createMigrationFixture(original);

    const result = await runCli(['migrate', 'codex-plugin', '--remove-legacy-hooks'], {
      cwd: directory,
      env: {
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        SAFEWORD_CODEX_LOG: nodePath.join(directory, 'codex.log'),
      },
    });

    expect(result.exitCode, result.stderr).toBe(0);
    expect(readFileSync(configPath, 'utf8')).toBe(original);
    expect(existsSync(nodePath.join(directory, '.codex/config.toml.safeword.bak'))).toBe(false);
  });

  it('refuses cleanup instead of replacing an existing Safe Word backup', async () => {
    const { directory, configPath, bin } = createMigrationFixture(LEGACY_HOOK_CONFIG);
    const backupPath = `${configPath}.safeword.bak`;
    writeFileSync(backupPath, 'existing backup\n');

    const result = await runCli(['migrate', 'codex-plugin', '--remove-legacy-hooks'], {
      cwd: directory,
      env: {
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        SAFEWORD_CODEX_LOG: nodePath.join(directory, 'codex.log'),
      },
    });

    expect(result.exitCode).not.toBe(0);
    expect(readFileSync(configPath, 'utf8')).toBe(LEGACY_HOOK_CONFIG);
    expect(readFileSync(backupPath, 'utf8')).toBe('existing backup\n');
  });

  it('retains legacy hooks when Codex reports the plugin disabled', async () => {
    const { directory, configPath, bin } = createMigrationFixture(LEGACY_HOOK_CONFIG, false);
    const before = readFileSync(configPath, 'utf8');

    const result = await runCli(['migrate', 'codex-plugin'], {
      cwd: directory,
      env: {
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        SAFEWORD_CODEX_LOG: nodePath.join(directory, 'codex.log'),
      },
    });

    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('enabled');
    expect(readFileSync(configPath, 'utf8')).toBe(before);
    expect(existsSync(configPath)).toBe(true);
  });
});
