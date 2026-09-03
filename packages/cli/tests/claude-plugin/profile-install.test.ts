import { chmodSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  installClaudePlugin,
  observeApplicableClaudePlugins,
} from '../../src/claude-plugin/profile.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';
import { createTemporaryDirectory } from '../helpers.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
// The fake host must expect the same prerelease-aware marketplace ref as
// installClaudePlugin's officialMarketplaceSource().
const OFFICIAL_MARKETPLACE_REF = SAFEWORD_SCHEMA.version.includes('-')
  ? `v${SAFEWORD_SCHEMA.version}`
  : 'stable';
const directories: string[] = [];
const originalPath = process.env.PATH;
const originalClaudeConfig = process.env.CLAUDE_CONFIG_DIR;
const originalProjectDirectory = process.env.CLAUDE_PROJECT_DIR;

interface FixtureState {
  readonly scope?: 'project' | 'user';
  readonly cacheMetadata?: boolean;
  readonly healthyPayload?: boolean;
  readonly installedVersion?: string | false;
  readonly largePluginInventory?: boolean;
  readonly marketplaceAddPersists?: boolean;
  readonly marketplaceDeclared?: boolean;
  /** Raw `extraKnownMarketplaces.safeword.source` value, for non-canonical shapes. */
  readonly marketplaceDeclaredSource?: Record<string, unknown>;
  readonly marketplaceListedReference?: string | false;
  /** Raw `plugin marketplace list --json` entry, for non-canonical source shapes. */
  readonly marketplaceListedSource?: Record<string, unknown>;
  readonly omittedUserScope?: boolean;
  readonly oversizedPluginInventory?: boolean;
  readonly oversizedVersionOutput?: boolean;
  readonly oversizedVersionStderr?: boolean;
  readonly pluginEnabled?: boolean;
  readonly unexpectedPayload?: boolean;
}

function prepareInstallPath(root: string, state: FixtureState): string {
  if (state.healthyPayload === false) return nodePath.join(root, 'broken-plugin');
  if (state.cacheMetadata !== true && state.unexpectedPayload !== true) {
    return nodePath.join(REPO_ROOT, 'plugin');
  }

  const installPath = nodePath.join(root, 'cached-plugin');
  cpSync(nodePath.join(REPO_ROOT, 'plugin'), installPath, { recursive: true });
  if (state.cacheMetadata === true) {
    const leaseDirectory = nodePath.join(installPath, '.in_use');
    mkdirSync(leaseDirectory);
    writeFileSync(
      nodePath.join(leaseDirectory, '12345'),
      '{"pid":12345,"procStart":"Sun Aug  9 17:18:28 2026"}',
    );
    writeFileSync(nodePath.join(installPath, '.orphaned_at'), '1785974107464');
  }
  if (state.unexpectedPayload === true) {
    writeFileSync(nodePath.join(installPath, 'unexpected-runtime.js'), 'malicious payload\n');
  }
  return installPath;
}

function initializeFixtureState(root: string, ref: string, state: FixtureState) {
  const installedState = nodePath.join(root, 'installed');
  const enabledState = nodePath.join(root, 'enabled');
  const marketplaceState = nodePath.join(root, 'marketplace');
  const installPath = prepareInstallPath(root, state);
  const installedVersion = state.installedVersion ?? SAFEWORD_SCHEMA.version;
  if (typeof installedVersion === 'string') writeFileSync(installedState, `${installedVersion}\n`);
  if (state.pluginEnabled !== false && typeof installedVersion === 'string') {
    writeFileSync(enabledState, 'enabled\n');
  }
  const marketplaceListedReference = state.marketplaceListedReference ?? ref;
  if (typeof marketplaceListedReference === 'string') {
    writeFileSync(marketplaceState, `${marketplaceListedReference}\n`);
  }
  if (state.healthyPayload === false) mkdirSync(installPath);
  return { enabledState, installedState, installPath, marketplaceState };
}

