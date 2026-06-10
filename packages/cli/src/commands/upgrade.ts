/**
 * Upgrade command - Update safeword configuration to latest version
 *
 * Uses reconcile() with mode='upgrade' to update all managed files.
 */

import nodePath from 'node:path';

import { migratePackId } from '../packs/config.js';
import { installPack } from '../packs/install.js';
import {
  detectPythonPackageManager,
  getPythonInstallCommand,
  hasRuffDependency,
  installPythonDependencies,
} from '../packs/python/setup.js';
import { getMissingPacks } from '../packs/registry.js';
import { reconcile, type ReconcileResult } from '../reconcile.js';
import { SAFEWORD_SCHEMA, SAFEWORD_TRANSIENT_PATHS } from '../schema.js';
import { createProjectContext } from '../utils/context.js';
import { getEslintPeerMismatchWarning } from '../utils/eslint-peer-check.js';
import { exists, findInTree, readFileSafe, writeFile } from '../utils/fs.js';
import { untrackIgnoredFiles } from '../utils/git.js';
import { detectPackageManager, installDependencies } from '../utils/install.js';
import { error, header, info, listItem, success, warn } from '../utils/output.js';
import { maybeAutoPatchOrNudge } from '../utils/vendored-ignores-nudge.js';
import { compareVersions } from '../utils/version.js';
import { VERSION } from '../version.js';

function getProjectVersion(safewordDirectory: string): string {
  const versionPath = nodePath.join(safewordDirectory, 'version');
  return readFileSafe(versionPath)?.trim() ?? '0.0.0';
}

// Ticket 154: strip the inert `version` field from .safeword/config.json.
// Plaintext `.safeword/version` is the source of truth — the JSON field was
// only ever written, never read, and confused reasoning-LLMs into flagging
// stale projects. Safe to delete this block once no projects-in-the-wild
// carry the field (likely several minor versions out).
function stripDeadConfigVersion(safewordDirectory: string): void {
  const configPath = nodePath.join(safewordDirectory, 'config.json');
  const content = readFileSafe(configPath);
  if (!content) return;
  const parsed = JSON.parse(content) as Record<string, unknown>;
  if (!('version' in parsed)) return;
  delete parsed.version;
  writeFile(configPath, JSON.stringify(parsed, undefined, 2));
}

function printUpgradeSummary(result: ReconcileResult, projectVersion: string, cwd: string): void {
  header('Upgrade Complete');
  info(`\nVersion: v${projectVersion} → v${VERSION}`);

  if (result.created.length > 0) {
    info('\nCreated:');
    for (const file of result.created) listItem(file);
  }

  if (result.updated.length > 0) {
    info('\nUpdated:');
    for (const file of result.updated) listItem(file);
  }

  if (result.packagesToRemove.length > 0) {
    const pm = detectPackageManager(cwd);
    const uninstallCmd = pm === 'yarn' ? 'yarn remove' : `${pm} uninstall`;
    warn(`\n${result.packagesToRemove.length} package(s) are now bundled in safeword:`);
    for (const pkg of result.packagesToRemove) listItem(pkg);
    info("\nIf you don't use these elsewhere, you can remove them:");
    listItem(`${uninstallCmd} ${result.packagesToRemove.join(' ')}`);
  }

  success(`\nSafeword upgraded to v${VERSION}`);
}

function installPythonTools(cwd: string): void {
  const pythonDirectory = findInTree(cwd, 'pyproject.toml') ?? cwd;
  if (hasRuffDependency(pythonDirectory)) return;

  const pm = detectPythonPackageManager(pythonDirectory);
  if (pm === 'pip') {
    warn('\nPython tools not auto-installed (pip). Install manually:');
    listItem(getPythonInstallCommand(pythonDirectory));
    return;
  }

  info('\nInstalling Python tools (ruff, mypy)...');
  const installed = installPythonDependencies(pythonDirectory, ['ruff', 'mypy']);
  if (installed) {
    success('Python tools installed');
  } else {
    warn('Python tools install failed. Install manually:');
    listItem(getPythonInstallCommand(pythonDirectory));
  }
}

function installSqlTools(cwd: string): void {
  // SQL projects use Python for SQLFluff — find pyproject.toml near dbt_project.yml
  const sqlDirectory = findInTree(cwd, 'dbt_project.yml') ?? cwd;
  const pythonDirectory = findInTree(sqlDirectory, 'pyproject.toml') ?? sqlDirectory;

  const pm = detectPythonPackageManager(pythonDirectory);
  if (pm === 'pip') {
    warn('\nSQL tools not auto-installed (pip). Install manually:');
    listItem(getPythonInstallCommand(pythonDirectory, ['sqlfluff']));
    return;
  }

  info('\nInstalling SQL tools (sqlfluff)...');
  const installed = installPythonDependencies(pythonDirectory, ['sqlfluff']);
  if (installed) {
    success('SQL tools installed');
  } else {
    warn('SQL tools install failed. Install manually:');
    listItem(getPythonInstallCommand(pythonDirectory, ['sqlfluff']));
  }
}

export interface UpgradeOptions {
  /** When true, skip auto-editing the project's eslint config; fall through to the print-only nudge. */
  noModify?: boolean;
}

export async function upgrade(options: UpgradeOptions): Promise<void> {
  const cwd = process.cwd();
  const safewordDirectory = nodePath.join(cwd, '.safeword');

  if (!exists(safewordDirectory)) {
    error('Not configured. Run `safeword setup` first.');
    process.exit(1);
  }

  const projectVersion = getProjectVersion(safewordDirectory);

  if (compareVersions(VERSION, projectVersion) < 0) {
    const pm = detectPackageManager(cwd);
    error(`CLI v${VERSION} is older than project v${projectVersion}.`);
    error(`Update the CLI first: ${pm} install -g safeword`);
    process.exit(1);
  }

  header('Safeword Upgrade');
  info(`Upgrading from v${projectVersion} to v${VERSION}`);

  const eslintWarning = getEslintPeerMismatchWarning(cwd);
  if (eslintWarning) warn(`\n${eslintWarning}`);

  try {
    const ctx = createProjectContext(cwd);
    const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);
    installDependencies(cwd, result.packagesToInstall, 'missing packages');

    // Migrate renamed pack IDs (dbt → sql)
    migratePackId(cwd, 'dbt', 'sql');

    // Ticket 154: drop dead `version` field from .safeword/config.json
    stripDeadConfigVersion(safewordDirectory);

    // Untrack transient state files a customer may have committed before the
    // gitignore rule existed (keep them on disk) — stops the perpetual-dirty
    // churn and the blocked branch switches it causes. Behaviour-neutral: the
    // hooks read/write these paths from the working tree, not from git.
    untrackIgnoredFiles(cwd, SAFEWORD_TRANSIENT_PATHS);

    // Install missing language packs
    const missingPacks = getMissingPacks(cwd);
    for (const packId of missingPacks) {
      installPack(packId, cwd);
      info(`Installed ${packId} pack`);
    }

    // Install language-specific tools for newly added packs
    if (missingPacks.includes('python')) {
      installPythonTools(cwd);
    }
    if (missingPacks.includes('sql')) {
      installSqlTools(cwd);
    }

    printUpgradeSummary(result, projectVersion, cwd);

    maybeAutoPatchOrNudge({
      cwd,
      existingEslintConfig: ctx.projectType.existingEslintConfig,
      hasJavaScript: Boolean(ctx.languages?.javascript),
      noModify: options.noModify,
    });
  } catch (error_) {
    error(`Upgrade failed: ${error_ instanceof Error ? error_.message : 'Unknown error'}`);
    process.exit(1);
  }
}
