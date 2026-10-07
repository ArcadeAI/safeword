import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  automaticallyMigrateLegacyCodex,
  installCodexPlugin,
  observeCodexMigrationResult,
  removeLegacyCodexHooks,
} from '../../src/codex-plugin/operations.js';
import {
  CODEX_PLUGIN_HOOK_EVENTS,
  recordCodexHookProof,
} from '../../src/codex-plugin/profile-proof.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers';
import { installFakeCodexRuntime } from '../helpers/fake-codex-runtime.js';

const LOCAL_CONFIG = '[marketplaces.safeword]\nsource_type = "local"\nsource = "/tmp/safeword"\n';
const OTHER_CONFIG =
  '[marketplaces.safeword]\nsource_type = "local"\nsource = "/tmp/other-marketplace"\n';

describe('programmatic Codex profile selection', () => {
  let directory: string;
  let requestedHome: string;
  let activeHome: string;

  beforeEach(() => {
    directory = createTemporaryDirectory();
    const runtime = installFakeCodexRuntime(directory, {
      pluginEnabled: false,
      pluginInitiallyInstalled: false,
    });
    requestedHome = runtime.codexHome;
    activeHome = nodePath.join(directory, 'other-profile');
    for (const home of [requestedHome, activeHome]) {
      mkdirSync(home, { recursive: true });
      writeFileSync(
        nodePath.join(home, 'config.toml'),
        home === requestedHome ? LOCAL_CONFIG : OTHER_CONFIG,
      );
      writeFileSync(nodePath.join(home, 'plugin-state'), 'absent');
      writeFileSync(nodePath.join(home, 'plugin-version'), SAFEWORD_SCHEMA.version);
    }
    vi.stubEnv('PATH', `${runtime.bin}${nodePath.delimiter}${process.env.PATH ?? ''}`);
    vi.stubEnv('CODEX_HOME', activeHome);
    vi.stubEnv('SAFEWORD_CODEX_LOG', runtime.logPath);
    vi.stubEnv('SAFEWORD_MARKETPLACE_SOURCE_TYPE', 'local');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    removeTemporaryDirectory(directory);
  });

  function assertOtherProfileUntouched(state = 'absent'): void {
    expect(readFileSync(nodePath.join(activeHome, 'plugin-state'), 'utf8')).toBe(state);
    expect(readFileSync(nodePath.join(activeHome, 'plugin-version'), 'utf8')).toBe(
      SAFEWORD_SCHEMA.version,
    );
    expect(readFileSync(nodePath.join(activeHome, 'config.toml'), 'utf8')).toBe(OTHER_CONFIG);
    expect(existsSync(nodePath.join(activeHome, 'safeword'))).toBe(false);
    expect(process.env.CODEX_HOME).toBe(activeHome);
  }

  it('installs only in the explicitly requested profile while inheriting PATH', () => {
    installCodexPlugin({ cwd: directory, environment: { CODEX_HOME: requestedHome }, json: true });

    expect(readFileSync(nodePath.join(requestedHome, 'plugin-state'), 'utf8')).toBe('enabled');
    expect(readFileSync(nodePath.join(requestedHome, 'config.toml'), 'utf8')).toBe(LOCAL_CONFIG);
    expect(existsSync(nodePath.join(requestedHome, 'safeword/activation-pending-v2.json'))).toBe(
      true,
    );
    assertOtherProfileUntouched();
  });

  it('observes the requested profile even when the process profile has an enabled plugin', () => {
    writeFileSync(nodePath.join(activeHome, 'plugin-state'), 'enabled');

    const result = observeCodexMigrationResult(directory, { CODEX_HOME: requestedHome });

    expect(result.plugin.installed).toBe(false);
    expect(result.plugin.enabled).toBe(false);
    expect(readFileSync(nodePath.join(requestedHome, 'plugin-state'), 'utf8')).toBe('absent');
    assertOtherProfileUntouched('enabled');
  });

  it('migrates the requested profile even when the process profile already has the current plugin', () => {
    writeFileSync(nodePath.join(activeHome, 'plugin-state'), 'enabled');
    mkdirSync(nodePath.join(directory, '.codex'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.codex/config.toml'),
      `
[[hooks.PreToolUse]]
[[hooks.PreToolUse.hooks]]
type = "command"
command = 'npx --yes safeword hook codex pre-tool-use'
`,
    );

    const result = automaticallyMigrateLegacyCodex(directory, { CODEX_HOME: requestedHome });

    expect(result.migrated).toBe(true);
    expect(readFileSync(nodePath.join(requestedHome, 'plugin-state'), 'utf8')).toBe('enabled');
    assertOtherProfileUntouched('enabled');
  });

  it('finalizes using enablement from the requested profile', async () => {
    writeFileSync(nodePath.join(requestedHome, 'plugin-state'), 'enabled');
    const environment = { CODEX_HOME: requestedHome };
    for (const event of CODEX_PLUGIN_HOOK_EVENTS) recordCodexHookProof(event, environment);
    mkdirSync(nodePath.join(directory, '.codex'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.codex/config.toml'),
      `
[[hooks.PreToolUse]]
[[hooks.PreToolUse.hooks]]
type = "command"
command = 'npx --yes safeword hook codex pre-tool-use'
`,
    );

    const changed = await removeLegacyCodexHooks(directory, {
      environment,
      yes: true,
      report: false,
    });

    expect(changed).toBe(true);
    expect(readFileSync(nodePath.join(directory, '.codex/config.toml'), 'utf8')).not.toContain(
      'safeword hook',
    );
    assertOtherProfileUntouched();
  });
});
