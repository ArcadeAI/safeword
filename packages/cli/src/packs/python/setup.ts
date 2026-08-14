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

import { execFileSync } from 'node:child_process';
import { readdirSync, realpathSync } from 'node:fs';
import nodePath from 'node:path';

import { parse } from 'smol-toml';

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
/**
 * Whether any of the given layer patterns exists under `cwd` (either at
 * `src/{pattern}` or `{pattern}`).
 */
function hasAnyLayerPattern(cwd: string, patterns: readonly string[]): boolean {
  for (const pattern of patterns) {
    // Check common locations: src/{pattern}, {pattern}
    const srcPath = nodePath.join(cwd, 'src', pattern);
    const rootPath = nodePath.join(cwd, pattern);
    if (exists(srcPath) || exists(rootPath)) {
      return true;
    }
  }
  return false;
}

export function detectPythonLayers(cwd: string): string[] {
  const detected: string[] = [];

  for (const [layer, patterns] of Object.entries(PYTHON_LAYERS)) {
    if (hasAnyLayerPattern(cwd, patterns)) {
      detected.push(layer);
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

/**
 * Directory names that hold Python files but are not the distribution package —
 * excluded from sole-package detection so `tests/__init__.py` etc. never make a
 * real single-package project read as ambiguous.
 */
const NON_PACKAGE_DIRS = new Set([
  'tests',
  'test',
  'docs',
  'examples',
  'scripts',
  'node_modules',
  'venv',
]);

/**
 * Importable packages (dirs with `__init__.py`) directly under `dir`, excluding
 * non-package dirs. Symlinked directories are not counted (`isDirectory()` is
 * false for symlinks) — deliberate narrow detection: a layout that only looks
 * ambiguous through symlinks still scaffolds, and the unchecked package is at
 * worst uncovered, never wrongly deleted.
 */
function importablePackagesIn(dir: string): string[] {
  if (!exists(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter(
        entry =>
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          !NON_PACKAGE_DIRS.has(entry.name) &&
          exists(nodePath.join(dir, entry.name, '__init__.py')),
      )
      .map(entry => entry.name);
  } catch {
    return [];
  }
}

/**
 * The project's single unambiguous top-level package, from filesystem truth:
 * exactly one importable package (a directory with `__init__.py`) at the repo
 * root or under `src/`. Anything else — zero packages (scripts-only), two or
 * more, or a root+src mix — returns undefined, and callers scaffold nothing
 * (ticket V4MATC R3: a wrong guess errors every audit; the honest skip wins).
 */
export function detectSolePackage(cwd: string): string | undefined {
  const candidates = [
    ...importablePackagesIn(cwd),
    ...importablePackagesIn(nodePath.join(cwd, 'src')),
  ];
  return candidates.length === 1 ? candidates[0] : undefined;
}

type PythonPackageManager = 'uv' | 'poetry' | 'pipenv' | 'pip';
export type PythonTool = 'ruff' | 'mypy' | 'deadcode' | 'import-linter';

const PYTHON_DEPENDENCY_SEPARATORS = new Set(['[', '<', '>', '=', '!', '~', ';', '@']);

function normalizePythonDistributionName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[-_.]+/g, '-');
}

function startsPythonDependency(value: string, dependency: PythonTool): boolean {
  const candidate = normalizePythonDistributionName(value);
  const normalizedDependency = normalizePythonDistributionName(dependency);
  if (!candidate.startsWith(normalizedDependency)) return false;

  const next = candidate.at(normalizedDependency.length);
  return next === undefined || PYTHON_DEPENDENCY_SEPARATORS.has(next) || next.trim() === '';
}

type TomlTable = Record<string, unknown>;

function asTomlTable(value: unknown): TomlTable | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as TomlTable)
    : undefined;
}

function parseTomlTable(content: string): TomlTable | undefined {
  try {
    return asTomlTable(parse(content));
  } catch {
    return undefined;
  }
}

function tomlTableAt(table: TomlTable, path: readonly string[]): TomlTable | undefined {
  let current: TomlTable | undefined = table;
  for (const key of path) {
    current = current === undefined ? undefined : asTomlTable(current[key]);
  }
  return current;
}

function tomlStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function dependencyGroupSpecs(
  groups: TomlTable,
  groupName: string,
  visited: Set<string> = new Set<string>(),
): string[] {
  if (visited.has(groupName)) return [];
  visited.add(groupName);

  return (Array.isArray(groups[groupName]) ? groups[groupName] : []).flatMap(item => {
    if (typeof item === 'string') return [item];
    const includeGroup = asTomlTable(item)?.['include-group'];
    return typeof includeGroup === 'string'
      ? dependencyGroupSpecs(groups, includeGroup, visited)
      : [];
  });
}

function pyprojectDependencySpecs(document: TomlTable): string[] {
  const project = asTomlTable(document.project);
  const optionalDependencies = asTomlTable(project?.['optional-dependencies']);
  const dependencyGroups = asTomlTable(document['dependency-groups']);
  const uv = tomlTableAt(document, ['tool', 'uv']);

  return [
    ...tomlStringArray(project?.dependencies),
    ...Object.values(optionalDependencies ?? {}).flatMap(value => tomlStringArray(value)),
    ...(dependencyGroups === undefined
      ? []
      : Object.keys(dependencyGroups).flatMap(groupName =>
          dependencyGroupSpecs(dependencyGroups, groupName),
        )),
    ...tomlStringArray(uv?.['dev-dependencies']),
  ];
}

function poetryDependencyNames(document: TomlTable): string[] {
  const poetry = tomlTableAt(document, ['tool', 'poetry']);
  const groups = asTomlTable(poetry?.group);
  const groupNames = Object.values(groups ?? {}).flatMap(group =>
    Object.keys(asTomlTable(asTomlTable(group)?.dependencies) ?? {}),
  );

  return [
    ...Object.keys(asTomlTable(poetry?.dependencies) ?? {}),
    ...Object.keys(asTomlTable(poetry?.['dev-dependencies']) ?? {}),
    ...groupNames,
  ];
}

function hasPythonDependencyName(names: readonly string[], dependency: PythonTool): boolean {
  const normalizedDependency = normalizePythonDistributionName(dependency);
  return names.some(name => normalizePythonDistributionName(name) === normalizedDependency);
}

function containsPyprojectPythonDependency(content: string, dependency: PythonTool): boolean {
  const document = parseTomlTable(content);
  if (document === undefined) return false;

  return (
    hasPythonDependencyName(poetryDependencyNames(document), dependency) ||
    pyprojectDependencySpecs(document).some(specification =>
      startsPythonDependency(specification, dependency),
    )
  );
}

function containsPipfilePythonDependency(content: string, dependency: PythonTool): boolean {
  const document = parseTomlTable(content);
  if (document === undefined) return false;

  return hasPythonDependencyName(
    [
      ...Object.keys(asTomlTable(document.packages) ?? {}),
      ...Object.keys(asTomlTable(document['dev-packages']) ?? {}),
    ],
    dependency,
  );
}

function shortRequirementsInclude(declaration: string): string | undefined {
  if (!declaration.startsWith('-r')) return undefined;
  return declaration.slice(2).trim() || undefined;
}

function longRequirementsInclude(declaration: string): string | undefined {
  const longOption = '--requirement';
  if (!declaration.startsWith(longOption)) return undefined;

  const suffix = declaration.slice(longOption.length);
  if (suffix.startsWith('=')) return suffix.slice(1).trim() || undefined;
  if (suffix.trimStart().length === suffix.length) return undefined;
  return suffix.trim() || undefined;
}

function unquoteRequirementsInclude(include: string): string {
  if (
    (include.startsWith('"') && include.endsWith('"')) ||
    (include.startsWith("'") && include.endsWith("'"))
  ) {
    return include.slice(1, -1);
  }
  return include;
}

function requirementsIncludePath(line: string): string | undefined {
  const declaration = (line.split('#', 1)[0] ?? '').trim();
  const include = shortRequirementsInclude(declaration) ?? longRequirementsInclude(declaration);
  return include === undefined ? undefined : unquoteRequirementsInclude(include);
}

