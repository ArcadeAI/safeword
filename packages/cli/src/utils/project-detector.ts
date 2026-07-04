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
import { isShippedCucumberTemplateRevision } from './cucumber-template-revisions.js';
import { findInTree, readFileSafe, readJson } from './fs.js';

const {
  TAILWIND_PACKAGES,
  TANSTACK_QUERY_PACKAGES,
  hasExistingLinter,
  hasExistingFormatter,
  hasExistingPrettierConfig,
} = detect;

// Python project file markers (used by detectPythonType and config detection)
const PYPROJECT_TOML = 'pyproject.toml';
const REQUIREMENTS_TXT = 'requirements.txt';
const UV_LOCK = 'uv.lock';

// Rust config file markers
const CLIPPY_CONFIG_FILES = ['clippy.toml', '.clippy.toml'];
const RUSTFMT_CONFIG_FILES = ['rustfmt.toml', '.rustfmt.toml'];

// ESLint config file markers (flat config and legacy)
const ESLINT_CONFIG_FILES = [
  'eslint.config.ts',
  'eslint.config.mts',
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
  const hasLanguage = (key: string): boolean => LANGUAGE_PACKS[key]?.detect(cwd) ?? false;
  return {
    javascript: hasLanguage('typescript'),
    python: hasLanguage('python'),
    golang: hasLanguage('golang'),
    rust: hasLanguage('rust'),
    sql: hasLanguage('sql'),
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
  const content = readFileSync(
    pyprojectDirectory
      ? nodePath.join(pyprojectDirectory, PYPROJECT_TOML)
      : nodePath.join(manifestDirectory, REQUIREMENTS_TXT),
    'utf8',
  );

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
  dependencies: Record<string, string>,
  developmentDependencies: Record<string, string>,
  allDependencies: Record<string, string>,
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
  const hasNextJs = 'next' in dependencies;
  return {
    typescript: 'typescript' in allDependencies,
    react: 'react' in dependencies || 'react' in developmentDependencies || hasNextJs,
    nextjs: hasNextJs,
    astro: 'astro' in dependencies || 'astro' in developmentDependencies,
    vitest: 'vitest' in developmentDependencies,
    playwright: '@playwright/test' in developmentDependencies,
    tailwind: TAILWIND_PACKAGES.some(pkg => Object.hasOwn(allDependencies, pkg)),
    tanstackQuery: TANSTACK_QUERY_PACKAGES.some(pkg => Object.hasOwn(allDependencies, pkg)),
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
  | 'existingPrettierConfig'
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
    existingPrettierConfig: cwd ? hasExistingPrettierConfig(cwd) : false,
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
  | 'existingPrettierConfig'
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
// JS/TS application-source detection — distinguishes a real JS project from a
// pure Python/Go/Rust repo that only carries safeword's TS BDD lane (ticket 102b).
// Gates JS-app-only tooling (knip, dependency-cruiser) so non-JS repos don't get it.
const JS_SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
]);
const JS_SOURCE_DIR_EXCLUDE = new Set([
  'node_modules',
  '.git',
  '.safeword',
  'dist',
  'build',
  'target',
  'coverage',
  'vendor',
]);
// Root-level lane scaffolding + safeword-owned files are NOT "real" JS source.
const LANE_DIRS = new Set(['steps', 'features']);
const LANE_FILES = new Set(['cucumber.mjs', 'eslint.config.mjs', '.prettierrc']);

/** A directory to skip while scanning for JS source (excludes + the root-level lane). */
function isExcludedSourceDirectory(name: string, depth: number): boolean {
  if (name.startsWith('.') || JS_SOURCE_DIR_EXCLUDE.has(name)) return true;
  return depth === 0 && LANE_DIRS.has(name); // root steps/ features/ are the BDD lane
}

/** A file that counts as real JS/TS application source (not root-level lane scaffolding). */
function isJsSourceFile(name: string, depth: number): boolean {
  if (depth === 0 && LANE_FILES.has(name)) return false;
  return JS_SOURCE_EXTENSIONS.has(nodePath.extname(name));
}

function scanForJsSource(directory: string, depth: number, maxDepth: number): boolean {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.isFile()) {
      if (isJsSourceFile(entry.name, depth)) return true;
      continue;
    }
    if (!entry.isDirectory() || depth >= maxDepth || isExcludedSourceDirectory(entry.name, depth))
      continue;
    if (scanForJsSource(nodePath.join(directory, entry.name), depth + 1, maxDepth)) return true;
  }
  return false;
}

/**
 * True if the repo has real JS/TS application source — not just safeword's TS BDD
 * lane scaffolding. Stable across `setup` and `upgrade` (it reads source, not the
 * stub `package.json`), so it can gate JS-app-only tooling off non-JS projects.
 */
export function hasJsSource(cwd: string, maxDepth = 6): boolean {
  return scanForJsSource(cwd, 0, maxDepth);
}

// The cucumber-js config filename safeword scaffolds its own lane as. Load-bearing
// for own-scaffold identity: its membership in the discovery list (below), the
// self-exclusion in detectCucumberHarnessEvidence, and the own-lane probe in
// detectCucumberLane must all name the same file so a scaffold rename stays in lockstep.
const SAFEWORD_LANE_CONFIG_FILE = 'cucumber.mjs';

// Cucumber-js native config discovery order (first wins). A root config with
// any of these names is a harness safeword must not compete with — except
// safeword's own scaffolded cucumber.mjs, excluded by content match below.
const CUCUMBER_CONFIG_FILES = [
  'cucumber.json',
  'cucumber.yaml',
  'cucumber.yml',
  'cucumber.js',
  'cucumber.cjs',
  SAFEWORD_LANE_CONFIG_FILE,
] as const;

