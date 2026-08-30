import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import nodePath from 'node:path';

import { assertCodexPluginCatalogue } from '../../src/codex-plugin/catalogue.ts';

function isDescendant(path: string, parent: string): boolean {
  const relative = nodePath.relative(parent, path);
  return relative !== '' && !relative.startsWith(`..${nodePath.sep}`) && relative !== '..';
}

function requireFile(path: string, description: string): void {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`${description} is missing or is not a file: ${path}`);
  }
}

export function parsePluginInstalledPath(pluginAddJson: string): string {
  let result: unknown;
  try {
    result = JSON.parse(pluginAddJson) as unknown;
  } catch {
    throw new Error('Codex plugin add did not return valid JSON');
  }

  if (
    typeof result !== 'object' ||
    result === null ||
    !('installedPath' in result) ||
    typeof result.installedPath !== 'string' ||
    result.installedPath.length === 0
  ) {
    throw new Error('Codex plugin add JSON has no installedPath');
  }

  return result.installedPath;
}

/** Verify the installed plugin is a real Codex cache copy, not a marketplace link or project copy. */
export function assertCachedCodexPlugin(
  cliRoot: string,
  codexHome: string,
  installedPath: string,
): string {
  const cacheRoot = nodePath.join(codexHome, 'plugins/cache');
  if (!existsSync(cacheRoot)) {
    throw new Error(`Codex plugin cache directory is missing: ${cacheRoot}`);
  }
  if (!existsSync(installedPath) || lstatSync(installedPath).isSymbolicLink()) {
    throw new Error(`Codex installedPath is not a real cache directory: ${installedPath}`);
  }
  if (!statSync(installedPath).isDirectory()) {
    throw new Error(`Codex installedPath is not a real cache directory: ${installedPath}`);
  }

  const resolvedCacheRoot = realpathSync(cacheRoot);
  const resolvedInstalledPath = realpathSync(installedPath);
  if (!isDescendant(resolvedInstalledPath, resolvedCacheRoot)) {
    throw new Error(`Codex installedPath is outside the plugin cache: ${resolvedInstalledPath}`);
  }

  requireFile(
    nodePath.join(resolvedInstalledPath, '.codex-plugin/plugin.json'),
    'Cached plugin manifest',
  );
  requireFile(nodePath.join(resolvedInstalledPath, 'hooks.json'), 'Cached plugin hooks');
  requireFile(
    nodePath.join(resolvedInstalledPath, 'package.json'),
    'Cached plugin package identity',
  );
  requireFile(nodePath.join(resolvedInstalledPath, 'runtime/cli.js'), 'Cached plugin CLI runtime');
  const version = (
    JSON.parse(readFileSync(nodePath.join(cliRoot, 'package.json'), 'utf8')) as { version: string }
  ).version;
  assertCodexPluginCatalogue(
    nodePath.join(cliRoot, 'templates/skills'),
    resolvedInstalledPath,
    version,
  );
  return resolvedInstalledPath;
}
