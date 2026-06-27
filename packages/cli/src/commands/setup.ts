/**
 * Setup command - Initialize safeword in a project
 *
 * Uses reconcile() with mode='install' to create all managed files.
 */

import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import nodePath from 'node:path';

import { checkHealth, reportHealthSummary } from '../health.js';
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
import { installGoSkills } from '../skills/golang.js';
import {
  CODEX_TRUST_NEXT_STEP,
  reconciledCodexConfig,
  warnIfCodexBelowHookFloor,
} from '../utils/codex.js';
import { createProjectContext } from '../utils/context.js';
import { getEslintPeerMismatchWarning } from '../utils/eslint-peer-check.js';
import { exists, readJson, writeJson } from '../utils/fs.js';
import { installDependencies } from '../utils/install.js';
import {
  error,
  header,
  info,
  listItem,
  printReconcileWarnings,
  success,
  warn,
} from '../utils/output.js';
import { type Languages } from '../utils/project-detector.js';
import { maybeAutoPatchOrNudge } from '../utils/vendored-ignores-nudge.js';
import { getWorkspacePatterns } from '../utils/workspaces.js';
import { VERSION } from '../version.js';
import { buildArchitecture, hasArchitectureDetected, syncConfigCore } from './sync-config.js';

interface PackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  'lint-staged'?: Record<string, string[]>;
  workspaces?: string[] | { packages?: string[] };
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

    const processWorkspacePattern = isGlobPattern
      ? processGlobWorkspacePattern
      : processExplicitWorkspacePath;
    const patternUpdates = processWorkspacePattern(cwd, workspacePath);

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
 * Create package.json if missing. Every safeword project gets one — BDD is
 * core, and the cucumber-js acceptance lane (TypeScript step definitions) needs
 * a JS home even in pure Go/Rust/Python repos (ticket 102b, Option A: the full
 * TS toolchain comes along so the lane's .ts files are themselves linted).
 * Returns true if created, false if one already exists.
 */
function ensurePackageJson(cwd: string): boolean {
  const packageJsonPath = nodePath.join(cwd, 'package.json');
  if (exists(packageJsonPath)) return false;

  const dirName = nodePath.basename(cwd) || 'project';
  const defaultPackageJson: PackageJson = {
    name: dirName,
    version: '0.1.0',
    private: true,
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
  let isInstallFailed = false;

  // Detect layers for import-linter
  const layers = detectPythonLayers(cwd);
  const hasLayers = layers.length >= 2;

  // Install Python tools if not already in dependencies
  if (!hasRuffDependency(cwd)) {
    const tools = getPythonTools(hasLayers);
    const pm = detectPythonPackageManager(cwd);
    if (pm === 'pip') {
      isInstallFailed = true;
    } else {
      info(`\nInstalling Python tools (${tools.join(', ')})...`);
      const isInstalled = installPythonDependencies(cwd, tools);
      if (isInstalled) {
        success('Python tools installed');
      } else {
        isInstallFailed = true;
      }
    }
  }

  // Note: files are now created by reconciliation, not returned here
  return { files: [], installFailed: isInstallFailed, importLinter: hasLayers };
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

  printReconcileWarnings(result.warnings);

  // Next steps
  info('\nNext steps:');
  listItem('Run `safeword check` to verify setup');
  if (reconciledCodexConfig(result)) listItem(CODEX_TRUST_NEXT_STEP);

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
  // dependency-cruiser maps JS/TS module boundaries — skip for repos with no real
  // JS source (a non-JS project carrying only the TS BDD lane). (BE7C7B)
  const arch = ctx.projectType.hasJsSource ? buildArchitecture(cwd) : undefined;

  if (arch && hasArchitectureDetected(arch)) {
    const syncResult = syncConfigCore(cwd, arch);
    if (syncResult.generatedConfig) {
      archFiles.push('.safeword/depcruise-config.cjs');
    }
    if (syncResult.createdMainConfig) {
      archFiles.push('.dependency-cruiser.cjs');
      info(
        '  ↳ .dependency-cruiser.cjs extends rules from .safeword/depcruise-config.cjs — edit to add your own.',
      );
    }
    logArchitectureDetected(arch);
  }

  const workspaceUpdates = setupWorkspaceFormatScripts(cwd, ctx);
  if (workspaceUpdates.length > 0) {
    info(`\nAdded format scripts to ${workspaceUpdates.length} workspace package(s)`);
  }

  logExistingFormatter(ctx);

  const eslintWarning = getEslintPeerMismatchWarning(cwd);
  if (eslintWarning) warn(`\n${eslintWarning}`);

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
  info('Set up the project-structure checks that /audit uses');
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
 * Config files (.golangci.yml) are created by reconciliation. Go judgment skills
 * (samber/cc-skills-golang) are pulled best-effort — a failure degrades to a
 * warning, never blocks setup.
 */
function setupGoProject(languages: Languages, cwd: string): void {
  if (!languages.golang) return;
  setupGoTooling();
  installGoSkills(cwd);
}

/** Warn if Bun is not available (hooks require it) */
function warnIfBunMissing(): void {
  try {
    execSync('bun --version', { stdio: 'pipe' });
  } catch {
    warn(
      'safeword needs a small tool called "bun" to run its safety checks, and it isn\'t installed.',
    );
    info('  Install bun (about 30 seconds): curl -fsSL https://bun.sh/install | bash');
    info("  Until then, safeword's checks can't run and your agent works unguarded.");
  }
}

export interface SetupOptions {
  /** When true, skip auto-editing the project's eslint config; fall through to the print-only nudge. */
  noModify?: boolean;
}

export async function setup(options: SetupOptions): Promise<void> {
  const cwd = process.cwd();
  const safewordDirectory = nodePath.join(cwd, '.safeword');

  if (exists(safewordDirectory)) {
    error('Already configured. Run `safeword upgrade` to update.');
    process.exit(1);
  }

  const isPackageJsonCreated = ensurePackageJson(cwd);

  header('Safeword Setup');
  info(`Version: ${VERSION}`);
  if (isPackageJsonCreated) info('Created package.json (none found)');
  warnIfBunMissing();
  warnIfCodexBelowHookFloor();

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
    const result = await reconcile(SAFEWORD_SCHEMA, 'install', ctx);
    success('Created .safeword directory and configuration');

    // Language-specific setup. The JS path runs unconditionally: ensurePackageJson
    // guarantees a package.json (the BDD lane's home, ticket 102b), which is what
    // language detection keys "javascript" on — every project is a JS project now.
    const { archFiles, workspaceUpdates } = setupJavaScriptProject(
      cwd,
      ctx,
      result.packagesToInstall,
    );
    const pythonStatus = setupPythonProject(languages, cwd);
    setupGoProject(languages, cwd);
    registerLanguagePacks(cwd);

    printSetupSummary({
      cwd,
      result,
      packageJsonCreated: isPackageJsonCreated,
      languages,
      archFiles,
      workspaceUpdates,
      pythonFiles: pythonStatus.files,
      pythonInstallFailed: pythonStatus.installFailed,
      pythonImportLinter: pythonStatus.importLinter,
    });

    maybeAutoPatchOrNudge({
      cwd,
      existingEslintConfig: ctx.projectType.existingEslintConfig,
      hasJavaScript: languages.javascript,
      noModify: options.noModify,
    });

    // 2TK5AD — offer the opt-in tracker connect (default no). Skipped in
    // non-interactive / scripted / CI runs so setup never hangs on input.
    await maybeOfferTrackerConnect();

    // Self-verify the postcondition (ticket 3293WH): a mutating command
    // proves what it wrote, where the breakage actually is. Config-health
    // only — no update-check. The default "Run `safeword upgrade`" repair
    // hint is kept: after a failed *setup*, pointing at upgrade is correct,
    // non-self-referencing advice. When install was deliberately skipped, the
    // self-verify skips package-presence checks — setup did what it was asked.
    const health = await checkHealth(cwd, {
      skipPackageChecks: Boolean(process.env.SAFEWORD_SKIP_INSTALL),
    });
    if (reportHealthSummary(health)) {
      process.exit(1);
    }
  } catch (error_) {
    error(`Setup failed: ${error_ instanceof Error ? error_.message : 'Unknown error'}`);
    process.exit(1);
  }
}

/** Read one line of free text from stdin (for provider/target selection). */
async function promptText(question: string): Promise<string> {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const raw = await rl.question(`${question} `);
    return raw.trim();
  } finally {
    rl.close();
  }
}

/**
 * 2TK5AD AC1/AC8 — the opt-in `setup` offer. Delegates to the same connect flow
 * `safeword connect` runs (one code path). Skipped entirely in scripted/CI/
 * non-interactive runs so setup never blocks on input.
 */
async function maybeOfferTrackerConnect(): Promise<void> {
  if (process.env.CI !== undefined || !process.stdin.isTTY) return;

  const { offerTrackerConnect } = await import('../tracker-connect/offer.js');
  const { createPrompt } = await import('../tracker-connect/prompt.js');
  const { runConnect } = await import('../tracker-connect/run.js');

  await offerTrackerConnect({
    prompt: createPrompt(),
    chooseConnect: async () => {
      const answer = await promptText('  Provider (github/linear):');
      const provider = answer.toLowerCase();
      // An unrecognized provider falls through to connectTracker, which rejects
      // it cleanly (AC7) — so chooseConnect has a single return and no undefined.
      const detail = await promptText(
        provider === 'linear' ? '  Linear team:' : '  Target repo (owner/name):',
      );
      const target = provider === 'linear' ? { team: detail } : { repo: detail };
      return { provider, target };
    },
    // Same composition root `safeword connect` runs (AC8) — no sibling-command import.
    connect: choice => runConnect(choice.provider, choice.target, info),
  });
}
