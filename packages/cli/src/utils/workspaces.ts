/**
 * Workspace Utilities
 *
 * Helpers for detecting and resolving workspace members in monorepos.
 */

import { readdirSync } from 'node:fs';
import nodePath from 'node:path';

import { exists, readJson } from './fs.js';

interface PackageJson {
  name?: string;
  workspaces?: string[] | { packages?: string[] };
}

/** Get workspace glob patterns from package.json */
export function getWorkspacePatterns(cwd: string): string[] {
  const packageJson = readJson(nodePath.join(cwd, 'package.json')) as PackageJson | undefined;
  if (!packageJson?.workspaces) return [];

  return Array.isArray(packageJson.workspaces)
    ? packageJson.workspaces
    : (packageJson.workspaces.packages ?? []);
}

/** Read the package name from a directory's package.json, or undefined. */
function readPackageName(directory: string): string | undefined {
  const packageJson = readJson(nodePath.join(directory, 'package.json')) as PackageJson | undefined;
  return packageJson?.name;
}

/** List subdirectory paths under a parent directory (skips dotfiles). */
function listSubdirectories(parentPath: string): string[] {
  try {
    return readdirSync(parentPath, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => nodePath.join(parentPath, entry.name));
  } catch {
    return [];
  }
}

/** Resolve a single workspace pattern to member directories. */
function resolvePattern(cwd: string, pattern: string): string[] {
  const isGlob = pattern.endsWith('/*');
  const basePath = isGlob ? pattern.slice(0, -2) : pattern;
  const fullPath = nodePath.join(cwd, basePath);

  if (!exists(fullPath)) return [];
  return isGlob ? listSubdirectories(fullPath) : [fullPath];
}

/** Resolve workspace patterns to a set of member package names. */
export function getWorkspacePackageNames(cwd: string): Set<string> {
  const patterns = getWorkspacePatterns(cwd);
  const names = new Set<string>();

  for (const pattern of patterns) {
    for (const directory of resolvePattern(cwd, pattern)) {
      const name = readPackageName(directory);
      if (name) names.add(name);
    }
  }

  return names;
}
