/**
 * Project type detection from package.json
 *
 * Detects frameworks and tools used in the project to configure
 * appropriate linting rules.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { LANGUAGE_PACKS } from '../packs/registry.js';
import type { Languages, ProjectType } from '../packs/types.js';
import { detect } from '../presets/typescript/detect.js';
import { findInTree } from './fs.js';

const { TAILWIND_PACKAGES, TANSTACK_QUERY_PACKAGES, hasExistingLinter, hasExistingFormatter } =
  detect;

// Python project file markers (used by detectPythonType and config detection)
const PYPROJECT_TOML = 'pyproject.toml';
const REQUIREMENTS_TXT = 'requirements.txt';
const UV_LOCK = 'uv.lock';

// Rust config file markers
const CLIPPY_CONFIG_FILES = ['clippy.toml', '.clippy.toml'];
const RUSTFMT_CONFIG_FILES = ['rustfmt.toml', '.rustfmt.toml'];

// ESLint config file markers (flat config and legacy)
const ESLINT_CONFIG_FILES = [
  'eslint.config.mjs',
  'eslint.config.js',
  'eslint.config.cjs',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yml',
  '.eslintrc.yaml',
] as const;

// golangci-lint config file markers
const GOLANGCI_CONFIG_FILES = [
  '.golangci.yml',
  '.golangci.yaml',
  '.golangci.toml',
  '.golangci.json',
];

// Python frameworks to detect (order matters - first match wins)
const PYTHON_FRAMEWORKS = ['django', 'flask', 'fastapi'] as const;

export interface PackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  main?: string;
  module?: string;
  exports?: unknown;
  types?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Python-specific detection (returned only if languages.python)
 * @see ARCHITECTURE.md → Language Detection
 */
export interface PythonProjectType {
  framework: 'django' | 'flask' | 'fastapi' | undefined;
  packageManager: 'poetry' | 'uv' | 'pip';
}

/**
 * Detects which languages are used in the project
 * @param cwd - Working directory to scan
 * @returns Languages object indicating which languages are present
 * @see ARCHITECTURE.md → Language Detection
 */
export function detectLanguages(cwd: string): Languages {
  // Delegate to each pack's detect() method — single source of truth.
  // TypeScript pack checks root-only (subdirectory package.json is too common).
  // All other packs use recursive tree scanning via existsInTree().
  const { typescript, python, golang, rust, sql } = LANGUAGE_PACKS;
  return {
    javascript: typescript.detect(cwd),
    python: python.detect(cwd),
    golang: golang.detect(cwd),
    rust: rust.detect(cwd),
    sql: sql.detect(cwd),
  };
}

/**
 * Detects Python project type (framework and package manager)
 * @param cwd - Working directory to scan
 * @returns PythonProjectType or undefined if not a Python project
 * @see ARCHITECTURE.md → Language Detection
 */
export function detectPythonType(cwd: string): PythonProjectType | undefined {
  // Search root and immediate subdirectories for Python manifests
  const pyprojectDirectory = findInTree(cwd, PYPROJECT_TOML);
  const requirementsDirectory = findInTree(cwd, REQUIREMENTS_TXT);

  // Determine manifest directory — pyproject.toml takes priority
  const manifestDirectory = pyprojectDirectory ?? requirementsDirectory;
  if (!manifestDirectory) {
    return undefined;
  }

  // Read project file for dependency/tool detection
  const content = pyprojectDirectory
    ? readFileSync(nodePath.join(pyprojectDirectory, PYPROJECT_TOML), 'utf8')
    : readFileSync(nodePath.join(manifestDirectory, REQUIREMENTS_TXT), 'utf8');

  // Detect package manager (priority: poetry > uv > pip)
  let packageManager: PythonProjectType['packageManager'] = 'pip';
  if (pyprojectDirectory && content.includes('[tool.poetry]')) {
    packageManager = 'poetry';
  } else if (existsSync(nodePath.join(manifestDirectory, UV_LOCK))) {
    packageManager = 'uv';
  }

  // Detect framework (first match wins)
  const contentLower = content.toLowerCase();
  const framework = PYTHON_FRAMEWORKS.find(fw => contentLower.includes(fw));

  return { framework, packageManager };
}

/**
 * Checks if a directory contains any .sh files up to specified depth.
 * Excludes node_modules and .git directories.
 * @param cwd
 * @param maxDepth
 */
