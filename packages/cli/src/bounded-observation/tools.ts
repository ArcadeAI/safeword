import { spawnSync } from 'node:child_process';
import {
  accessSync,
  constants,
  existsSync,
  readFileSync,
  realpathSync,
  symlinkSync,
} from 'node:fs';
import nodePath from 'node:path';

import { canonical, digest, profileSha256 } from './contract.js';
import { treeIdentity } from './identity.js';

const toolNames = [
  'node',
  'bun',
  'git',
  'codex',
  'mise',
  'tar',
  'sh',
  'bash',
  'env',
  'which',
  'dirname',
  'basename',
  'pwd',
  'grep',
  'sed',
  'cat',
  'chmod',
  'mkdir',
  'cp',
  'rm',
  'sleep',
  'touch',
  'head',
  'uname',
];

export interface Tools {
  paths: Record<string, string>;
  identities: Record<string, string>;
}

export function toolPath(tools: Tools, name: string): string {
  const path = tools.paths[name];
  if (path === undefined) throw new Error(`Missing bound tool ${name}`);
  return path;
}

function resolveTool(name: string): string {
  const directories = (process.env.PATH ?? '').split(nodePath.delimiter);
  for (const directory of directories) {
    if (!nodePath.isAbsolute(directory)) continue;
    const path = nodePath.join(directory, name);
    try {
      accessSync(path, constants.X_OK);
      return realpathSync(path);
    } catch {
      /* Try the next declared search directory; never execute a shell lookup. */
    }
  }
  throw new Error(`Missing required local tool ${name}; restore the pinned toolchain and rerun`);
}

export function toolInventory(): Tools {
  const paths = Object.fromEntries(toolNames.map(name => [name, resolveTool(name)]));
  const identities: Record<string, string> = {};
  for (const [name, path] of Object.entries(paths)) {
    const bytes = readFileSync(path);
    identities[`tool:${name}`] = digest(canonical({ path, sha256: digest(bytes) }));
  }
  for (const path of [
    '/bin/sh',
    '/bin/bash',
    '/usr/bin/env',
    '/usr/bin/grep',
    '/usr/bin/git',
    '/usr/bin/tar',
  ]) {
    if (existsSync(path)) identities[`tool:absolute:${path}`] = digest(readFileSync(path));
  }
  const inventory = { paths, identities };
  const node = spawnSync(toolPath(inventory, 'node'), ['--version'], {
    encoding: 'utf8',
    timeout: 5000,
    env: {},
  });
  const bun = spawnSync(toolPath(inventory, 'bun'), ['--version'], {
    encoding: 'utf8',
    timeout: 5000,
    env: {},
  });
  if (
    node.status !== 0 ||
    node.stdout.trim() !== 'v24.18.1' ||
    bun.status !== 0 ||
    bun.stdout.trim() !== '1.3.14'
  ) {
    throw new Error(
      'Pinned Node 24.18.1 and Bun 1.3.14 are required; run mise install and scripts/dev',
    );
  }
  identities['environment:policy'] = digest(
    canonical({
      version: 1,
      platform: process.platform,
      arch: process.arch,
      node: node.stdout.trim(),
      bun: bun.stdout.trim(),
      home: 'isolated',
      locale: 'C',
      timezone: 'UTC',
      credentials: 'excluded',
      retry: 0,
    }),
  );
  identities['runtime:profile'] = profileSha256;
  identities['runtime:module'] = runtimeIdentity();
  const entry = process.argv[1];
  if (entry !== undefined)
    identities['runtime:entrypoint'] = digest(readFileSync(realpathSync(entry)));
  return { paths, identities };
}

export function runtimeIdentity(): string {
  const filename = import.meta.filename;
  const directory = import.meta.dirname;
  const moduleDigest = digest(readFileSync(filename));
  if (filename.endsWith('.ts')) {
    const packageRoot = nodePath.resolve(directory, '../..');
    const manifest = nodePath.join(packageRoot, 'package.json');
    const packageDigest = digest(readFileSync(manifest));
    return digest(
      canonical({
        module: moduleDigest,
        source: treeIdentity(packageRoot, 'src'),
        package: packageDigest,
      }),
    );
  }
  if (nodePath.basename(directory) === 'dist') {
    const packageRoot = nodePath.dirname(directory);
    const manifest = nodePath.join(packageRoot, 'package.json');
    const packageDigest = digest(readFileSync(manifest));
    return digest(
      canonical({
        module: moduleDigest,
        distribution: treeIdentity(packageRoot, 'dist'),
        package: packageDigest,
      }),
    );
  }
  // Native plugin builds are a single bundled CLI, including the shipped profile.
  return moduleDigest;
}

export function controlledEnvironment(
  tools: Tools,
  bin: string,
  home: string,
  temporary: string,
): NodeJS.ProcessEnv {
  for (const [name, path] of Object.entries(tools.paths))
    symlinkSync(path, nodePath.join(bin, name));
  return {
    PATH: bin,
    HOME: home,
    XDG_CONFIG_HOME: nodePath.join(home, 'config'),
    XDG_STATE_HOME: nodePath.join(home, 'state'),
    XDG_CACHE_HOME: nodePath.join(home, 'cache'),
    TMPDIR: temporary,
    TMP: temporary,
    TEMP: temporary,
    LANG: 'C',
    LC_ALL: 'C',
    TZ: 'UTC',
    SAFEWORD_NO_UPDATE_CHECK: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_TERMINAL_PROMPT: '0',
    CI: '1',
    NO_COLOR: '1',
  };
}
