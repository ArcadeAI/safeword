/**
 * Setup command - Initialize safeword in a project
 *
 * Uses reconcile() with mode='install' to create all managed files.
 */

import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import nodePath from 'node:path';

import { setupGoTooling } from '../packs/golang/setup.js';
import { installPack } from '../packs/install.js';
import {
  detectPythonLayers,
  detectPythonPackageManager,
  getPythonInstallCommand,
  hasRuffDependency,
  installPythonDependencies,
} from '../packs/python/setup.js';
import { detectLanguages as detectLanguagePacks } from '../packs/registry.js';
import { reconcile, type ReconcileResult } from '../reconcile.js';
import { type ProjectContext, SAFEWORD_SCHEMA } from '../schema.js';
import { createProjectContext } from '../utils/context.js';
import { exists, readJson, writeJson } from '../utils/fs.js';
import { installDependencies } from '../utils/install.js';
import { error, header, info, listItem, success, warn } from '../utils/output.js';
import { detectLanguages, type Languages } from '../utils/project-detector.js';
import { VERSION } from '../version.js';
import { buildArchitecture, hasArchitectureDetected, syncConfigCore } from './sync-config.js';

interface PackageJson {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  'lint-staged'?: Record<string, string[]>;
  workspaces?: string[] | { packages?: string[] };
}

/**
 * Get workspace patterns from package.json.
 * Supports both array format and yarn workspaces object format.
 */
function getWorkspacePatterns(cwd: string): string[] {
  const packageJsonPath = nodePath.join(cwd, 'package.json');
  const rootPackageJson = readJson(packageJsonPath) as PackageJson | undefined;
  if (!rootPackageJson?.workspaces) return [];

  return Array.isArray(rootPackageJson.workspaces)
    ? rootPackageJson.workspaces
    : (rootPackageJson.workspaces.packages ?? []);
}

/**
 * Process a glob workspace pattern (e.g., "packages/*").
 * Scans directory and adds format scripts to each package.
 */
function processGlobWorkspacePattern(cwd: string, workspacePath: string): string[] {
  const updated: string[] = [];
  const fullPath = nodePath.join(cwd, workspacePath);

  if (!exists(fullPath)) return [];

  try {
    const entries = readdirSync(fullPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

      const packagePath = nodePath.join(fullPath, entry.name);
      if (addFormatScriptIfMissing(packagePath)) {
        updated.push(nodePath.join(workspacePath, entry.name, 'package.json'));
      }
    }
  } catch {
    // Directory not readable, skip
  }

  return updated;
}

/**
 * Process an explicit workspace path (e.g., "tools/scripts").
 */
function processExplicitWorkspacePath(cwd: string, workspacePath: string): string[] {
  const fullPath = nodePath.join(cwd, workspacePath);
  if (addFormatScriptIfMissing(fullPath)) {
    return [nodePath.join(workspacePath, 'package.json')];
  }
  return [];
}

/**
 * Add format scripts to workspace packages that don't have them.
 * Only runs if root project uses Prettier (not an existing formatter like Biome).
 */
function setupWorkspaceFormatScripts(cwd: string, ctx: ProjectContext): string[] {
  // Skip if root uses an existing formatter (Biome, dprint, etc.)
  if (ctx.projectType.existingFormatter) return [];

  const workspacePatterns = getWorkspacePatterns(cwd);
  if (workspacePatterns.length === 0) return [];

  const updated: string[] = [];

  for (const pattern of workspacePatterns) {
    const isGlobPattern = pattern.endsWith('/*');
    const workspacePath = isGlobPattern ? pattern.slice(0, -2) : pattern;

    const patternUpdates = isGlobPattern
      ? processGlobWorkspacePattern(cwd, workspacePath)
      : processExplicitWorkspacePath(cwd, workspacePath);

    updated.push(...patternUpdates);
  }

  return updated;
}

/**
 * Add format script to a package if it doesn't have one.
 * Returns true if the script was added.
 */
function addFormatScriptIfMissing(packageDirectory: string): boolean {
  const packageJsonPath = nodePath.join(packageDirectory, 'package.json');
  if (!exists(packageJsonPath)) return false;

  const packageJson = readJson(packageJsonPath) as PackageJson | undefined;
  if (!packageJson) return false;

  // Skip if format script already exists
  if (packageJson.scripts?.format) return false;

  // Add format script
  const scripts = packageJson.scripts ?? {};
  scripts.format = 'prettier --write .';
  packageJson.scripts = scripts;
  writeJson(packageJsonPath, packageJson);

  return true;
}

/**
 * Create package.json if missing, unless non-JS-only project (Python, Go).
 * Returns true if created, false if already exists or skipped.
 */
function ensurePackageJson(cwd: string): boolean {
  const packageJsonPath = nodePath.join(cwd, 'package.json');
  if (exists(packageJsonPath)) return false;

  // Skip for non-JS-only projects (no JS tooling needed)
  const languages = detectLanguages(cwd);
  const hasNonJs = languages.python || languages.golang || languages.rust;
  if (hasNonJs && !languages.javascript) return false;

  const dirName = nodePath.basename(cwd) || 'project';
  const defaultPackageJson: PackageJson = {
    name: dirName,
    version: '0.1.0',
    scripts: {},
  };
  writeJson(packageJsonPath, defaultPackageJson);
  return true;
}

