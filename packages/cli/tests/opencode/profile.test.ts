import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseAgentSelection } from '../../src/cli-protocol/agent-selection.js';
import { createResult } from '../../src/cli-protocol/result.js';
import { installLifecycle } from '../../src/lifecycle/commands.js';
import {
  generateOpenCodeProfilePlugin,
  type OpenCodeIdentityV1,
  openCodeProfilePaths,
  reconcileOpenCodeProfile,
  resolveOpenCodeConfigRoot,
} from '../../src/opencode/profile.js';
import { acquireProfileLock, releaseProfileLock } from '../../src/utils/profile-lock.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const temporaryDirectories: string[] = [];
const pluginBytes = 'export const SafewordPlugin = {}\n';

function temporaryDirectory(): string {
  const directory = createTemporaryDirectory();
  temporaryDirectories.push(directory);
  return directory;
}

function identity(): OpenCodeIdentityV1 {
  const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
  return {
    schema_version: 1,
    safeword_version: '0.79.4',
    plugin_path: 'plugins/safeword.js',
    plugin_sha256: digest(pluginBytes),
    runtime_path: '/runtime/node',
    dispatcher_path: '/runtime/safeword-dispatcher.js',
    dispatcher_sha256: digest('dispatcher'),
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories) removeTemporaryDirectory(directory);
  temporaryDirectories.length = 0;
  vi.unstubAllEnvs();
});

describe('OpenCode profile boundary', () => {
  it('TBU1.R1.S08 rejects USERPROFILE as a Unix fallback without touching the decoy', () => {
    const userProfile = temporaryDirectory();
    const decoy = nodePath.join(userProfile, '.config/opencode/decoy.txt');
    mkdirSync(nodePath.dirname(decoy), { recursive: true });
    writeFileSync(decoy, 'user bytes\n');

    expect(
      resolveOpenCodeConfigRoot({
        platform: 'unix',
        env: { USERPROFILE: userProfile },
      }),
    ).toBeUndefined();
    expect(readFileSync(decoy, 'utf8')).toBe('user bytes\n');
  });

  it('TBU1.R1.S08 stops explicit installation before project reconciliation', async () => {
    const project = temporaryDirectory();
    const userProfile = temporaryDirectory();
    const decoy = nodePath.join(userProfile, '.config/opencode/decoy.txt');
    mkdirSync(nodePath.dirname(decoy), { recursive: true });
    writeFileSync(decoy, 'user bytes\n');
    vi.stubEnv('OPENCODE_CONFIG_DIR', '');
    vi.stubEnv('XDG_CONFIG_HOME', '');
    vi.stubEnv('HOME', '');
    vi.stubEnv('USERPROFILE', userProfile);

    const result = await installLifecycle(
      {
        cwd: project,
        noInput: true,
        offline: false,
        operands: [],
        options: { agents: 'opencode', modify: false },
      },
      {
        installClaude: () => Promise.resolve(createResult({ state: 'healthy' })),
        installCodex: () => Promise.resolve(createResult({ state: 'healthy' })),
      },
    );

    expect(result.state).toBe('action_required');
    expect(existsSync(nodePath.join(project, '.safeword'))).toBe(false);
    expect(existsSync(nodePath.join(project, '.opencode'))).toBe(false);
    expect(readFileSync(decoy, 'utf8')).toBe('user bytes\n');
  });

  it('accepts explicit OpenCode selection without changing the default integrations', () => {
    expect(parseAgentSelection('opencode')).toEqual({
      ok: true,
      selection: { agents: ['opencode'] },
    });
    expect(parseAgentSelection(undefined)).toEqual({
      ok: true,
      selection: { agents: ['claude', 'codex'] },
    });
  });

  it('TBU1.R1.S07 installs generated profile bytes and an executable identity binding', async () => {
    const project = temporaryDirectory();
    const root = temporaryDirectory();
    vi.stubEnv('OPENCODE_CONFIG_DIR', root);

    const result = await installLifecycle(
      {
        cwd: project,
        noInput: true,
        offline: false,
        operands: [],
        options: { agents: 'opencode', modify: false },
      },
      {
        installClaude: () => Promise.resolve(createResult({ state: 'healthy' })),
        installCodex: () => Promise.resolve(createResult({ state: 'healthy' })),
      },
    );

    const paths = openCodeProfilePaths(root);
    expect(result.state).toBe('changed');
    expect(readFileSync(paths.plugin, 'utf8')).toBe(generateOpenCodeProfilePlugin());
    const installedIdentity = JSON.parse(
      readFileSync(paths.identity, 'utf8'),
    ) as OpenCodeIdentityV1;
    expect(installedIdentity.runtime_path).toBe(process.execPath);
    expect(nodePath.isAbsolute(installedIdentity.dispatcher_path)).toBe(true);
    expect(existsSync(installedIdentity.dispatcher_path)).toBe(true);
    expect(installedIdentity.dispatcher_sha256).toBe(
      createHash('sha256').update(readFileSync(installedIdentity.dispatcher_path)).digest('hex'),
    );
  });

  it.each([
    ['plugin', 'install'],
    ['plugin', 'uninstall'],
    ['identity', 'install'],
    ['identity', 'uninstall'],
  ] as const)('TBU1.R3.S04 preserves a colliding %s during %s', (profilePath, operation) => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);
    const collisionPath = profilePath === 'plugin' ? paths.plugin : paths.identity;
    const otherPath = profilePath === 'plugin' ? paths.identity : paths.plugin;
    mkdirSync(nodePath.dirname(collisionPath), { recursive: true });
    writeFileSync(collisionPath, 'unrecognized user bytes\n');

    const result = reconcileOpenCodeProfile({
      operation,
      root,
      pluginBytes,
      identity: identity(),
    });

    expect(result.state).toBe('action_required');
    expect(result.changed).toBe(false);
    expect(result.findings).toHaveLength(1);
    expect(readFileSync(collisionPath, 'utf8')).toBe('unrecognized user bytes\n');
    expect(existsSync(otherPath)).toBe(false);
  });

  it('publishes and removes one recognized profile under the shared lock', () => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);

    expect(
      reconcileOpenCodeProfile({
        operation: 'install',
        root,
        pluginBytes,
        identity: identity(),
      }).state,
    ).toBe('changed');
    expect(readFileSync(paths.plugin, 'utf8')).toBe(pluginBytes);
    expect(JSON.parse(readFileSync(paths.identity, 'utf8'))).toEqual(identity());

    expect(
      reconcileOpenCodeProfile({
        operation: 'install',
        root,
        pluginBytes,
        identity: identity(),
      }).state,
    ).toBe('healthy');
    expect(
      reconcileOpenCodeProfile({
        operation: 'uninstall',
        root,
        pluginBytes,
        identity: identity(),
      }).state,
    ).toBe('changed');
    expect(existsSync(paths.plugin)).toBe(false);
    expect(existsSync(paths.identity)).toBe(false);
  });

  it('does not mutate while another profile transaction owns the lock', () => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);
    const lock = acquireProfileLock(paths.lock, { owner: 'other-install' });
    if (lock === undefined) throw new Error('Expected the fixture to acquire its profile lock.');

    const result = reconcileOpenCodeProfile({
      operation: 'install',
      root,
      pluginBytes,
      identity: identity(),
    });

    expect(result.state).toBe('action_required');
    expect(existsSync(paths.plugin)).toBe(false);
    expect(existsSync(paths.identity)).toBe(false);
    expect(releaseProfileLock(lock)).toBe(true);
  });
});
