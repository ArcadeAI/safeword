import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  installClaudePlugin,
  observeApplicableClaudePlugins,
  observeClaudeProfile,
} from '../../src/claude-plugin/profile.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';
import { createTemporaryDirectory } from '../helpers.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const directories: string[] = [];
const originalPath = process.env.PATH;
const originalProjectDirectory = process.env.CLAUDE_PROJECT_DIR;

interface FixtureState {
  readonly healthyPayload?: boolean;
  readonly installedVersion?: string | false;
  readonly marketplaceAddPersists?: boolean;
  readonly marketplaceDeclared?: boolean;
  readonly marketplaceListedReference?: string | false;
  readonly pluginEnabled?: boolean;
}

function initializeFixtureState(root: string, ref: string, state: FixtureState) {
  const installedState = nodePath.join(root, 'installed');
  const enabledState = nodePath.join(root, 'enabled');
  const marketplaceState = nodePath.join(root, 'marketplace');
  const installPath =
    state.healthyPayload === false
      ? nodePath.join(root, 'broken-plugin')
      : nodePath.join(REPO_ROOT, 'plugin');
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
  const settingsPath = nodePath.join(project, '.claude/settings.json');
  directories.push(root);
  mkdirSync(nodePath.dirname(settingsPath), { recursive: true });
  mkdirSync(bin);
  const { enabledState, installedState, installPath, marketplaceState } = initializeFixtureState(
    root,
    ref,
    state,
  );
  const declaration: Record<string, unknown> = {
    source: { source: 'git', url: 'https://github.com/ArcadeAI/safeword.git', ref },
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
        source: { source: 'git', url: 'https://github.com/ArcadeAI/safeword.git', ref: 'stable' },
      },
    },
  });
  const persistMarketplace =
    state.marketplaceAddPersists === false
      ? ':'
      : `printf 'stable\\n' > ${JSON.stringify(marketplaceState)}\nprintf '%s\\n' ${JSON.stringify(persistedMarketplaceSettings)} > ${JSON.stringify(settingsPath)}`;
  const executable = nodePath.join(bin, 'claude');
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
printf '%s\n' "$*" >> ${JSON.stringify(log)}
case "$*" in
  '--version') echo '2.1.170' ;;
  'plugin marketplace list --json')
    if [ -f ${JSON.stringify(marketplaceState)} ]; then
      marketplace_ref=$(cat ${JSON.stringify(marketplaceState)})
      printf '[{"name":"safeword","source":{"url":"https://github.com/ArcadeAI/safeword.git","ref":"%s"}}]\n' "$marketplace_ref"
    else
      echo '[]'
    fi
    ;;
  'plugin marketplace add https://github.com/ArcadeAI/safeword.git#stable --scope project') ${persistMarketplace} ;;
  'plugin list --json')
    if [ -f ${JSON.stringify(installedState)} ]; then
      plugin_version=$(cat ${JSON.stringify(installedState)})
      plugin_enabled=false
      if [ -f ${JSON.stringify(enabledState)} ]; then plugin_enabled=true; fi
      printf '[{"id":"safeword@safeword","scope":"project","projectPath":${JSON.stringify(project)},"version":"%s","enabled":%s,"installPath":${JSON.stringify(installPath)}}]\n' "$plugin_version" "$plugin_enabled"
    else
      echo '[]'
    fi
    ;;
  'plugin install safeword@safeword --scope project')
    printf '%s\n' ${JSON.stringify(SAFEWORD_SCHEMA.version)} > ${JSON.stringify(installedState)}
    touch ${JSON.stringify(enabledState)}
    ;;
  'plugin update safeword@safeword --scope project') printf '%s\n' ${JSON.stringify(SAFEWORD_SCHEMA.version)} > ${JSON.stringify(installedState)} ;;
  'plugin enable safeword@safeword --scope project') touch ${JSON.stringify(enabledState)} ;;
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
  if (originalProjectDirectory === undefined) delete process.env.CLAUDE_PROJECT_DIR;
  else process.env.CLAUDE_PROJECT_DIR = originalProjectDirectory;
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  directories.length = 0;
});

