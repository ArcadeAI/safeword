/**
 * Check command - Verify project health and configuration
 *
 * Uses reconcile() with dryRun to detect missing files and configuration issues.
 */

import nodePath from 'node:path';

import { getMissingPacks } from '../packs/registry.js';
import { reconcile } from '../reconcile.js';
import { SAFEWORD_SCHEMA } from '../schema.js';
import { createProjectContext } from '../utils/context.js';
import { exists, readFileSafe } from '../utils/fs.js';
import { header, info, keyValue, listItem, success, warn } from '../utils/output.js';
import { parsePersonas, PERSONAS_FILE_SUBPATH, validatePersonas } from '../utils/personas.js';
import { isNewerVersion } from '../utils/version.js';
import { VERSION } from '../version.js';

interface CheckOptions {
  offline?: boolean;
}

/**
 * Check for missing files from write actions
 * @param cwd
 * @param actions
 */
function findMissingFiles(cwd: string, actions: { type: string; path: string }[]): string[] {
  const issues: string[] = [];
  for (const action of actions) {
    if (action.type === 'write' && !exists(nodePath.join(cwd, action.path))) {
      issues.push(`Missing: ${action.path}`);
    }
  }
  return issues;
}

/**
 * Validate `.safeword-project/personas.md` when present. Returns one issue
 * string per persona validation error, formatted as
 * `personas.md:LINE: MESSAGE` for compiler-style readability. Returns an
 * empty array when the file is absent (not an error — the scaffold is
 * optional until JTBDs reference personas).
 */
function findPersonaIssues(cwd: string): string[] {
  const filePath = nodePath.join(cwd, ...PERSONAS_FILE_SUBPATH);
  const content = readFileSafe(filePath);
  if (content === undefined) return [];
  const errors = validatePersonas(parsePersonas(content));
  return errors.map(error => `personas.md:${error.line}: ${error.message}`);
}

/**
 * Check for missing text patch markers
 * @param cwd
 * @param actions
 */
function findMissingPatches(
  cwd: string,
  actions: { type: string; path: string; definition?: { marker: string } }[],
): string[] {
  const issues: string[] = [];
  for (const action of actions) {
    if (action.type !== 'text-patch') continue;

    const fullPath = nodePath.join(cwd, action.path);
    if (exists(fullPath)) {
      const content = readFileSafe(fullPath) ?? '';
      if (action.definition && !content.includes(action.definition.marker)) {
        issues.push(`${action.path} missing safeword link`);
      }
    } else {
      issues.push(`${action.path} file missing`);
    }
  }
  return issues;
}

interface HealthStatus {
  configured: boolean;
  projectVersion: string | undefined;
  cliVersion: string;
  updateAvailable: boolean;
  latestVersion: string | undefined;
  issues: string[];
  missingPackages: string[];
  missingPacks: string[];
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
 * Check project configuration health using reconcile dryRun
 * @param cwd
 */
async function checkHealth(cwd: string): Promise<HealthStatus> {
  const safewordDirectory = nodePath.join(cwd, '.safeword');

  // Check if configured
  if (!exists(safewordDirectory)) {
    return {
      configured: false,
      projectVersion: undefined,
      cliVersion: VERSION,
      updateAvailable: false,
      latestVersion: undefined,
      issues: [],
      missingPackages: [],
      missingPacks: [],
    };
  }

  // Read project version
  const versionPath = nodePath.join(safewordDirectory, 'version');
  const projectVersion = readFileSafe(versionPath)?.trim() ?? undefined;

  // Use reconcile with dryRun to detect issues
  const ctx = createProjectContext(cwd);
  const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx, {
    dryRun: true,
  });

  // Collect issues from write actions and text patches
  // Filter out chmod (paths[] instead of path) and json-merge/unmerge (incompatible definition)
  const actionsWithPath = result.actions.filter(
    (
      a,
    ): a is Exclude<
      (typeof result.actions)[number],
      { type: 'chmod' } | { type: 'json-merge' } | { type: 'json-unmerge' }
    > => a.type !== 'chmod' && a.type !== 'json-merge' && a.type !== 'json-unmerge',
  );
  const issues: string[] = [
    ...findMissingFiles(cwd, actionsWithPath),
    ...findMissingPatches(cwd, actionsWithPath),
    ...findPersonaIssues(cwd),
  ];

  // Check for missing .claude/settings.json
  if (!exists(nodePath.join(cwd, '.claude', 'settings.json'))) {
    issues.push('Missing: .claude/settings.json');
  }

  // Check for missing language packs
  const missingPacks = getMissingPacks(cwd);

  return {
    configured: true,
    projectVersion,
    cliVersion: VERSION,
    updateAvailable: false,
    latestVersion: undefined,
    issues,
    missingPackages: result.packagesToInstall,
    missingPacks,
  };
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
 * Report issues or success
 * @param health
 * @returns true if there are issues requiring attention
 */
function reportHealthSummary(health: HealthStatus): boolean {
  // Check missing packs first (highest priority - explains missing files)
  if (health.missingPacks.length > 0) {
    header('Missing Language Packs');
    for (const pack of health.missingPacks) {
      listItem(`${pack} pack not installed`);
    }
    info('\nRun `safeword upgrade` to install missing packs');
    return true;
  }

  if (health.missingPackages.length > 0) {
    header('Missing Packages');
    for (const pkg of health.missingPackages) listItem(pkg);
    info('\nRun `safeword upgrade` to install missing packages');
    return true;
  }

  if (health.issues.length > 0) {
    header('Issues Found');
    for (const issue of health.issues) {
      warn(issue);
    }
    info('\nRun `safeword upgrade` to repair configuration');
    return true;
  }

  success('\nConfiguration is healthy');
  return false;
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
