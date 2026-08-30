import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseAgentSelection } from '../../src/cli-protocol/agent-selection.js';
import { createResult } from '../../src/cli-protocol/result.js';
import { installLifecycle, uninstallLifecycle } from '../../src/lifecycle/commands.js';
import {
  generateOpenCodeProfilePlugin,
  installOpenCodeProfile,
  observeOpenCodeProfile,
  type OpenCodeIdentityV1,
  openCodeProfilePaths,
  reconcileOpenCodeProfile,
  resolveOpenCodeConfigRoot,
  uninstallOpenCodeProfile,
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

  it('rejects a relative explicit OpenCode config root instead of falling back', () => {
    const home = temporaryDirectory();

    expect(
      resolveOpenCodeConfigRoot({
        platform: 'unix',
        env: { OPENCODE_CONFIG_DIR: 'relative/profile', HOME: home },
      }),
    ).toBeUndefined();
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
    expect(installedIdentity.dispatcher_path).toBe(paths.dispatcher);
    expect(existsSync(installedIdentity.dispatcher_path)).toBe(true);
    expect(installedIdentity.dispatcher_sha256).toBe(
      createHash('sha256').update(readFileSync(installedIdentity.dispatcher_path)).digest('hex'),
    );
  });

  it('TBU1.R3 removes recognized profile assets through the public lifecycle', async () => {
    const project = temporaryDirectory();
    const root = temporaryDirectory();
    vi.stubEnv('OPENCODE_CONFIG_DIR', root);
    const invocation = {
      cwd: project,
      noInput: true,
      offline: false,
      operands: [],
      options: { agents: 'opencode', modify: false },
    } as const;
    const adapters = {
      installClaude: () => Promise.resolve(createResult({ state: 'healthy' })),
      installCodex: () => Promise.resolve(createResult({ state: 'healthy' })),
    };
    const installed = await installLifecycle(invocation, adapters);
    expect(installed.state).toBe('changed');
    const paths = openCodeProfilePaths(root);
    const managedSkill = nodePath.join(root, 'skills/safeword-verify/SKILL.md');
    expect(existsSync(managedSkill)).toBe(true);
    mkdirSync(paths.activation, { recursive: true });
    mkdirSync(paths.conformance, { recursive: true });
    writeFileSync(paths.profileError, '{}\n');

    const preview = await uninstallLifecycle(invocation);
    const plan = (preview.data as { readonly plan: { readonly id: string } }).plan.id;
    const result = await uninstallLifecycle({
      ...invocation,
      options: { ...invocation.options, yes: true, plan },
    });

    expect(result.state).toBe('changed');
    for (const path of [
      paths.plugin,
      paths.identity,
      paths.dispatcher,
      paths.activation,
      paths.conformance,
      paths.profileError,
      managedSkill,
    ]) {
      expect(existsSync(path)).toBe(false);
    }
    expect(existsSync(nodePath.join(root, 'skills/safeword-verify'))).toBe(false);
  });

  it('preserves a modified managed catalogue asset during uninstall', () => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);
    expect(installOpenCodeProfile(root).state).toBe('changed');
    const managedSkill = nodePath.join(root, 'skills/safeword-verify/SKILL.md');
    writeFileSync(managedSkill, 'user-modified skill\n');

    const result = uninstallOpenCodeProfile(root);

    expect(result.state).toBe('action_required');
    expect(result.findings.map(finding => finding.code)).toContain('OPENCODE_MANAGED_ASSET_DRIFT');
    expect(readFileSync(managedSkill, 'utf8')).toBe('user-modified skill\n');
    expect(existsSync(paths.identity)).toBe(true);
  });

  it('removes an unchanged catalogue asset retired by the next profile identity', () => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);
    expect(installOpenCodeProfile(root).state).toBe('changed');
    const retiredRelativePath = 'skills/safeword-retired/SKILL.md';
    const retiredPath = nodePath.join(root, retiredRelativePath);
    const retiredContent = 'retired managed skill\n';
    mkdirSync(nodePath.dirname(retiredPath), { recursive: true });
    writeFileSync(retiredPath, retiredContent);
    const installedIdentity = JSON.parse(
      readFileSync(paths.identity, 'utf8'),
    ) as OpenCodeIdentityV1;
    writeFileSync(
      paths.identity,
      `${JSON.stringify({
        ...installedIdentity,
        assets: [
          ...(installedIdentity.assets ?? []),
          {
            path: retiredRelativePath,
            sha256: createHash('sha256').update(retiredContent).digest('hex'),
          },
        ],
      })}\n`,
    );

    expect(installOpenCodeProfile(root).state).toBe('changed');
    expect(existsSync(retiredPath)).toBe(false);
  });

  it('reports and repairs a missing managed catalogue asset', () => {
    const root = temporaryDirectory();
    expect(installOpenCodeProfile(root).state).toBe('changed');
    const managedSkill = nodePath.join(root, 'skills/safeword-verify/SKILL.md');
    rmSync(managedSkill);

    const observed = observeOpenCodeProfile(root);
    expect(observed.state).toBe('action_required');
    expect(observed.findings.map(finding => finding.code)).toContain(
      'OPENCODE_CATALOGUE_ASSET_MISSING',
    );

    expect(installOpenCodeProfile(root).state).toBe('changed');
    expect(existsSync(managedSkill)).toBe(true);
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

  it('preserves a colliding plugin through the packaged install path', () => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);
    mkdirSync(nodePath.dirname(paths.plugin), { recursive: true });
    writeFileSync(paths.plugin, 'unrecognized user bytes\n');

    const result = installOpenCodeProfile(root);

    expect(result.state).toBe('action_required');
    expect(readFileSync(paths.plugin, 'utf8')).toBe('unrecognized user bytes\n');
    expect(existsSync(paths.identity)).toBe(false);
    expect(existsSync(paths.dispatcher)).toBe(false);
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

  it('preserves a modified managed dispatcher during uninstall', () => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);
    expect(installOpenCodeProfile(root).state).toBe('changed');
    writeFileSync(paths.dispatcher, 'user-modified dispatcher\n');

    const result = uninstallOpenCodeProfile(root);

    expect(result.state).toBe('action_required');
    expect(result.findings.map(finding => finding.code)).toContain('OPENCODE_DISPATCHER_DRIFT');
    expect(readFileSync(paths.dispatcher, 'utf8')).toBe('user-modified dispatcher\n');
    expect(existsSync(paths.plugin)).toBe(true);
    expect(existsSync(paths.identity)).toBe(true);
  });

  it.each(['missing', 'modified'] as const)(
    'repairs a %s managed dispatcher during install',
    state => {
      const root = temporaryDirectory();
      const paths = openCodeProfilePaths(root);
      expect(installOpenCodeProfile(root).state).toBe('changed');
      const expected = readFileSync(paths.dispatcher);
      if (state === 'missing') rmSync(paths.dispatcher);
      else writeFileSync(paths.dispatcher, 'modified dispatcher\n');

      expect(installOpenCodeProfile(root).state).toBe('changed');
      expect(readFileSync(paths.dispatcher)).toEqual(expected);
      expect(installOpenCodeProfile(root).state).toBe('healthy');
    },
  );

  it('preserves the canonical dispatcher when identity points elsewhere during uninstall', () => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);
    expect(installOpenCodeProfile(root).state).toBe('changed');
    const canonical = readFileSync(paths.dispatcher);
    const installed = JSON.parse(readFileSync(paths.identity, 'utf8')) as OpenCodeIdentityV1;
    writeFileSync(
      paths.identity,
      `${JSON.stringify({ ...installed, dispatcher_path: nodePath.join(root, 'other.js') })}\n`,
    );

    const result = uninstallOpenCodeProfile(root);

    expect(result.state).toBe('action_required');
    expect(result.findings.map(finding => finding.code)).toContain('OPENCODE_DISPATCHER_DRIFT');
    expect(readFileSync(paths.dispatcher)).toEqual(canonical);
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

  it('waits briefly for a concurrent profile transaction and then converges', async () => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);
    const child = spawn(
      process.execPath,
      [
        '-e',
        [
          "const { mkdirSync, rmSync, writeFileSync } = require('node:fs');",
          "const { dirname, join } = require('node:path');",
          'const lock = process.argv[1];',
          'mkdirSync(dirname(lock), { recursive: true });',
          'mkdirSync(lock);',
          "writeFileSync(join(lock, 'owner.json'), JSON.stringify({ owner: 'peer', acquired_at: Date.now() }));",
          "process.stdout.write('ready');",
          'setTimeout(() => rmSync(lock, { recursive: true, force: true }), 75);',
        ].join(''),
        paths.lock,
      ],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    await once(child.stdout, 'data');
    const childExit = once(child, 'exit');

    const result = reconcileOpenCodeProfile({
      operation: 'install',
      root,
      pluginBytes,
      identity: identity(),
    });
    await childExit;

    expect(result.state).toBe('changed');
    expect(readFileSync(paths.plugin, 'utf8')).toBe(pluginBytes);
  });
});