interface PythonSetupStatus {
  files: string[];
  installFailed: boolean;
  importLinter: boolean;
}

/** Base Python tools to install. Import-linter added when layers detected. */
function getPythonTools(includeImportLinter: boolean): string[] {
  const tools = ['ruff', 'mypy', 'deadcode'];
  if (includeImportLinter) tools.push('import-linter');
  return tools;
}

/**
 * Configure Python tooling and install dependencies.
 * Config files (ruff.toml, mypy.ini, .importlinter) are created by reconciliation.
 * This function handles dependency installation.
 */
function setupPython(cwd: string): PythonSetupStatus {
  let installFailed = false;

  // Detect layers for import-linter
  const layers = detectPythonLayers(cwd);
  const hasLayers = layers.length >= 2;

  // Install Python tools if not already in dependencies
  if (!hasRuffDependency(cwd)) {
    const tools = getPythonTools(hasLayers);
    const pm = detectPythonPackageManager(cwd);
    if (pm === 'pip') {
      installFailed = true;
    } else {
      info(`\nInstalling Python tools (${tools.join(', ')})...`);
      const installed = installPythonDependencies(cwd, tools);
      if (installed) {
        success('Python tools installed');
      } else {
        installFailed = true;
      }
    }
  }

  // Note: files are now created by reconciliation, not returned here
  return { files: [], installFailed, importLinter: hasLayers };
}

interface SetupSummaryOptions {
  cwd: string;
  result: ReconcileResult;
  packageJsonCreated: boolean;
  languages: Languages;
  archFiles?: string[];
  workspaceUpdates?: string[];
  pythonFiles?: string[];
  pythonInstallFailed?: boolean;
  pythonImportLinter?: boolean;
}

/**
 * Print list of created files.
 */
function printCreatedFiles(createdFiles: string[], packageJsonCreated: boolean): void {
  if (createdFiles.length === 0 && !packageJsonCreated) return;

  info('\nCreated:');
  if (packageJsonCreated) listItem('package.json');
  for (const file of createdFiles) listItem(file);
}

/**
 * Print list of modified files.
 */
function printModifiedFiles(modifiedFiles: string[]): void {
  if (modifiedFiles.length === 0) return;

  info('\nModified:');
  for (const file of modifiedFiles) listItem(file);
}

/**
 * Print language-specific next steps.
 */
function printLanguageNextSteps(options: {
  cwd: string;
  languages: Languages;
  pythonInstallFailed: boolean;
  pythonImportLinter: boolean;
  golangciCreated: boolean;
}): void {
  const { cwd, languages, pythonInstallFailed, pythonImportLinter, golangciCreated } = options;

  // Python: show install command only if auto-install failed
  if (languages.python && pythonInstallFailed) {
    listItem(
      `Install Python tools: ${getPythonInstallCommand(cwd, getPythonTools(pythonImportLinter))}`,
    );
  }

  // Go: show if .golangci.yml was created (Go tools are installed globally)
  if (languages.golang && golangciCreated) {
    listItem(
      'Install Go tools: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest',
    );
  }
}

function printSetupSummary(options: SetupSummaryOptions): void {
  const {
    cwd,
    result,
    packageJsonCreated,
    languages,
    archFiles = [],
    workspaceUpdates = [],
    pythonFiles = [],
    pythonInstallFailed = false,
    pythonImportLinter = false,
  } = options;

  header('Setup Complete');

  // Collect created files (schema files + arch files + python config files)
  const createdFiles = [
    ...result.created,
    ...archFiles,
    ...pythonFiles.filter(f => f !== 'pyproject.toml'),
  ];
  printCreatedFiles(createdFiles, packageJsonCreated);

  // Collect modified files (schema updates + workspace updates + pyproject.toml)
  const modifiedFiles = [
    ...result.updated,
    ...workspaceUpdates,
    ...pythonFiles.filter(f => f === 'pyproject.toml'),
  ];
  printModifiedFiles(modifiedFiles);

  if (result.updated.includes('CLAUDE.md')) {
    info('\nNote: CLAUDE.md — added one import line at the top. Your content is preserved.');
  }

  // Next steps
  info('\nNext steps:');
  listItem('Run `safeword check` to verify setup');

  printLanguageNextSteps({
    cwd,
    languages,
    pythonInstallFailed,
    pythonImportLinter,
    golangciCreated: result.created.includes('.golangci.yml'),
  });

  listItem('Commit the new files to git');

  success(`\nSafeword ${VERSION} installed successfully!`);
}

/**
 * Setup JavaScript project: architecture detection, depcruise config, workspace scripts
 */
