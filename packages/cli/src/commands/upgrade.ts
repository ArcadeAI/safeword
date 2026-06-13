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
import {
  executeNamespaceMigration,
  type MigrationPlan,
  type MigrationResult,
  planNamespaceMigration,
} from '../utils/namespace-migration.js';
import { error, header, info, listItem, success, warn } from '../utils/output.js';
import { scanStaleNamespaceConfigs } from '../utils/stale-config-scan.js';
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
  /** Explicit namespace-migration consent: true = migrate, false = decline. Unset → prompt (TTY) or nudge. */
  migrateNamespace?: boolean;
  /** Injected confirm seam for the TTY prompt (tests). Defaults to a readline [Y/n] prompt. */
  confirmMigration?: (question: string) => Promise<boolean>;
}

/**
 * Default confirm seam: one-line readline [Y/n] prompt, Enter = yes,
 * stdin EOF/close = decline. `rl.question()`'s promise never settles when
 * the input closes (nodejs/node#53497), so the close event is raced in
 * explicitly — otherwise a Ctrl+D mid-prompt would hang the upgrade.
 * Streams injectable for tests.
 */
export async function promptYesDefault(
  question: string,
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
): Promise<boolean> {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input, output });
  try {
    const answer = await Promise.race([
      rl.question(question),
      new Promise<string>(resolve =>
        rl.once('close', () => {
          resolve('n');
        }),
      ),
    ]);
    return !/^n/i.test(answer.trim());
  } catch {
    return false; // defensive — treat any prompt failure as decline
  } finally {
    rl.close();
  }
}

/**
 * Namespace-migration step (ticket 9MMWS7) — runs BEFORE project-context
 * creation so the same upgrade reconciles on the post-move root. Consent:
 * explicit flag → obey; interactive TTY → prompt defaulting to yes;
 * otherwise → one-line nudge. Never silent, never forced; a failed move
 * reports and the upgrade continues on the legacy root.
 */
const UNMOVABLE_PLAN_WARNINGS: Partial<Record<MigrationPlan, string>> = {
  'both-dirs':
    'Namespace migration skipped: .project/ already exists alongside .safeword-project/ — merge manually, then remove the legacy directory.',
  blocked:
    'Namespace migration skipped: .project exists but is not a directory — remove or rename it, then re-run with --migrate-namespace.',
};

/** Resolve consent for the offered move: flag → prompt (TTY or seam) → nudge. */
async function resolveMigrationConsent(options: UpgradeOptions): Promise<boolean> {
  if (options.migrateNamespace !== undefined) return options.migrateNamespace;

  // An injected confirm seam counts as interactive — it IS the TTY stand-in.
  const interactive =
    options.confirmMigration !== undefined ||
    (process.stdin.isTTY === true && process.stdout.isTTY === true);
  if (!interactive) {
    info(
      'Namespace: this project uses the legacy .safeword-project/ — run `safeword upgrade --migrate-namespace` to converge on .project/ (recommended).',
    );
    return false;
  }
  const confirm = options.confirmMigration ?? promptYesDefault;
  return confirm(
    'Move project namespace from .safeword-project/ to .project/ (recommended)? [Y/n] ',
  );
}

function reportMigrationSuccess(result: MigrationResult): void {
  const how = result.method === 'git' ? 'git history preserved' : 'directory renamed';
  const rewrites =
    result.rewrittenKeys.length > 0
      ? `; rewrote paths.${result.rewrittenKeys.join(', paths.')}`
      : '';
  success(`Namespace moved to .project/ (${how})${rewrites}`);
}

export async function maybeMigrateNamespace(cwd: string, options: UpgradeOptions): Promise<void> {
  const plan = planNamespaceMigration(cwd);

  if (plan !== 'offer') {
    // Warn only when the user explicitly asked for a move that can't happen.
    const warning = UNMOVABLE_PLAN_WARNINGS[plan];
    if (warning !== undefined && options.migrateNamespace === true) warn(warning);
    return;
  }

  if (!(await resolveMigrationConsent(options))) return;

  try {
    reportMigrationSuccess(executeNamespaceMigration(cwd));
  } catch (migrationError) {
    warn(
      `${migrationError instanceof Error ? migrationError.message : String(migrationError)} — continuing upgrade on .safeword-project/.`,
    );
    return;
  }

  // After a confirmed move only — kept out of the try above so a scan hiccup
  // can never be reported as a migration failure (the move already succeeded).
  warnStaleToolingConfigs(cwd);
}

/**
 * After a successful move, name customer tooling configs still referencing the
 * legacy namespace so the developer can fix their lint/CI in the same review
 * (ticket JYWZG1). Read-only — safeword never edits these files.
 */
function warnStaleToolingConfigs(cwd: string): void {
  const stale = scanStaleNamespaceConfigs(cwd);
  if (stale.length === 0) return;
  warn(
    '\nThese tooling configs still reference the old namespace (.safeword-project/ → .project/) — update them so your lint/CI keeps working:',
  );
  for (const file of stale) listItem(file);
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

  await maybeMigrateNamespace(cwd, options);

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
