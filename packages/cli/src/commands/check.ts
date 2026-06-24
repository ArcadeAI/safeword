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
import { header, info, keyValue, success, warn } from '../utils/output.js';
import { isNewerVersion } from '../utils/version.js';

interface CheckOptions {
  offline?: boolean;
}

/**
 * Check for latest version from npm (with timeout)
 * @param timeout
 */
async function checkLatestVersion(timeout = 3000): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    const response = await fetch('https://registry.npmjs.org/safeword/latest', {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return undefined;

    const data = (await response.json()) as { version?: string };
    return data.version ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Check for CLI updates and report status
 * @param health
 */
async function reportUpdateStatus(health: HealthStatus): Promise<void> {
  info('\nChecking for updates...');
  const latestVersion = await checkLatestVersion();

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

/**
 * Compare project version vs CLI version and report
 * @param health
 */
function reportVersionMismatch(health: HealthStatus): void {
  if (!health.projectVersion) return;

  if (isNewerVersion(health.cliVersion, health.projectVersion)) {
    warn(`Project config (v${health.projectVersion}) is newer than CLI (v${health.cliVersion})`);
    info('Consider upgrading the CLI');
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
      warn(
        `Ticket index file(s) contained merge-conflict markers: ${result.indexConflicts.join(', ')}. ` +
          'Run `safeword sync-tickets --quiet` after resolving the merge conflict.',
      );
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

  reportVersionMismatch(health);
  const hasIssues = reportHealthSummary(health);

  if (hasIssues) {
    process.exit(1);
  }
}