function setupJavaScriptProject(
  cwd: string,
  ctx: ProjectContext,
  packagesToInstall: string[],
): { archFiles: string[]; workspaceUpdates: string[] } {
  const archFiles: string[] = [];
  const arch = buildArchitecture(cwd);

  if (hasArchitectureDetected(arch)) {
    const syncResult = syncConfigCore(cwd, arch);
    if (syncResult.generatedConfig) {
      archFiles.push('.safeword/depcruise-config.cjs');
    }
    if (syncResult.createdMainConfig) {
      archFiles.push('.dependency-cruiser.cjs');
    }
    logArchitectureDetected(arch);
  }

  const workspaceUpdates = setupWorkspaceFormatScripts(cwd, ctx);
  if (workspaceUpdates.length > 0) {
    info(`\nAdded format scripts to ${workspaceUpdates.length} workspace package(s)`);
  }

  logExistingFormatter(ctx);

  installDependencies(cwd, packagesToInstall, 'linting devDependencies');
  info('These are dev-only tools — your application dependencies are unchanged.');

  return { archFiles, workspaceUpdates };
}

/**
 * Log detected architecture elements and workspaces
 */
function logArchitectureDetected(arch: ReturnType<typeof buildArchitecture>): void {
  const detected: string[] = [];
  if (arch.elements.length > 0) {
    detected.push(arch.elements.map(element => element.location).join(', '));
  }
  if (arch.workspaces && arch.workspaces.length > 0) {
    detected.push(`workspaces: ${arch.workspaces.join(', ')}`);
  }
  info(`\nArchitecture detected: ${detected.join('; ')}`);
  info('Generated dependency-cruiser config for /audit command');
}

/**
 * Log existing formatter detection and explain ESLint coexistence
 */
function logExistingFormatter(ctx: ProjectContext): void {
  if (!ctx.projectType.existingFormatter) return;

  info('\nDetected existing formatter (biome/dprint) — skipping Prettier.');
  info('ESLint is still installed for security scanning, complexity checks, and framework rules');
  info("that biome/dprint don't cover. Both tools coexist without conflict.");
}

/**
 * Log detected language and skip message
 */
function logDetectedLanguage(languages: Languages): void {
  if (languages.python && !languages.javascript) {
    info('Python project detected (skipping JS tooling)');
  }
  if (languages.golang && !languages.javascript) {
    info('Go project detected (skipping JS tooling)');
  }
  if (languages.rust && !languages.javascript) {
    info('Rust project detected (skipping JS tooling)');
  }
}

/**
 * Register and setup detected language packs
 */
function registerLanguagePacks(cwd: string): void {
  const detectedPacks = detectLanguagePacks(cwd);
  for (const packId of detectedPacks) {
    installPack(packId, cwd);
  }
}

/**
 * Setup Python project (dependencies installation).
 * Config files are created by reconciliation.
 */
function setupPythonProject(languages: Languages, cwd: string): PythonSetupStatus {
  if (!languages.python) {
    return { files: [], installFailed: false, importLinter: false };
  }
  return setupPython(cwd);
}

/**
 * Setup Go project tooling.
 * Config files (.golangci.yml) are created by reconciliation.
 */
function setupGoProject(languages: Languages): void {
  if (languages.golang) {
    setupGoTooling();
  }
}

/** Warn if Bun is not available (hooks require it) */
function warnIfBunMissing(): void {
  try {
    execSync('bun --version', { stdio: 'pipe' });
  } catch {
    warn('bun not found — quality hooks will not work without it.');
    info('  Install: curl -fsSL https://bun.sh/install | bash');
    info('  Hooks will hard-block at session start until bun is available.');
  }
}

export async function setup(): Promise<void> {
  const cwd = process.cwd();
  const safewordDirectory = nodePath.join(cwd, '.safeword');

  if (exists(safewordDirectory)) {
    error('Already configured. Run `safeword upgrade` to update.');
    process.exit(1);
  }

  const packageJsonCreated = ensurePackageJson(cwd);

  header('Safeword Setup');
  info(`Version: ${VERSION}`);
  if (packageJsonCreated) info('Created package.json (none found)');
  warnIfBunMissing();

  try {
    info('\nCreating safeword configuration...');
    const ctx = createProjectContext(cwd);
    const languages = ctx.languages ?? {
      javascript: false,
      python: false,
      golang: false,
      rust: false,
      sql: false,
    };
    const isNonJsOnly =
      (languages.python || languages.golang || languages.rust) && !languages.javascript;

    logDetectedLanguage(languages);

    const result = await reconcile(SAFEWORD_SCHEMA, 'install', ctx);
    success('Created .safeword directory and configuration');

    // Language-specific setup
    const { archFiles, workspaceUpdates } = isNonJsOnly
      ? { archFiles: [], workspaceUpdates: [] }
      : setupJavaScriptProject(cwd, ctx, result.packagesToInstall);
    const pythonStatus = setupPythonProject(languages, cwd);
    setupGoProject(languages);
    registerLanguagePacks(cwd);

    printSetupSummary({
      cwd,
      result,
      packageJsonCreated,
      languages,
      archFiles,
      workspaceUpdates,
      pythonFiles: pythonStatus.files,
      pythonInstallFailed: pythonStatus.installFailed,
      pythonImportLinter: pythonStatus.importLinter,
    });
  } catch (error_) {
    error(`Setup failed: ${error_ instanceof Error ? error_.message : 'Unknown error'}`);
    process.exit(1);
  }
}