describe('Claude marketplace update enrollment', () => {
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

    const result = installClaudePlugin(project);

    expect(result.state).toBe('changed');
    expect(readFileSync(log, 'utf8')).toContain('plugin install safeword@safeword --scope project');
  });

  it('updates and re-enables a disabled older plugin through the real Claude command boundary', () => {
    const { log, project } = fixture(true, 'stable', undefined, {
      installedVersion: '0.72.0',
      pluginEnabled: false,
    });

    const result = installClaudePlugin(project);
    const commands = readFileSync(log, 'utf8');

    expect(result.state).toBe('changed');
    expect(commands).toContain('plugin update safeword@safeword --scope project');
    expect(commands).toContain('plugin enable safeword@safeword --scope project');
    expect(result.effects?.network).toEqual([
      { kind: 'update', target: 'Claude plugin marketplace', operation: 'project' },
    ]);
  });

  it('reports a non-mutating diagnostic for an unhealthy installed payload', () => {
    const { project } = fixture(true, 'stable', undefined, { healthyPayload: false });

    const result = installClaudePlugin(project);

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

    const result = installClaudePlugin(project);

    expect(result.state).toBe('changed');
    expect(readFileSync(log, 'utf8')).toContain(
      'plugin marketplace add https://github.com/ArcadeAI/safeword.git#stable --scope project',
    );
  });

  it('reports a non-mutating diagnostic when Claude does not persist an added marketplace', () => {
    const { project } = fixture(true, 'stable', undefined, {
      marketplaceAddPersists: false,
      marketplaceDeclared: false,
      marketplaceListedReference: false,
    });

    const result = installClaudePlugin(project);

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

  it('observes the real host-reported project installation through both public status views', () => {
    const { project } = fixture(true);

    expect(observeApplicableClaudePlugins(project)).toMatchObject({
      status: 'observed',
      installations: [{ scope: 'project', health: 'current' }],
    });
    expect(observeClaudeProfile(project)).toMatchObject({
      health: 'current',
      plugin: { id: 'safeword@safeword', scope: 'project' },
    });
  });

  it('enables native auto-update for an eligible stable marketplace without disturbing other settings', () => {
    const { log, project, settingsPath } = fixture(undefined);

    const result = installClaudePlugin(project);
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
      env: Record<string, unknown>;
      unrelated: unknown;
      extraKnownMarketplaces: { safeword: { autoUpdate?: boolean } };
    };

    expect(result.state).toBe('changed');
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

    const result = installClaudePlugin(project);
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
      env: Record<string, unknown>;
    };

    expect(result.state).toBe('healthy');
    expect(settings.env).toEqual({
      KEEP_ME: 'yes',
      CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE: '0',
    });
  });

  it('preserves an explicit native auto-update opt-out', () => {
    const { log, project, settingsPath } = fixture(false);
    const before = readFileSync(settingsPath, 'utf8');

    const result = installClaudePlugin(project);

    expect(result.state).toBe('healthy');
    expect(readFileSync(settingsPath, 'utf8')).toBe(before);
    expect(readFileSync(log, 'utf8')).not.toContain('plugin marketplace add');
  });

  it('does not migrate a stale marketplace while native auto-update is explicitly disabled', () => {
    const { log, project, settingsPath } = fixture(false, `v${SAFEWORD_SCHEMA.version}`);
    const before = readFileSync(settingsPath, 'utf8');

    const result = installClaudePlugin(project);

    expect(result.state).toBe('failed');
    expect((result.data as { classification?: string } | undefined)?.classification).toBe(
      'auto-update-disabled',
    );
    expect(readFileSync(settingsPath, 'utf8')).toBe(before);
    expect(readFileSync(log, 'utf8')).not.toContain('plugin marketplace add');
    expect(readFileSync(log, 'utf8')).not.toContain('plugin list --json');
  });
});
