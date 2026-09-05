import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import nodePath from 'node:path';

import { assertCodexPluginCatalogue } from '../../src/codex-plugin/catalogue.js';

function commandFailure(command: string, stderr: string, status: number | null): Error {
  const detail = stderr.trim();
  const detailSuffix = detail ? `: ${detail}` : '';
  return new Error(`${command} failed with status ${String(status)}${detailSuffix}`);
}

function requireDirectory(directory: string, description: string): void {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    throw new Error(`${description} is missing or is not a directory: ${directory}`);
  }
}

function relativeFiles(directory: string, prefix = ''): string[] {
  return readdirSync(nodePath.join(directory, prefix), { withFileTypes: true })
    .flatMap(entry => {
      const relativePath = nodePath.join(prefix, entry.name);
      if (entry.isDirectory()) return relativeFiles(directory, relativePath);
      return entry.isFile() ? [relativePath] : [];
    })
    .toSorted((left, right) => left.localeCompare(right));
}

function assertMatchingTree(expectedDirectory: string, actualDirectory: string): void {
  requireDirectory(expectedDirectory, 'Expected generated tree');
  requireDirectory(actualDirectory, 'Packed generated tree');
  const expectedFiles = relativeFiles(expectedDirectory);
  const actualFiles = relativeFiles(actualDirectory);
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error('Packed Codex plugin generated tree does not match its source tree');
  }

  for (const relativePath of expectedFiles) {
    const expected = readFileSync(nodePath.join(expectedDirectory, relativePath));
    const actual = readFileSync(nodePath.join(actualDirectory, relativePath));
    if (!actual.equals(expected)) {
      throw new Error(`Packed Codex plugin generated artifact differs: ${relativePath}`);
    }
  }
}

export function packCliPackage(packageRoot: string, destination: string): string {
  const result = spawnSync('bun', ['pm', 'pack', '--destination', destination, '--quiet'], {
    cwd: packageRoot,
    encoding: 'utf8',
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw commandFailure('bun pm pack', result.stderr, result.status);
  }

  const archives = readdirSync(destination)
    .filter(entry => entry.endsWith('.tgz'))
    .toSorted((left, right) => left.localeCompare(right));
  if (archives.length !== 1 || archives[0] === undefined) {
    throw new Error(`bun pm pack created ${archives.length} tarballs; expected exactly one`);
  }

  return nodePath.join(destination, archives[0]);
}

export function extractPackedCliPackage(archive: string, destination: string): string {
  const extractionDirectory = nodePath.join(destination, 'extracted');
  mkdirSync(extractionDirectory, { recursive: true });

  const result = spawnSync('tar', ['-xzf', archive, '-C', extractionDirectory], {
    encoding: 'utf8',
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw commandFailure('tar -xzf', result.stderr, result.status);
  }

  const packageDirectory = nodePath.join(extractionDirectory, 'package');
  requireDirectory(packageDirectory, 'Packed CLI package');
  return packageDirectory;
}

export function assertPackedCodexPlugin(cliRoot: string, packageDirectory: string): void {
  const pluginDirectory = nodePath.join(packageDirectory, 'codex-plugin');
  requireDirectory(pluginDirectory, 'Packed Codex plugin');

  for (const artifact of [
    '.codex-plugin/plugin.json',
    'hooks.json',
    'package.json',
    'runtime/cli.js',
  ]) {
    const artifactPath = nodePath.join(pluginDirectory, artifact);
    if (!existsSync(artifactPath) || !statSync(artifactPath).isFile()) {
      throw new Error(`Packed Codex plugin is missing required artifact: ${artifact}`);
    }
  }

  const version = (
    JSON.parse(readFileSync(nodePath.join(cliRoot, 'package.json'), 'utf8')) as { version: string }
  ).version;
  assertMatchingTree(
    nodePath.join(cliRoot, 'codex-plugin/templates'),
    nodePath.join(pluginDirectory, 'templates'),
  );
  assertCodexPluginCatalogue(nodePath.join(cliRoot, 'templates/skills'), pluginDirectory, version);
}