function isPathWithinDirectory(candidate: string, directory: string): boolean {
  const relative = nodePath.relative(directory, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${nodePath.sep}`));
}

function isRealPathWithinDirectory(candidate: string, directory: string): boolean {
  try {
    return isPathWithinDirectory(realpathSync(candidate), realpathSync(directory));
  } catch {
    return false;
  }
}

function containsRequirementsPythonDependency(
  projectDirectory: string,
  requirementsPath: string,
  dependency: PythonTool,
  visited: Set<string> = new Set<string>(),
): boolean {
  const resolvedRequirementsPath = nodePath.resolve(requirementsPath);
  if (
    !isRealPathWithinDirectory(resolvedRequirementsPath, projectDirectory) ||
    visited.has(resolvedRequirementsPath)
  ) {
    return false;
  }
  visited.add(resolvedRequirementsPath);

  const content = readFileSafe(resolvedRequirementsPath);
  if (content === undefined) return false;

  return content.split('\n').some(line => {
    if (line.trimStart().startsWith('#')) return false;
    const declaration = line.split('#', 1)[0] ?? '';
    if (startsPythonDependency(declaration, dependency)) return true;

    const include = requirementsIncludePath(line);
    if (include === undefined || nodePath.isAbsolute(include)) return false;
    const includePath = nodePath.resolve(nodePath.dirname(resolvedRequirementsPath), include);
    return containsRequirementsPythonDependency(projectDirectory, includePath, dependency, visited);
  });
}

function hasPythonDependency(cwd: string, dependency: PythonTool): boolean {
  const pyprojectContent = readFileSafe(nodePath.join(cwd, 'pyproject.toml'));
  const pipfileContent = readFileSafe(nodePath.join(cwd, 'Pipfile'));

  return (
    (pyprojectContent !== undefined &&
      containsPyprojectPythonDependency(pyprojectContent, dependency)) ||
    (pipfileContent !== undefined && containsPipfilePythonDependency(pipfileContent, dependency)) ||
    containsRequirementsPythonDependency(cwd, nodePath.join(cwd, 'requirements.txt'), dependency)
  );
}

/**
 * Check whether ruff is declared in a project dependency manifest rather than
 * merely configured under [tool.ruff].
 */
export function hasRuffDependency(cwd: string): boolean {
  return hasPythonDependency(cwd, 'ruff');
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

function pythonInstallInvocation(
  cwd: string,
  tools: readonly PythonTool[],
): { command: string; arguments: string[] } {
  switch (detectPythonPackageManager(cwd)) {
    case 'uv': {
      return { command: 'uv', arguments: ['add', '--dev', ...tools] };
    }
    case 'poetry': {
      return { command: 'poetry', arguments: ['add', '--group', 'dev', ...tools] };
    }
    case 'pipenv': {
      return { command: 'pipenv', arguments: ['install', '--dev', ...tools] };
    }
    case 'pip': {
      return { command: 'pip', arguments: ['install', ...tools] };
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
/**
 * The Python tools safeword installs: ruff, mypy, deadcode, plus import-linter
 * when safeword would scaffold a config for it (layers OR an unambiguous single
 * package — the hasImportLinterScaffoldTarget predicate). Single source so
 * `setup` and `upgrade` install the same set; they had drifted (upgrade shipped
 * only ruff + mypy).
 */
export function getPythonTools(includeImportLinter: boolean): PythonTool[] {
  const tools: PythonTool[] = ['ruff', 'mypy', 'deadcode'];
  if (includeImportLinter) tools.push('import-linter');
  return tools;
}

/**
 * Safe Word's Python tooling is project configuration, not a global shell
 * prerequisite: uv and Poetry keep project tools in managed environments. Read
 * declarations only so health checks stay filesystem-only and never invoke a
 * package manager merely to inspect readiness.
 */
export function getMissingPythonToolDependencies(
  cwd: string,
  includeImportLinter: boolean,
): PythonTool[] {
  return getPythonTools(includeImportLinter).filter(tool => !hasPythonDependency(cwd, tool));
}

export function installPythonDependencies(cwd: string, tools: readonly PythonTool[]): boolean {
  if (tools.length === 0) return true;
  if (process.env.SAFEWORD_SKIP_INSTALL) return true;

  // pip projects need manual install due to PEP 668
  const pm = detectPythonPackageManager(cwd);
  if (pm === 'pip') return false;

  try {
    const invocation = pythonInstallInvocation(cwd, tools);
    execFileSync(invocation.command, invocation.arguments, {
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
