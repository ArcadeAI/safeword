import { spawnSync } from 'node:child_process';
import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { release } from 'node:os';
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
  metadata: Record<string, ToolDetails>;
}

export interface ToolDetails {
  path: string;
  sha256: string;
  version?: string;
  version_probe?: string;
  execution_path?: string;
  kind?: 'file' | 'directory';
}

export function toolPath(tools: Tools, name: string): string {
  const path = tools.paths[name];
  if (path === undefined) throw new Error(`Missing bound tool ${name}`);
  return path;
}

function resolveTool(name: string, root: string): string {
  const packageBins =
    name === 'codex'
      ? [
          nodePath.join(root, 'packages/cli/node_modules/.bin'),
          nodePath.join(root, 'node_modules/.bin'),
        ]
      : [];
  const directories = [...packageBins, ...(process.env.PATH ?? '').split(nodePath.delimiter)];
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

export function toolInventory(root: string): Tools {
  const paths = Object.fromEntries(toolNames.map(name => [name, resolveTool(name, root)]));
  const identities: Record<string, string> = {};
  const metadata: Record<string, ToolDetails> = {};
  for (const [name, path] of Object.entries(paths)) {
    const bytes = readFileSync(path);
    const sha256 = digest(bytes);
    identities[`tool:${name}`] = digest(canonical({ path, sha256 }));
    metadata[name] = { path, sha256, kind: 'file' };
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
  const inventory = { paths, identities, metadata };
  const versions = pinnedRuntimeVersions(inventory);
  for (const [name, version] of Object.entries(versions)) {
    const details = metadata[name];
    if (details === undefined) throw new Error(`Missing tool metadata ${name}`);
    details.version = version;
  }
  addCodexComponents(inventory);
  identities['environment:policy'] = digest(
    canonical({
      version: 1,
      platform: process.platform,
      arch: process.arch,
      os_release: release(),
      node: versions.node,
      bun: versions.bun,
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
  return inventory;
}

function pinnedRuntimeVersions(tools: Tools): { node: string; bun: string } {
  const node = spawnSync(toolPath(tools, 'node'), ['--version'], {
    encoding: 'utf8',
    timeout: 5000,
    env: {},
  });
  const bun = spawnSync(toolPath(tools, 'bun'), ['--version'], {
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
  return { node: node.stdout.trim(), bun: bun.stdout.trim() };
}

function addCodexComponents(tools: Tools): void {
  const launcher = toolPath(tools, 'codex');
  if (!launcher.endsWith('.js')) return;
  const platformPackage = `@openai/codex-${process.platform}-${process.arch}`;
  const manifest = createRequire(launcher).resolve(`${platformPackage}/package.json`);
  const packageRoot = nodePath.dirname(manifest);
  const matches: string[] = [];
  function visit(directory: string): void {
    for (const name of readdirSync(directory)) {
      const path = nodePath.join(directory, name);
      const info = lstatSync(path);
      if (info.isDirectory()) visit(path);
      else if (info.isFile() && ['codex', 'codex.exe'].includes(name)) matches.push(path);
    }
  }
  visit(nodePath.join(packageRoot, 'vendor'));
  if (matches.length !== 1)
    throw new Error('Codex platform binary is ambiguous; restore frozen installed dependencies');
  const binary = matches[0];
  if (binary === undefined) throw new Error('Codex platform binary is missing');
  const sha256 = digest(readFileSync(binary));
  tools.metadata['codex-platform'] = { path: binary, sha256, kind: 'file' };
  tools.identities['tool:codex-platform'] = digest(canonical({ path: binary, sha256 }));
  const packageSha256 = treeIdentity(packageRoot, '.');
  tools.metadata['codex-platform-package'] = {
    path: packageRoot,
    sha256: packageSha256,
    kind: 'directory',
  };
  tools.identities['tool:codex-platform-package'] = packageSha256;
}

/** Extra version probes use an isolated home only while observing; verification stays read-only. */
export function executionToolDetails(
  tools: Tools,
  root: string,
  clone: string,
  environment: NodeJS.ProcessEnv,
  probeHome: string,
): Record<string, ToolDetails> {
  const metadata = structuredClone(tools.metadata);
  for (const details of Object.values(metadata)) {
    const relative = nodePath.relative(root, details.path);
    details.execution_path =
      relative.startsWith('..') || nodePath.isAbsolute(relative)
        ? details.path
        : nodePath.join(clone, relative);
  }
  rebindExecutionTools(tools, metadata, environment);
  const probeEnvironment = {
    ...environment,
    HOME: probeHome,
    CODEX_HOME: nodePath.join(probeHome, '.codex'),
    XDG_CONFIG_HOME: nodePath.join(probeHome, 'config'),
    XDG_STATE_HOME: nodePath.join(probeHome, 'state'),
    XDG_CACHE_HOME: nodePath.join(probeHome, 'cache'),
  };
  for (const name of ['git', 'codex', 'mise', 'tar']) {
    const details = metadata[name];
    if (details === undefined) throw new Error(`Missing version-probe identity ${name}`);
    const path = details.execution_path ?? details.path;
    Object.assign(details, probeToolVersion(tools, path, probeEnvironment, probeHome));
  }
  return metadata;
}

function rebindExecutionTools(
  tools: Tools,
  metadata: Record<string, ToolDetails>,
  environment: NodeJS.ProcessEnv,
): void {
  const bin = environment.PATH?.split(nodePath.delimiter)[0];
  if (!bin) throw new Error('Missing isolated tool directory');
  for (const name of Object.keys(tools.paths)) {
    const execution = metadata[name]?.execution_path;
    if (execution === undefined) throw new Error(`Missing execution tool ${name}`);
    const link = nodePath.join(bin, name);
    unlinkSync(link);
    symlinkSync(execution, link);
  }
}

function probeToolVersion(
  tools: Tools,
  path: string,
  environment: NodeJS.ProcessEnv,
  home: string,
): Pick<ToolDetails, 'version' | 'version_probe'> {
  const script = path.endsWith('.js');
  const result = spawnSync(
    script ? toolPath(tools, 'node') : path,
    script ? [path, '--version'] : ['--version'],
    { cwd: home, env: environment, encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 },
  );
  if (result.status === 0 && result.stdout.trim() !== '') {
    return { version: result.stdout.trim().split('\n', 1)[0], version_probe: 'isolated --version' };
  }
  return {
    version_probe: result.error?.message ?? result.signal ?? `exit ${result.status ?? 'unknown'}`,
  };
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
