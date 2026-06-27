/**
 * Check command - Verify project health and configuration
 *
 * The config-health core lives in ../health.ts (shared with the setup/upgrade
 * self-verify, ticket 3293WH). This command adds the standalone-only
 * surfaces: npm update-check, version display, and ticket-index refresh.
 */

import process from 'node:process';

import { checkHealth, type HealthStatus, reportHealthSummary } from '../health.js';
import { syncTickets } from '../ticket-sync/index.js';
import { detectPackageManager } from '../utils/install.js';
import { header, info, keyValue, success, warn } from '../utils/output.js';
import { buildIndexConflictListMessage } from '../utils/ticket-index-warnings.js';
import { fetchRegistryLatestVersion, isNewerVersion } from '../utils/version.js';

interface CheckOptions {
  offline?: boolean;
}

/**
 * Check for CLI updates and report status
 * @param health
 */
async function reportUpdateStatus(health: HealthStatus): Promise<void> {
  info('\nChecking for updates...');
  const latestVersion = await fetchRegistryLatestVersion();

  if (!latestVersion) {
    warn("Couldn't check for updates (offline?)");
    return;
  }

  health.latestVersion = latestVersion;
  health.updateAvailable = isNewerVersion(health.cliVersion, latestVersion);

  if (health.updateAvailable) {
    warn(`Update available: v${latestVersion}`);
    info('Run `bunx safeword@latest upgrade` to upgrade');
  } else {
    success('CLI is up to date');
  }
}

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}

function isPackageVersionSpecChar(char: string): boolean {
  return (
    (char >= 'a' && char <= 'z') ||
    (char >= 'A' && char <= 'Z') ||
    isDigit(char) ||
    char === '.' ||
    char === '-' ||
    char === '+'
  );
}

function isSafePackageVersion(version: string): boolean {
  if (version.length === 0 || !version.includes('.')) return false;
  for (const char of version) {
    if (!isPackageVersionSpecChar(char)) return false;
  }
  return true;
}

/**
 * Compare project version vs CLI version and report
 * @param health
 */
function reportVersionMismatch(health: HealthStatus, cwd: string): void {
  if (!health.projectVersion) return;

  if (isNewerVersion(health.cliVersion, health.projectVersion)) {
    warn(`Project config (v${health.projectVersion}) is newer than CLI (v${health.cliVersion})`);

    if (!isSafePackageVersion(health.projectVersion)) {
      warn(
        'Project version is not safe to use in a package install command; inspect .safeword/version.',
      );
      return;
    }

    const pm = detectPackageManager(cwd);
    const runSafewordUpgrade =
      pm === 'bun' || pm === 'yarn' ? `${pm} run safeword upgrade` : `${pm} exec safeword upgrade`;
    info('Update the project-local CLI first:');
    info(`${pm} add -D safeword@${health.projectVersion} && ${runSafewordUpgrade}`);
  } else if (isNewerVersion(health.projectVersion, health.cliVersion)) {
    info(`\nUpgrade available for project config`);
    info(
      `Run \`safeword upgrade\` to update from v${health.projectVersion} to v${health.cliVersion}`,
    );
  }
}

/**
 * Regenerate the ticket discovery index, swallowing any error — index
 * freshness must never block or fail a health check. Reports only when it
 * actually rewrote a file.
 * @param cwd
 */
function regenerateTicketIndex(cwd: string): void {
  try {
    const result = syncTickets(cwd);
    if (result.wrote) {
      info('Regenerated ticket index (INDEX.md / INDEX-completed.md)');
    }
    if (result.indexConflicts.length > 0) {
      warn(buildIndexConflictListMessage(result.indexConflicts));
    }
  } catch (error: unknown) {
    // Best-effort: index freshness must never fail the health check. Surface
    // under DEBUG, then return — the deliberate swallow point.
    if (process.env.DEBUG) {
      console.error('[check] ticket index regen failed:', error);
    }
    return;
  }
}

/**
 *
 * @param options
 */
export async function check(options: CheckOptions): Promise<void> {
  const cwd = process.cwd();

  header('Safeword Health Check');

  const health = await checkHealth(cwd);

  // Not configured
  if (!health.configured) {
    info('Not configured. Run `safeword setup` to initialize.');
    return;
  }

  // Keep the ticket discovery index fresh at this checkpoint (best-effort —
  // never fail the health check on index regen). Ticket 1GGD28.
  regenerateTicketIndex(cwd);

  // Show versions
  keyValue('Safeword CLI', `v${health.cliVersion}`);
  keyValue('Project config', health.projectVersion ? `v${health.projectVersion}` : 'unknown');

  // Check for updates (unless offline)
  if (options.offline) {
    info('\nSkipped update check (offline mode)');
  } else {
    await reportUpdateStatus(health);
  }

  reportVersionMismatch(health, cwd);
  const hasIssues = reportHealthSummary(health);

  if (hasIssues) {
    process.exit(1);
  }
}
