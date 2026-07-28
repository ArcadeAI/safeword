import { readdirSync } from 'node:fs';
import nodePath from 'node:path';

import type { ProjectContext } from '../schema.js';
import { exists, readJson, writeJson } from '../utils/fs.js';
import { getWorkspacePatterns } from '../utils/workspaces.js';

interface PackageJson {
  scripts?: Record<string, string>;
}

export function workspacePackageJsonTargets(cwd: string, context: ProjectContext): string[] {
  if (context.projectType.existingFormatter) return [];
  return getWorkspacePatterns(cwd).flatMap(pattern => {
    if (!pattern.endsWith('/*')) return [nodePath.join(pattern, 'package.json')];
    const workspaceRoot = pattern.slice(0, -2);
    const fullPath = nodePath.join(cwd, workspaceRoot);
    if (!exists(fullPath)) return [];
    try {
      return readdirSync(fullPath, { withFileTypes: true }).flatMap(entry =>
        entry.isDirectory() && !entry.name.startsWith('.')
          ? [nodePath.join(workspaceRoot, entry.name, 'package.json')]
          : [],
      );
    } catch {
      return [];
    }
  });
}

function addFormatScriptIfMissing(packageDirectory: string): boolean {
  const packageJsonPath = nodePath.join(packageDirectory, 'package.json');
  if (!exists(packageJsonPath)) return false;

  const packageJson = readJson(packageJsonPath) as PackageJson | undefined;
  if (packageJson === undefined || packageJson.scripts?.format !== undefined) return false;

  packageJson.scripts = {
    format: 'prettier --write .',
    ...packageJson.scripts,
  };
  writeJson(packageJsonPath, packageJson);
  return true;
}

function processGlobWorkspacePattern(cwd: string, workspacePath: string): string[] {
  const fullPath = nodePath.join(cwd, workspacePath);
  if (!exists(fullPath)) return [];

  try {
    return readdirSync(fullPath, { withFileTypes: true }).flatMap(entry => {
      if (!entry.isDirectory() || entry.name.startsWith('.')) return [];
      const relativePackageJson = nodePath.join(workspacePath, entry.name, 'package.json');
      return addFormatScriptIfMissing(nodePath.join(fullPath, entry.name))
        ? [relativePackageJson]
        : [];
    });
  } catch {
    return [];
  }
}

export function setupWorkspaceFormatScripts(cwd: string, context: ProjectContext): string[] {
  if (context.projectType.existingFormatter) return [];

  return getWorkspacePatterns(cwd).flatMap(pattern => {
    if (pattern.endsWith('/*')) {
      return processGlobWorkspacePattern(cwd, pattern.slice(0, -2));
    }
    return addFormatScriptIfMissing(nodePath.join(cwd, pattern))
      ? [nodePath.join(pattern, 'package.json')]
      : [];
  });
}
