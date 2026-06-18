/**
 * Reset command - Remove safeword configuration from project
 *
 * Uses reconcile() with mode='uninstall' or 'uninstall-full' to remove configuration.
 *
 * By default, preserves linting configuration (eslint, prettier, etc.)
 * Use --full to also remove linting config and uninstall packages
 */

import { execSync } from 'node:child_process';
import nodePath from 'node:path';

import { reconcile, type ReconcileResult } from '../reconcile.js';
import { SAFEWORD_SCHEMA } from '../schema.js';
import { createProjectContext } from '../utils/context.js';
import { exists } from '../utils/fs.js';
import { detectPackageManager, getUninstallCommand } from '../utils/install.js';
import { error, header, info, listItem, success, warn } from '../utils/output.js';

interface ResetOptions {
  yes?: boolean;
  full?: boolean;
}

function uninstallPackages(cwd: string, packages: string[]): void {
  if (packages.length === 0) return;

  const pm = detectPackageManager(cwd);
  const uninstallCmd = getUninstallCommand(pm, packages);

  info('\nUninstalling devDependencies...');
  info(`Running: ${uninstallCmd}`);

  try {
    execSync(uninstallCmd, { cwd, stdio: 'inherit' });
    success('Uninstalled safeword devDependencies');
  } catch {
    warn('Failed to uninstall some packages. Run manually:');
    listItem(uninstallCmd);
  }
}

function printResetSummary(result: ReconcileResult, fullReset: boolean): void {
  header('Reset Complete');

  if (result.removed.length > 0) {
    info('\nRemoved:');
    for (const item of result.removed) {
      listItem(item);
    }
  }

  if (!fullReset) {
    info('\nPreserved (use --full to remove):');
    listItem('eslint.config.mjs');
    listItem('.prettierrc');
    listItem('package.json (scripts)');
    listItem('devDependencies (eslint, prettier, etc.)');
  }

  success('\nSafeword configuration removed');
}

export async function reset(options: ResetOptions): Promise<void> {
  const cwd = process.cwd();
  const safewordDirectory = nodePath.join(cwd, '.safeword');

  if (!exists(safewordDirectory)) {
    info('Nothing to remove. Project is not configured with safeword.');
    return;
  }

  const fullReset = options.full ?? false;
  const mode = fullReset ? 'uninstall-full' : 'uninstall';

  header('Safeword Reset');
  info(
    fullReset
      ? 'Performing full reset (including linting configuration)...'
      : 'Removing safeword configuration...',
  );

  try {
    const ctx = createProjectContext(cwd);
    const result = await reconcile(SAFEWORD_SCHEMA, mode, ctx);

    if (fullReset) uninstallPackages(cwd, result.packagesToRemove);
    printResetSummary(result, fullReset);
  } catch (error_) {
    error(`Reset failed: ${error_ instanceof Error ? error_.message : 'Unknown error'}`);
    process.exit(1);
  }
}