function hasShellScripts(cwd: string, maxDepth = 4): boolean {
  const excludeDirectories = new Set(['node_modules', '.git', '.safeword']);

  function scan(dir: string, depth: number): boolean {
    if (depth > maxDepth) return false;

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.sh')) {
          return true;
        }
        if (
          entry.isDirectory() &&
          !excludeDirectories.has(entry.name) &&
          scan(nodePath.join(dir, entry.name), depth + 1)
        ) {
          return true;
        }
      }
    } catch {
      // Ignore permission errors
    }
    return false;
  }

  return scan(cwd, 0);
}

interface PackageJsonWithScripts extends PackageJson {
  scripts?: Record<string, string>;
}

/** Returns the first file from candidates that exists in cwd, or undefined. */
function findFirstExisting(cwd: string, candidates: readonly string[]): string | undefined {
  return candidates.find(file => existsSync(nodePath.join(cwd, file)));
}

/**
 * Check if project has existing ESLint config.
 * @param cwd - Working directory to scan
 * @returns The config file path if found, undefined otherwise.
 */
function findExistingEslintConfig(cwd: string): string | undefined {
  return findFirstExisting(cwd, ESLINT_CONFIG_FILES);
}

/**
 * Find existing Ruff config location.
 * @param cwd - Working directory to scan
 * @returns 'ruff.toml' if standalone config exists, 'pyproject.toml' if [tool.ruff] exists, undefined if none
 */