/**
 * True when the file is safeword's own lane scaffold: a hash-match against a
 * shipped template revision (so upgrades from older safewords never read
 * their own lane as a host harness). The current template is always in the
 * registry — the cucumber-template-revisions contract test enforces it — so
 * no separate byte-compare against the bundled template is needed.
 */
function isSafewordLaneTemplate(configPath: string): boolean {
  const content = readFileSafe(configPath);
  return content !== undefined && isShippedCucumberTemplateRevision(content);
}

// Direct workspace-package radius for harness evidence — the same
// conventional roots feature-source.ts scans for feature files.
const WORKSPACE_PACKAGE_ROOTS = ['packages', 'apps', 'libs', 'modules'] as const;

function manifestDependsOnCucumber(manifestPath: string): boolean {
  const manifest = readJson(manifestPath) as
    | { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
    | undefined;
  return Boolean(
    manifest?.dependencies?.['@cucumber/cucumber'] ??
    manifest?.devDependencies?.['@cucumber/cucumber'],
  );
}

/**
 * Cucumber evidence inside one workspace package: a config file of any name
 * (no self-exclusion — safeword only ever scaffolds the lane at the root) or
 * a @cucumber/cucumber dependency.
 */
function findCucumberEvidenceInPackage(cwd: string, packagePath: string): string | undefined {
  for (const name of CUCUMBER_CONFIG_FILES) {
    if (existsSync(nodePath.join(cwd, packagePath, name))) {
      return `${packagePath}/${name}`;
    }
  }
  if (manifestDependsOnCucumber(nodePath.join(cwd, packagePath, 'package.json'))) {
    return `${packagePath}/package.json (@cucumber/cucumber)`;
  }
  return undefined;
}

/** First cucumber config file or dep under `<cwd>/<root>/*`, as evidence. */
function findCucumberEvidenceUnderRoot(cwd: string, root: string): string | undefined {
  let entries;
  try {
    entries = readdirSync(nodePath.join(cwd, root), { withFileTypes: true });
  } catch {
    return undefined;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const evidence = findCucumberEvidenceInPackage(cwd, `${root}/${entry.name}`);
    if (evidence !== undefined) return evidence;
  }
  return undefined;
}

/** First direct workspace package with cucumber evidence (config file or dep). */
function detectWorkspaceCucumberDependency(cwd: string): string | undefined {
  for (const root of WORKSPACE_PACKAGE_ROOTS) {
    const evidence = findCucumberEvidenceUnderRoot(cwd, root);
    if (evidence !== undefined) return evidence;
  }
  return undefined;
}

export interface CucumberLaneDetection {
  existingCucumberHarness: string | undefined;
  scaffoldBddLane: boolean;
}

/** Host-harness evidence: first foreign config file, else workspace dep, else root dep. */
function detectCucumberHarnessEvidence(cwd: string, ownLanePresent: boolean): string | undefined {
  for (const name of CUCUMBER_CONFIG_FILES) {
    const configPath = nodePath.join(cwd, name);
    if (!existsSync(configPath)) continue;
    if (name === SAFEWORD_LANE_CONFIG_FILE && ownLanePresent) continue;
    return name;
  }

  const workspaceEvidence = detectWorkspaceCucumberDependency(cwd);
  if (workspaceEvidence !== undefined) return workspaceEvidence;

  // A root dep with safeword's scaffolded lane present is safeword's own
  // install, not host evidence — otherwise every existing install would
  // self-trigger detection at upgrade (the 56JCFZ self-trigger trap).
  if (!ownLanePresent && manifestDependsOnCucumber(nodePath.join(cwd, 'package.json'))) {
    return 'package.json (@cucumber/cucumber)';
  }
  return undefined;
}

/**
 * Detect a cucumber harness safeword did not scaffold, and whether the
 * starter lane is safeword's to scaffold/maintain (ticket 56JCFZ).
 * Evidence and suppression are deliberately separate: a bitten repo (own
 * lane + host harness) keeps lane maintenance while advisories surface the
 * duplicate; a fresh repo with a host harness gets no lane at all.
 */
export function detectCucumberLane(cwd: string | undefined): CucumberLaneDetection {
  if (!cwd) return { existingCucumberHarness: undefined, scaffoldBddLane: true };

  const ownLanePresent = isSafewordLaneTemplate(nodePath.join(cwd, SAFEWORD_LANE_CONFIG_FILE));
  const evidence = detectCucumberHarnessEvidence(cwd, ownLanePresent);
  return {
    existingCucumberHarness: evidence,
    scaffoldBddLane: ownLanePresent || evidence === undefined,
  };
}

export function detectProjectType(packageJson: PackageJsonWithScripts, cwd?: string): ProjectType {
  const dependencies = packageJson.dependencies ?? {};
  const developmentDependencies = packageJson.devDependencies ?? {};
  const allDependencies = { ...dependencies, ...developmentDependencies };
  const scripts = packageJson.scripts ?? {};

  return {
    ...detectFrameworks(dependencies, developmentDependencies, allDependencies),
    publishableLibrary: detectPublishable(packageJson),
    shell: cwd ? hasShellScripts(cwd) : false,
    hasJsSource: cwd ? hasJsSource(cwd) : false,
    ...detectCucumberLane(cwd),
    ...detectExistingTooling(cwd, scripts),
  };
}

export { type Languages, type ProjectType } from '../packs/types.js';