function writePluginListOverride(
  path: string,
  state: FixtureState,
  installPath: string,
  project: string,
): void {
  if (state.omittedUserScope === true) {
    writeFileSync(
      path,
      `${JSON.stringify([
        {
          id: 'safeword@safeword',
          version: SAFEWORD_SCHEMA.version,
          enabled: true,
          installPath,
        },
      ])}\n`,
    );
    return;
  }
  if (
    state.oversizedPluginInventory === true ||
    state.oversizedVersionOutput === true ||
    state.oversizedVersionStderr === true
  ) {
    writeFileSync(
      path,
      `${JSON.stringify([{ id: 'oversized@example', detail: 'x'.repeat(10 * 1024 * 1024) }])}\n`,
    );
    return;
  }
  if (state.largePluginInventory !== true) return;
  const plugins: Record<string, unknown>[] = Array.from({ length: 400 }, (_, index) => ({
    id: `unrelated-${index}@example`,
    scope: 'user',
    version: '1.0.0',
    enabled: true,
    installPath: `/tmp/${'x'.repeat(180)}-${index}`,
  }));
  plugins.push({
    id: 'safeword@safeword',
    scope: 'project',
    version: SAFEWORD_SCHEMA.version,
    enabled: true,
    installPath,
    projectPath: project,
  });
  writeFileSync(path, `${JSON.stringify(plugins)}\n`);
}

function versionCommand(state: FixtureState, outputPath: string): string {
  if (state.oversizedVersionOutput === true) return `cat ${JSON.stringify(outputPath)}`;
  if (state.oversizedVersionStderr === true) return `cat ${JSON.stringify(outputPath)} >&2`;
  return "echo '2.1.170'";
}

function fixture(
  autoUpdate: boolean | undefined,
  ref = 'stable',
  environment?: Record<string, unknown>,
  state: FixtureState = {},
) {
  const root = createTemporaryDirectory();
  const project = nodePath.join(root, 'project');
  const bin = nodePath.join(root, 'bin');
  const log = nodePath.join(root, 'claude.log');
  const pluginListOverride = nodePath.join(root, 'plugin-list.json');
  const scope = state.scope ?? 'project';
  const claudeConfig = nodePath.join(root, 'claude-config');
  process.env.CLAUDE_CONFIG_DIR = claudeConfig;
  const settingsDirectories = { project: nodePath.join(project, '.claude'), user: claudeConfig };
  const settingsPath = nodePath.join(settingsDirectories[scope], 'settings.json');
  directories.push(root);
  mkdirSync(project, { recursive: true });
  mkdirSync(nodePath.dirname(settingsPath), { recursive: true });
  mkdirSync(bin);
  const { enabledState, installedState, installPath, marketplaceState } = initializeFixtureState(
    root,
    ref,
    state,
  );
  writePluginListOverride(pluginListOverride, state, installPath, project);
  const listingOverride = nodePath.join(root, 'marketplace-listing.json');
  if (state.marketplaceListedSource !== undefined) {
    writeFileSync(
      listingOverride,
      `${JSON.stringify([{ name: 'safeword', ...state.marketplaceListedSource }])}\n`,
    );
  }
  const declaration: Record<string, unknown> = {
    source: state.marketplaceDeclaredSource ?? {
      source: 'git',
      url: 'https://github.com/ArcadeAI/safeword.git',
      ref,
    },
  };
  if (autoUpdate !== undefined) declaration.autoUpdate = autoUpdate;
  const settings = {
    unrelated: { keep: true },
    env: environment,
    extraKnownMarketplaces: state.marketplaceDeclared === false ? {} : { safeword: declaration },
  };
  writeFileSync(settingsPath, `${JSON.stringify(settings, undefined, 2)}\n`);
  const persistedMarketplaceSettings = JSON.stringify({
    extraKnownMarketplaces: {
      safeword: {
        source: {
          source: 'git',
          url: 'https://github.com/ArcadeAI/safeword.git',
          ref: OFFICIAL_MARKETPLACE_REF,
        },
      },
    },
  });
  const persistMarketplace =
    state.marketplaceAddPersists === false
      ? ':'
      : `rm -f ${JSON.stringify(listingOverride)}\nprintf '%s\\n' ${JSON.stringify(OFFICIAL_MARKETPLACE_REF)} > ${JSON.stringify(marketplaceState)}\nprintf '%s\\n' ${JSON.stringify(persistedMarketplaceSettings)} > ${JSON.stringify(settingsPath)}`;
  const executable = nodePath.join(bin, 'claude');
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
printf '%s\n' "$*" >> ${JSON.stringify(log)}
case "$*" in
  '--version') ${versionCommand(state, pluginListOverride)} ;;
  'plugin marketplace list --json')
    if [ -f ${JSON.stringify(listingOverride)} ]; then
      cat ${JSON.stringify(listingOverride)}
    elif [ -f ${JSON.stringify(marketplaceState)} ]; then
      marketplace_ref=$(cat ${JSON.stringify(marketplaceState)})
      printf '[{"name":"safeword","source":{"url":"https://github.com/ArcadeAI/safeword.git","ref":"%s"}}]\n' "$marketplace_ref"
    else
      echo '[]'
    fi
    ;;
  'plugin marketplace add https://github.com/ArcadeAI/safeword.git#${OFFICIAL_MARKETPLACE_REF} --scope ${scope}') ${persistMarketplace} ;;
  'plugin list --json')
    if [ -f ${JSON.stringify(pluginListOverride)} ]; then
      if [ -p /dev/fd/1 ] || [ -S /dev/fd/1 ]; then
        head -c 65536 ${JSON.stringify(pluginListOverride)}
      else
        cat ${JSON.stringify(pluginListOverride)}
      fi
    elif [ -f ${JSON.stringify(installedState)} ]; then
      plugin_version=$(cat ${JSON.stringify(installedState)})
      plugin_enabled=false
      if [ -f ${JSON.stringify(enabledState)} ]; then plugin_enabled=true; fi
      printf '[{"id":"safeword@safeword","scope":"${scope}","projectPath":${JSON.stringify(project)},"version":"%s","enabled":%s,"installPath":${JSON.stringify(installPath)}}]\n' "$plugin_version" "$plugin_enabled"
    else
      echo '[]'
    fi
    ;;
  'plugin install safeword@safeword --scope ${scope}')
    printf '%s\n' ${JSON.stringify(SAFEWORD_SCHEMA.version)} > ${JSON.stringify(installedState)}
    touch ${JSON.stringify(enabledState)}
    ;;
  'plugin update safeword@safeword --scope ${scope}') printf '%s\n' ${JSON.stringify(SAFEWORD_SCHEMA.version)} > ${JSON.stringify(installedState)} ;;
  'plugin enable safeword@safeword --scope ${scope}') touch ${JSON.stringify(enabledState)} ;;
  *) exit 97 ;;