function findExistingRuffConfig(cwd: string): 'ruff.toml' | 'pyproject.toml' | undefined {
  // Check for standalone ruff.toml first (takes precedence)
  if (existsSync(nodePath.join(cwd, 'ruff.toml'))) return 'ruff.toml';

  // Check for [tool.ruff] in pyproject.toml
  const pyprojectPath = nodePath.join(cwd, PYPROJECT_TOML);
  if (!existsSync(pyprojectPath)) return undefined;
  try {
    const content = readFileSync(pyprojectPath, 'utf8');
    return content.includes('[tool.ruff]') ? 'pyproject.toml' : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Check if project has existing mypy config.
 * @param cwd - Working directory to scan
 * @returns True if mypy.ini/.mypy.ini exists OR [tool.mypy] in pyproject.toml
 */
function hasExistingMypyConfig(cwd: string): boolean {
  // Check for standalone mypy config files
  if (existsSync(nodePath.join(cwd, 'mypy.ini'))) return true;
  if (existsSync(nodePath.join(cwd, '.mypy.ini'))) return true;

  // Check for [tool.mypy] in pyproject.toml
  const pyprojectPath = nodePath.join(cwd, PYPROJECT_TOML);
  if (!existsSync(pyprojectPath)) return false;
  try {
    const content = readFileSync(pyprojectPath, 'utf8');
    return content.includes('[tool.mypy]');
  } catch {
    return false;
  }
}

/**
 * Check if project has existing import-linter config.
 * @param cwd - Working directory to scan
 * @returns True if .importlinter exists OR [tool.importlinter] in pyproject.toml
 */
function hasExistingImportLinterConfig(cwd: string): boolean {
  // Check for standalone .importlinter file
  if (existsSync(nodePath.join(cwd, '.importlinter'))) return true;

  // Check for [tool.importlinter] in pyproject.toml
  const pyprojectPath = nodePath.join(cwd, PYPROJECT_TOML);
  if (!existsSync(pyprojectPath)) return false;
  try {
    const content = readFileSync(pyprojectPath, 'utf8');
    return content.includes('[tool.importlinter]');
  } catch {
    return false;
  }
}

// SQLFluff config file markers
const SQLFLUFF_CONFIG_FILES = ['.sqlfluff', 'setup.cfg'];

/**
 * Detect JavaScript framework dependencies from package.json.
 */
function detectFrameworks(
  deps: Record<string, string>,
  developmentDeps: Record<string, string>,
  allDeps: Record<string, string>,
): Pick<
  ProjectType,
  | 'typescript'
  | 'react'
  | 'nextjs'
  | 'astro'
  | 'vitest'
  | 'playwright'
  | 'tailwind'
  | 'tanstackQuery'
> {
  const hasNextJs = 'next' in deps;
  return {
    typescript: 'typescript' in allDeps,
    react: 'react' in deps || 'react' in developmentDeps || hasNextJs,
    nextjs: hasNextJs,
    astro: 'astro' in deps || 'astro' in developmentDeps,
    vitest: 'vitest' in developmentDeps,
    playwright: '@playwright/test' in developmentDeps,
    tailwind: TAILWIND_PACKAGES.some(pkg => pkg in allDeps),
    tanstackQuery: TANSTACK_QUERY_PACKAGES.some(pkg => pkg in allDeps),
  };
}

/**
 * Detect if package is publishable (has entry points and not private).
 */
function detectPublishable(packageJson: PackageJsonWithScripts): boolean {
  const hasEntryPoints = !!(packageJson.main || packageJson.module || packageJson.exports);
  return hasEntryPoints && packageJson.private !== true;
}

/**
 * Detect existing JS/TS/Python tooling configuration.
 */
function detectCoreTooling(
  cwd: string | undefined,
  scripts: Record<string, string>,
): Pick<
  ProjectType,
  | 'existingLinter'
  | 'existingFormatter'
  | 'existingEslintConfig'
  | 'legacyEslint'
  | 'existingRuffConfig'
  | 'existingMypyConfig'
  | 'existingImportLinterConfig'
> {
  const eslintConfig = cwd ? findExistingEslintConfig(cwd) : undefined;
  return {
    existingLinter: hasExistingLinter(scripts),
    existingFormatter: cwd ? hasExistingFormatter(cwd, scripts) : 'format' in scripts,
    existingEslintConfig: eslintConfig,
    legacyEslint: eslintConfig?.startsWith('.eslintrc') ?? false,
    existingRuffConfig: cwd ? findExistingRuffConfig(cwd) : undefined,
    existingMypyConfig: cwd ? hasExistingMypyConfig(cwd) : false,
    existingImportLinterConfig: cwd ? hasExistingImportLinterConfig(cwd) : false,
  };
}

/**
 * Detect existing Go/Rust tooling configuration.
 */
function detectSystemsTooling(
  cwd: string | undefined,
): Pick<
  ProjectType,
  | 'existingGolangciConfig'
  | 'existingClippyConfig'
  | 'existingRustfmtConfig'
  | 'existingSqlfluffConfig'
> {
  return {
    existingGolangciConfig: cwd ? findFirstExisting(cwd, GOLANGCI_CONFIG_FILES) : undefined,
    existingClippyConfig: cwd ? findFirstExisting(cwd, CLIPPY_CONFIG_FILES) : undefined,
    existingRustfmtConfig: cwd ? findFirstExisting(cwd, RUSTFMT_CONFIG_FILES) : undefined,
    existingSqlfluffConfig: cwd ? findFirstExisting(cwd, SQLFLUFF_CONFIG_FILES) : undefined,
  };
}

/**
 * Detect existing tooling configuration from file system.
 */
function detectExistingTooling(
  cwd: string | undefined,
  scripts: Record<string, string>,
): Pick<
  ProjectType,
  | 'existingLinter'
  | 'existingFormatter'
  | 'existingEslintConfig'
  | 'legacyEslint'
  | 'existingRuffConfig'
  | 'existingMypyConfig'
  | 'existingImportLinterConfig'
  | 'existingGolangciConfig'
  | 'existingClippyConfig'
  | 'existingRustfmtConfig'
  | 'existingSqlfluffConfig'
> {
  return {
    ...detectCoreTooling(cwd, scripts),
    ...detectSystemsTooling(cwd),
  };
}

/**
 * Detects project type from package.json contents and optional file scanning
 * @param packageJson - Package.json contents including scripts
 * @param cwd - Working directory for file-based detection
 */
export function detectProjectType(packageJson: PackageJsonWithScripts, cwd?: string): ProjectType {
  const deps = packageJson.dependencies ?? {};
  const developmentDeps = packageJson.devDependencies ?? {};
  const allDeps = { ...deps, ...developmentDeps };
  const scripts = packageJson.scripts ?? {};

  return {
    ...detectFrameworks(deps, developmentDeps, allDeps),
    publishableLibrary: detectPublishable(packageJson),
    shell: cwd ? hasShellScripts(cwd) : false,
    ...detectExistingTooling(cwd, scripts),
  };
}

export { type Languages, type ProjectType } from '../packs/types.js';
