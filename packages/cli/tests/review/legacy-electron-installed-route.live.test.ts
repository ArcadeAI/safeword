import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import {
  assertCachedCodexPlugin,
  parsePluginInstalledPath,
} from '../helpers/codex-plugin-cache.js';
import { extractPackedCliPackage, packCliPackage } from '../helpers/codex-plugin-package.js';
import { electronRequest } from './legacy-electron-runner.fixture.js';

// Explicit live/release lane: real Codex installation, no model calls or credentials.
it('loads the retrospective observation route from a supported cache install after source removal', () => {
  const temporary = mkdtempSync(path.join(tmpdir(), 'safeword-electron-installed-route-'));
  const project = path.join(temporary, 'project');
  const profile = path.join(temporary, 'profile');
  const packed = path.join(temporary, 'packed');
  const marketplace = path.join(temporary, 'marketplace');
  const cliRoot = path.resolve(import.meta.dirname, '../..');
  try {
    for (const directory of [project, profile, packed]) mkdirSync(directory);
    const extracted = extractPackedCliPackage(packCliPackage(cliRoot, packed), packed);
    mkdirSync(path.join(marketplace, '.agents/plugins'), { recursive: true });
    mkdirSync(path.join(marketplace, 'plugins'));
    symlinkSync(path.join(extracted, 'codex-plugin'), path.join(marketplace, 'plugins/safeword'));
    writeFileSync(
      path.join(marketplace, '.agents/plugins/marketplace.json'),
      JSON.stringify({
        name: 'retrospective-route-smoke',
        owner: { name: 'Safeword tests' },
        plugins: [
          {
            name: 'safeword',
            source: { source: 'local', path: './plugins/safeword' },
            policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
            category: 'Developer Tools',
          },
        ],
      }),
    );
    const environment = { ...process.env, CODEX_HOME: profile };
    const run = (command: string, args: string[]) =>
      spawnSync(command, args, {
        cwd: project,
        env: environment,
        encoding: 'utf8',
        timeout: 60_000,
      });
    const added = run('codex', ['plugin', 'marketplace', 'add', marketplace, '--json']);
    expect(added.status, added.stderr).toBe(0);
    const installed = run('codex', [
      'plugin',
      'add',
      'safeword@retrospective-route-smoke',
      '--json',
    ]);
    expect(installed.status, installed.stderr).toBe(0);
    const cache = assertCachedCodexPlugin(
      cliRoot,
      profile,
      parsePluginInstalledPath(installed.stdout),
    );
    rmSync(marketplace, { recursive: true, force: true });
    rmSync(packed, { recursive: true, force: true });
    expect(existsSync(extracted)).toBe(false);
    writeFileSync(
      path.join(project, 'proof.json'),
      JSON.stringify({ ...electronRequest, build: '/live/private-build' }),
    );
    const observed = run('bun', [
      path.join(cache, 'runtime/cli.js'),
      '--cwd',
      project,
      '--json',
      '--no-input',
      'review',
      'observe',
      'retrospective',
      '--request',
      'proof.json',
    ]);
    expect(observed.status).not.toBe(0);
    const response = JSON.parse(observed.stdout);
    expect(response).toMatchObject({
      state: 'failed',
      data: { command: 'review observe retrospective', status: 'blocked' },
    });
    expect(response.errors[0].message).toMatch(/unsupported fields:.*build/u);
    expect(observed.stdout).not.toContain('private-build');
    expect(existsSync(path.join(project, '.safeword/state/reviews'))).toBe(false);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}, 120_000);
