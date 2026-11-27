import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import hostReleases from '../../src/lifecycle/host-releases.json' with { type: 'json' };
import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  runCliWithoutInstall,
} from '../helpers.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) removeTemporaryDirectory(root);
});
function fixture(version: string) {
  const root = createTemporaryDirectory();
  roots.push(root);
  const project = nodePath.join(root, 'project');
  const profile = nodePath.join(root, 'profile');
  const home = nodePath.join(root, 'home');
  const bin = nodePath.join(root, 'bin');
  for (const directory of [project, profile, home, bin]) mkdirSync(directory);
  mkdirSync(nodePath.join(project, '.safeword'));
  writeFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), 'Synthetic retirement project\n');
  writeFileSync(
    nodePath.join(project, 'package.json'),
    '{"name":"retirement-fixture","private":true}\n',
  );
  const config = '{"model":"customer/model","plugins":[]}\n';
  writeFileSync(nodePath.join(profile, 'opencode.jsonc'), config);
  const executable = nodePath.join(bin, 'opencode');
  writeFileSync(
    executable,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then echo ${version}; else exit 99; fi\n`,
  );
  chmodSync(executable, 0o755);
  return {
    project,
    profile,
    config,
    env: { HOME: home, XDG_CONFIG_HOME: home, OPENCODE_CONFIG_DIR: profile, PATH: bin },
  };
}

it('normal public installation cannot generate V1 or silently activate unadmitted V2', async () => {
  const { project, profile, config, env } = fixture(hostReleases.opencode.version);
  const result = await runCliWithoutInstall(
    ['install', '--agents=opencode', '--json', '--no-input', '--offline', '--cwd', project],
    { cwd: project, env },
  );
  expect(result.timedOut).toBe(false);
  expect(result.stderr).toBe('');
  const envelope = JSON.parse(result.stdout);
  expect(envelope.schema_version).toBe(1);
  expect(envelope.errors).toEqual([]);
  expect(
    existsSync(nodePath.join(profile, 'plugins/safeword.js')),
    'OPENCODE_V1_ACTIVE_DELIVERY_REMAINS',
  ).toBe(false);
  for (const directory of ['hooks', 'skills', 'scripts', 'guides'])
    expect(existsSync(nodePath.join(project, '.safeword', directory))).toBe(false);
  expect(envelope.state).toBe('action_required');
  expect(JSON.stringify(envelope)).toContain('OPENCODE_V2_ADMISSION_REQUIRED');
  expect(readFileSync(nodePath.join(profile, 'opencode.jsonc'), 'utf8')).toBe(config);
});

it('discovers only the V2 native registrations and no V1 schema delivery owner', async () => {
  const { PRODUCTION_INTEGRATIONS } = await import('../../src/lifecycle/integrations.js');
  const { discoverNativeHandlers } =
    await import('../../src/host-contract/native-handler-discovery.js');
  const schema = await import('../../src/schema.js');
  const repo = nodePath.resolve(import.meta.dirname, '../../../..');
  const adapter = PRODUCTION_INTEGRATIONS.find(row => row.id === 'opencode');
  if (!adapter?.nativeHandlerSources) throw new Error('Missing OpenCode registration sources');
  const handlers = adapter.nativeHandlerSources.flatMap(source =>
    discoverNativeHandlers(repo, 'opencode', source),
  );
  expect(
    handlers.filter(row => row.source_family === 'opencode-v1'),
    'OPENCODE_V1_REGISTRATION_REMAINS',
  ).toEqual([]);
  expect(
    handlers.filter(row => row.source_family === 'opencode-v2').map(row => row.event),
  ).toContain('tool.execute.before');
  expect(schema).not.toHaveProperty('OPENCODE_PROFILE_LAYOUT');
});

it('requires every V2 case and no retired V1 executable or case', async () => {
  const { openCodePopulation } = await import('../../scripts/lib/opencode-population.js');
  const cases = openCodePopulation();
  const expected = ['cli', 'tui'].flatMap(runtime =>
    [
      'allowed-write',
      'denied-write',
      'catalogue-helper',
      'v2-worker-fresh-context',
      'v2-worker-forbidden-action',
      'v2-required-worker-registration',
      'v2-required-registration',
      'v2-optional-registration',
      'commands',
      'coexistence',
    ].map(suffix => `opencode-v2-2.4.1-${runtime}-${suffix}`),
  );
  expect(cases.map(row => row.id).toSorted((a, b) => a.localeCompare(b))).toEqual(
    expected.toSorted((a, b) => a.localeCompare(b)),
  );
  const targets = JSON.parse(
    readFileSync(
      nodePath.resolve(import.meta.dirname, '../fixtures/host-contract/targets.json'),
      'utf8',
    ),
  ).targets;
  expect(
    targets
      .filter((row: { agent: string }) => row.agent === 'opencode')
      .map((row: { version: string }) => row.version),
  ).toEqual(['2.4.1']);
});

it('public conformance rejects 1.x before host launch and preserves old external files', async () => {
  const { project, profile, env } = fixture('1.18.23');
  const oldPlugin = nodePath.join(profile, 'plugins/safeword.js');
  mkdirSync(nodePath.dirname(oldPlugin));
  writeFileSync(oldPlugin, 'throw new Error("external old plugin must not execute");\n');
  const before = readFileSync(oldPlugin);
  const result = await runCliWithoutInstall(
    ['conformance', '--agents=opencode', '--json', '--no-input', '--offline', '--cwd', project],
    { cwd: project, env },
  );
  expect(result.exitCode).toBe(2);
  const envelope = JSON.parse(result.stdout);
  expect(envelope.state).toBe('action_required');
  expect(JSON.stringify(envelope)).toContain('OPENCODE_VERSION_UNSUPPORTED');
  expect(readFileSync(oldPlugin)).toEqual(before);
});