esac
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  process.env.PATH = `${bin}:${originalPath ?? ''}`;
  process.env.CLAUDE_PROJECT_DIR = project;
  return { log, project, settingsPath };
}

afterEach(() => {
  process.env.PATH = originalPath;
  if (originalClaudeConfig === undefined) delete process.env.CLAUDE_CONFIG_DIR;
  else process.env.CLAUDE_CONFIG_DIR = originalClaudeConfig;
  if (originalProjectDirectory === undefined) delete process.env.CLAUDE_PROJECT_DIR;
  else process.env.CLAUDE_PROJECT_DIR = originalProjectDirectory;
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  directories.length = 0;
});

describe('Claude marketplace update enrollment', () => {
  it('installs at user scope by default through the real Claude command boundary', () => {
    const { log, project } = fixture(true, 'stable', undefined, {
      installedVersion: false,
      scope: 'user',
    });

    const result = installClaudePlugin(project);

    expect(result.state).toBe('action_required');
    expect(readFileSync(log, 'utf8')).toContain('plugin install safeword@safeword --scope user');
  });

  it('reports a missing Claude host with an installation action', () => {
    const root = createTemporaryDirectory();
    const project = nodePath.join(root, 'project');
    const emptyBin = nodePath.join(root, 'empty-bin');
    directories.push(root);
    mkdirSync(project);
    mkdirSync(emptyBin);
    process.env.PATH = emptyBin;

    expect(observeApplicableClaudePlugins(project)).toMatchObject({
      status: 'unsupported-host',
      nextAction: 'install Claude Code',
    });
  });

  it('installs a missing plugin at project scope through the real Claude command boundary', () => {
    const { log, project } = fixture(true, 'stable', undefined, { installedVersion: false });

    const result = installClaudePlugin(project, 'project');

    expect(result.state).toBe('action_required');
    expect(readFileSync(log, 'utf8')).toContain('plugin install safeword@safeword --scope project');
  });

  it('updates and re-enables a disabled older plugin through the real Claude command boundary', () => {
    const { log, project } = fixture(true, 'stable', undefined, {
      installedVersion: '0.72.0',
      pluginEnabled: false,
    });

    const result = installClaudePlugin(project, 'project');
    const commands = readFileSync(log, 'utf8');

    expect(result.state).toBe('action_required');
    expect(commands).toContain('plugin update safeword@safeword --scope project');
    expect(commands).toContain('plugin enable safeword@safeword --scope project');
    expect(result.effects?.network).toEqual([
      { kind: 'update', target: 'Claude plugin marketplace', operation: 'project' },
    ]);
  });

  it('reports a non-mutating diagnostic for an unhealthy installed payload', () => {
    const { project } = fixture(true, 'stable', undefined, { healthyPayload: false });

    const result = installClaudePlugin(project, 'project');

    expect(result.state).toBe('failed');
    expect(result.errors?.[0]?.code).toBe('CLAUDE_PLUGIN_PAYLOAD_UNVERIFIED');
    expect(result.nextActions).toEqual([
      { command: 'safeword claude status', mutates: false, requiresHuman: true },
    ]);
  });

  it('adds an absent marketplace and verifies the persisted host state', () => {
    const { log, project } = fixture(true, 'stable', undefined, {
      marketplaceDeclared: false,
      marketplaceListedReference: false,
    });

    const result = installClaudePlugin(project, 'project');
    expect(result.state).toBe('action_required');
    expect(readFileSync(log, 'utf8')).toContain(
      `plugin marketplace add https://github.com/ArcadeAI/safeword.git#${OFFICIAL_MARKETPLACE_REF} --scope project`,
    );
  });

  it('reports a non-mutating diagnostic when Claude does not persist an added marketplace', () => {
    const { project } = fixture(true, 'stable', undefined, {
      marketplaceAddPersists: false,
      marketplaceDeclared: false,
      marketplaceListedReference: false,
    });

    const result = installClaudePlugin(project, 'project');

    expect(result.state).toBe('failed');
    expect(result.errors?.[0]?.code).toBe('CLAUDE_MARKETPLACE_UNVERIFIED');
    expect(result.nextActions).toEqual([
      {
        command: 'claude plugin marketplace list --json',
        mutates: false,
        requiresHuman: true,
      },
    ]);
  });

  it('observes the real host-reported project installation through the public status view', () => {
    const { project } = fixture(true);

    expect(observeApplicableClaudePlugins(project)).toMatchObject({
      status: 'observed',
      installations: [{ scope: 'project', health: 'current' }],
    });
  });

  it('treats an omitted Claude plugin scope as the default user scope', () => {
    const { project } = fixture(true, 'stable', undefined, { omittedUserScope: true });

    expect(observeApplicableClaudePlugins(project)).toMatchObject({
      status: 'observed',
      installations: [{ scope: 'user', health: 'current' }],
    });
  });

  it('observes a valid Claude plugin inventory larger than 64 KiB', () => {
    const { project } = fixture(true, 'stable', undefined, { largePluginInventory: true });

    expect(observeApplicableClaudePlugins(project)).toMatchObject({
      status: 'observed',
      installations: [{ scope: 'project', health: 'current' }],
    });
  });

  it('reports an actionable error when Claude output exceeds the safety limit', () => {
    const { project } = fixture(true, 'stable', undefined, { oversizedPluginInventory: true });

    expect(observeApplicableClaudePlugins(project)).toMatchObject({
      status: 'errored',
      installations: [],
      message: expect.stringContaining('Claude command output exceeded 10485760 bytes'),
      nextAction: 'repair the reported Claude plugin error',
    });
  });

  it.each([{ oversizedVersionOutput: true }, { oversizedVersionStderr: true }])(
    'reports an operational error when the Claude version probe exceeds its limit',
    state => {
      const { project } = fixture(true, 'stable', undefined, state);

      expect(observeApplicableClaudePlugins(project)).toMatchObject({
        status: 'errored',
        installations: [],
        message: expect.stringContaining('Claude command output exceeded 10485760 bytes'),
        nextAction: 'repair the reported Claude host error',
      });
    },
  );

  it('enables native auto-update for an eligible stable marketplace without disturbing other settings', () => {
    const { log, project, settingsPath } = fixture(undefined);

    const result = installClaudePlugin(project, 'project');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
      env: Record<string, unknown>;
      unrelated: unknown;
      extraKnownMarketplaces: { safeword: { autoUpdate?: boolean } };
    };

    // Installing leaves activation pending until the user runs /reload-plugins,
    // which ZE5RRG Rule NTB1.R2 reports as action_required rather than done.
    expect(result.state, JSON.stringify(result)).toBe('action_required');
    expect(settings.unrelated).toEqual({ keep: true });
    expect(settings.env.CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE).toBe('1');
    expect(settings.extraKnownMarketplaces.safeword.autoUpdate).toBe(true);
    expect(readFileSync(log, 'utf8')).not.toContain('plugin marketplace add');
  });

  it('preserves existing environment settings and an explicit marketplace failure policy', () => {
    const { project, settingsPath } = fixture(true, 'stable', {
      KEEP_ME: 'yes',
      CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE: '0',
    });

    const result = installClaudePlugin(project, 'project');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
      env: Record<string, unknown>;
    };

    expect(result.state, JSON.stringify(result)).toBe('healthy');
    expect(result.nextActions).toEqual([]);
    expect(settings.env).toEqual({
      KEEP_ME: 'yes',
      CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE: '0',
    });
  });

  it('preserves an explicit native auto-update opt-out', () => {
    const { log, project, settingsPath } = fixture(false);
    const before = readFileSync(settingsPath, 'utf8');

    const result = installClaudePlugin(project, 'project');

    expect(result.state, JSON.stringify(result)).toBe('healthy');
    expect(result.nextActions).toEqual([]);
    expect(readFileSync(settingsPath, 'utf8')).toBe(before);
    expect(readFileSync(log, 'utf8')).not.toContain('plugin marketplace add');
  });

  it('does not migrate a stale marketplace while native auto-update is explicitly disabled', () => {
    const { log, project, settingsPath } = fixture(false, 'v0.0.0');
    const before = readFileSync(settingsPath, 'utf8');

    const result = installClaudePlugin(project, 'project');

    expect(result.state).toBe('failed');
    expect((result.data as { classification?: string } | undefined)?.classification).toBe(
      'auto-update-disabled',
    );
    expect(readFileSync(settingsPath, 'utf8')).toBe(before);
    expect(readFileSync(log, 'utf8')).not.toContain('plugin marketplace add');
    expect(readFileSync(log, 'utf8')).not.toContain('plugin list --json');
  });

  it('repairs a GitHub-shorthand registration of the same repository instead of refusing', () => {
    // `claude plugin marketplace add ArcadeAI/safeword` is the form the Claude
    // Code docs lead with; refusing the install strands the project (#3338).
    const { log, project, settingsPath } = fixture(true, 'stable', undefined, {
      marketplaceListedSource: { source: 'github', repo: 'ArcadeAI/safeword' },
    });

    const result = installClaudePlugin(project, 'project');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
      extraKnownMarketplaces: Record<string, unknown>;
    };

    expect(result.state, JSON.stringify(result)).toBe('action_required');
    expect(readFileSync(log, 'utf8')).toContain(
      `plugin marketplace add https://github.com/ArcadeAI/safeword.git#${OFFICIAL_MARKETPLACE_REF} --scope project`,
    );
    expect(result.effects?.configuration).toContainEqual({
      kind: 'update',
      target: 'safeword',
      operation: 'project',
    });
    expect(settings.extraKnownMarketplaces.safeword).toBeDefined();
  });

  it('repairs a project declaration that names the same repository without a ref', () => {
    const { log, project } = fixture(true, 'stable', undefined, {
      marketplaceDeclaredSource: {
        source: 'git',
        url: 'https://github.com/ArcadeAI/safeword.git',
      },
    });

    const result = installClaudePlugin(project, 'project');

    expect(result.state, JSON.stringify(result)).toBe('action_required');
    expect(readFileSync(log, 'utf8')).toContain(
      `plugin marketplace add https://github.com/ArcadeAI/safeword.git#${OFFICIAL_MARKETPLACE_REF} --scope project`,
    );
  });

  it('still refuses a marketplace registered from a different repository, changing nothing', () => {
    const { log, project, settingsPath } = fixture(true, 'stable', undefined, {
      marketplaceListedSource: { source: 'github', repo: 'attacker/safeword' },
    });
    const before = readFileSync(settingsPath, 'utf8');

    const result = installClaudePlugin(project, 'project');

    expect(result.state).toBe('failed');
    expect(result.errors[0]?.code).toBe('CLAUDE_MARKETPLACE_CONFLICT');
    expect(result.errors[0]?.message).toContain('attacker/safeword');
    expect(result.errors[0]?.message).toContain('Safeword changed nothing.');
    expect(readFileSync(settingsPath, 'utf8')).toBe(before);
    expect(readFileSync(log, 'utf8')).not.toContain('plugin marketplace add');
  });

  it('accepts Claude-owned cache metadata beside an otherwise verified plugin', () => {
    const { project } = fixture(
      true,
      'stable',
      { CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE: '1' },
      { cacheMetadata: true },
    );

    expect(installClaudePlugin(project, 'project').state).toBe('healthy');
  });

  it('still rejects an unlisted file inside the cached plugin payload', () => {
    const { project } = fixture(
      true,
      'stable',
      { CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE: '1' },
      { unexpectedPayload: true },
    );

    const result = installClaudePlugin(project, 'project');

    expect(result.state).toBe('failed');
    expect(result.errors[0]?.message).toContain(
      'installed native payload contains an unlisted asset: unexpected-runtime.js',
    );
  });
});
