/**
 * Python-specific Setup Utilities
 *
 * Setup logic for Python projects.
 * Config generators are in files.ts (same pattern as TypeScript and Go).
 *
 * This file contains:
 * - Layer detection for architecture boundaries
 * - Package manager detection for install guidance
 */

import { execSync } from 'node:child_process';
import nodePath from 'node:path';

import { exists, readFileSafe } from '../../utils/fs.js';
import type { SetupResult } from '../types.js';

/**
 * Python layer patterns for architecture detection.
 * Mirrors boundaries.ts ARCHITECTURE_LAYERS pattern.
 *
 * @see .safeword/planning/design/phase2-python-tooling.md → Layer detection heuristic
 */
const PYTHON_LAYERS: Record<string, string[]> = {
  domain: ['domain', 'models', 'entities', 'core'],
  services: ['services', 'usecases', 'application'],
  infra: ['infra', 'infrastructure', 'adapters', 'repositories'],
  api: ['api', 'routes', 'handlers', 'views', 'controllers'],
};

/**
 * Detect Python layers in a project directory.
 * Looks for common Python layer directory patterns.
 *
 * @param cwd - Project root directory
 * @returns Array of detected layer names in dependency order (domain first)
 */
export function detectPythonLayers(cwd: string): string[] {
  const detected: string[] = [];

  for (const [layer, patterns] of Object.entries(PYTHON_LAYERS)) {
    for (const pattern of patterns) {
      // Check common locations: src/{pattern}, {pattern}
      const srcPath = nodePath.join(cwd, 'src', pattern);
      const rootPath = nodePath.join(cwd, pattern);

      if (exists(srcPath) || exists(rootPath)) {
        detected.push(layer);
        break; // Only add layer once
      }
    }
  }

  // Return in correct dependency order (domain → services → infra → api)
  const layerOrder = ['domain', 'services', 'infra', 'api'];
  return layerOrder.filter(layer => detected.includes(layer));
}

/**
 * Detect the root package name from pyproject.toml or directory structure.
 *
 * @param cwd - Project root directory
 * @returns Package name or 'src' as fallback
 */
export function detectRootPackage(cwd: string): string {
  const pyprojectPath = nodePath.join(cwd, 'pyproject.toml');
  const content = readFileSafe(pyprojectPath);

  if (content) {
    // Try to extract name from [project] section
    // Using simple pattern to avoid regex backtracking
    const nameMatch = /^name\s*=\s*"([^"]+)"/m.exec(content);
    if (nameMatch?.[1]) {
      // Convert kebab-case to snake_case for Python imports
      return nameMatch[1].replaceAll('-', '_');
    }
  }

  // Fallback: check for src/ directory
  if (exists(nodePath.join(cwd, 'src'))) {
    return 'src';
  }

  // Last resort: use directory name
  return nodePath.basename(cwd).replaceAll('-', '_');
}

type PythonPackageManager = 'uv' | 'poetry' | 'pipenv' | 'pip';

/**
 * Check if ruff is already declared as a dependency in pyproject.toml.
 * Only checks dependency sections, not [tool.ruff] config.
 */
export function hasRuffDependency(cwd: string): boolean {
  const pyprojectPath = nodePath.join(cwd, 'pyproject.toml');
  const content = readFileSafe(pyprojectPath);
  if (!content) return false;

  // Check for ruff in dependency arrays or Poetry table format:
  // - PEP 621: "ruff", "ruff>=0.1", 'ruff' (quoted in array)
  // - Poetry: ruff = "^0.8.0" (unquoted key)
  // Does NOT match: [tool.ruff]
  return /["']ruff[^"']*["']/.test(content) || /^ruff\s*=/m.test(content);
}

/**
 * Detect the Python package manager used by the project.
 */
export function detectPythonPackageManager(cwd: string): PythonPackageManager {
  // Check for uv (uv.lock or .python-version with uv markers)
  if (exists(nodePath.join(cwd, 'uv.lock'))) {
    return 'uv';
  }

  // Check for Poetry
  if (exists(nodePath.join(cwd, 'poetry.lock'))) {
    return 'poetry';
  }

  // Check for poetry in pyproject.toml
  const pyprojectPath = nodePath.join(cwd, 'pyproject.toml');
  const pyprojectContent = readFileSafe(pyprojectPath);
  if (pyprojectContent?.includes('[tool.poetry]')) {
    return 'poetry';
  }

  // Check for Pipenv
  if (exists(nodePath.join(cwd, 'Pipfile'))) {
    return 'pipenv';
  }

  // Default to pip
  return 'pip';
}

/**
 * Get the install command for Python tools based on package manager.
 *
 * @param cwd - Project root directory
 * @param tools - Tools to install (defaults to ['ruff'])
 */
export function getPythonInstallCommand(cwd: string, tools: string[] = ['ruff']): string {
  const pm = detectPythonPackageManager(cwd);
  const toolList = tools.join(' ');

  switch (pm) {
    case 'uv': {
      return `uv add --dev ${toolList}`;
    }
    case 'poetry': {
      return `poetry add --group dev ${toolList}`;
    }
    case 'pipenv': {
      return `pipenv install --dev ${toolList}`;
    }
    case 'pip': {
      return `pip install ${toolList}`;
    }
  }
}

/**
 * Install Python development dependencies using detected package manager.
 * Matches TypeScript parity where we auto-install ESLint/Prettier.
 *
 * @param cwd - Project root directory
 * @param tools - Tools to install (e.g., ['ruff', 'mypy', 'import-linter'])
 * @returns true if installation succeeded, false otherwise
 */
export function installPythonDependencies(cwd: string, tools: string[]): boolean {
  if (tools.length === 0) return true;
  if (process.env.SAFEWORD_SKIP_INSTALL) return true;

  // pip projects need manual install due to PEP 668
  const pm = detectPythonPackageManager(cwd);
  if (pm === 'pip') return false;

  try {
    execSync(getPythonInstallCommand(cwd, tools), {
      cwd,
      stdio: 'pipe',
      timeout: 60_000, // 60s timeout to prevent hanging on network/resolution issues
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Set up Python tooling configuration.
 *
 * Note: Config files (ruff.toml, mypy.ini, .importlinter) are now created
 * by the schema system (managedFiles) for full reconciliation support.
 * This function exists for future Python-specific setup logic.
 *
 * @returns Empty result (schema handles file creation)
 */
export function setupPythonTooling(): SetupResult {
  // Config files are created by schema.ts managedFiles
  // Future: Add any Python-specific setup logic here
  return { files: [] };
}
