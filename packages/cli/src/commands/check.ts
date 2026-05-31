/**
 * Check command - Verify project health and configuration
 *
 * Uses reconcile() with dryRun to detect missing files and configuration issues.
 */

import { readdirSync } from 'node:fs';
import nodePath from 'node:path';

import { getMissingPacks } from '../packs/registry.js';
import { reconcile } from '../reconcile.js';
import { SAFEWORD_SCHEMA } from '../schema.js';
import { readConfiguredPath, resolveConfiguredPath } from '../utils/configured-paths.js';
import { createProjectContext } from '../utils/context.js';
import { exists, readFileSafe } from '../utils/fs.js';
import { GLOSSARY_FILE_SUBPATH, parseGlossary, validateGlossary } from '../utils/glossary.js';
import { header, info, keyValue, listItem, success, warn } from '../utils/output.js';
import { parsePersonas, PERSONAS_FILE_SUBPATH, validatePersonas } from '../utils/personas.js';
import { buildCoverageReport, type CoverageReport } from '../utils/scenario-coverage.js';
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

// The persona/glossary find*Issues + find*Advisories pairs below (and the
// validate*Reference / lookup* pairs in personas.ts / glossary.ts) are
// intentionally parallel, NOT a missed extraction: the cores diverge (persona
// matches code/name, glossary matches name/alias; different parse+validate
// fns and messages), and where they don't, deduping two call sites into a
// multi-param helper would cost clarity. Assessed in ticket XEP59N — leave as is.

/**
 * Validate personas.md when present, routing through any configured
 * `paths.personas` override. Returns one issue string per persona
 * validation error, formatted as `personas.md:LINE: MESSAGE`.
 *
 * Two failure modes:
 * - Default location absent → no issue (scaffold is optional until JTBDs
 *   reference personas).
 * - Configured override set but file absent → loud failure (user opted
 *   in; typo would otherwise silently strand persona references). Ticket
 *   K7N2QM.
 */
function findPersonaIssues(cwd: string): string[] {
  const override = readConfiguredPath(cwd, 'personas');
  const filePath = resolveConfiguredPath(cwd, 'personas', nodePath.join(...PERSONAS_FILE_SUBPATH));
  const content = readFileSafe(filePath);

  if (content === undefined) {
    if (override !== undefined) {
      return [`personas-path: ${override}: file not found`];
    }
    return [];
  }

  const errors = validatePersonas(parsePersonas(content));
  return errors.map(error => `personas.md:${error.line}: ${error.message}`);
}

/**
 * Surface non-blocking diagnostics about persona path configuration.
 * Currently: when `paths.personas` is set AND the default-location file
 * `.safeword-project/personas.md` still exists, emit an advisory naming
 * the orphaned file. Safeword reads from the override; the legacy file
 * is dead weight and may confuse readers who think they're editing the
 * live file. Zero-exit — non-destructive (data-loss principle from
 * ticket K7N2QM); user owns cleanup.
 */
function findPersonaAdvisories(cwd: string): string[] {
  const override = readConfiguredPath(cwd, 'personas');
  if (override === undefined) return [];
  const defaultPath = nodePath.join(cwd, ...PERSONAS_FILE_SUBPATH);
  if (!exists(defaultPath)) return [];
  return [
    `.safeword-project/personas.md exists but paths.personas points to ${override} — legacy file is orphaned. Consider removing.`,
  ];
}

/**
 * Validate glossary.md when present, routing through any configured
 * `paths.glossary` override. Returns one issue string per glossary
 * validation error, formatted as `glossary.md:LINE: MESSAGE`. Same two
 * failure modes as {@link findPersonaIssues} — absent default is silent
 * (scaffold is optional), configured-but-missing fails loudly (ticket
 * YR6C49, mirrors K7N2QM).
 */
function findGlossaryIssues(cwd: string): string[] {
  const override = readConfiguredPath(cwd, 'glossary');
  const filePath = resolveConfiguredPath(cwd, 'glossary', nodePath.join(...GLOSSARY_FILE_SUBPATH));
  const content = readFileSafe(filePath);

  if (content === undefined) {
    if (override !== undefined) {
      return [`glossary-path: ${override}: file not found`];
    }
    return [];
  }

  const errors = validateGlossary(parseGlossary(content));
  return errors.map(error => `glossary.md:${error.line}: ${error.message}`);
}

/**
 * Surface non-blocking diagnostics about glossary path configuration.
 * When `paths.glossary` is set AND the default-location file still exists,
 * emit a zero-exit advisory naming the orphaned file (mirrors
 * {@link findPersonaAdvisories}; data-loss principle from K7N2QM).
 */
function findGlossaryAdvisories(cwd: string): string[] {
  const override = readConfiguredPath(cwd, 'glossary');
  if (override === undefined) return [];
  const defaultPath = nodePath.join(cwd, ...GLOSSARY_FILE_SUBPATH);
  if (!exists(defaultPath)) return [];
  return [
    `.safeword-project/glossary.md exists but paths.glossary points to ${override} — legacy file is orphaned. Consider removing.`,
  ];
}

const TICKETS_SUBPATH = ['.safeword-project', 'tickets'];

/**
 * Surface scenario-lineage coverage gaps as non-blocking advisories (ticket
 * XT1FFM). Scoped to `status: in_progress` tickets that carry a spec.md —
 * which excludes done predecessors whose pre-scheme scenarios are the
 * out-of-scope migration case (epic DZ2NM5/D5), and keeps the report focused
 * on the work the developer is actually building. Each in-progress ticket's
 * (spec.md, test-definitions.md) pair is cross-referenced into uncovered ACs,
 * stale AC refs, and orphan scenarios. Zero-exit — advisory, never a gate.
 */
function findCoverageAdvisories(cwd: string): string[] {
  const ticketsRoot = nodePath.join(cwd, ...TICKETS_SUBPATH);
  let ticketIds: string[];
  try {
    ticketIds = readdirSync(ticketsRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name !== 'completed')
      .map(entry => entry.name);
  } catch {
    return [];
  }
  return ticketIds.flatMap(ticketId => coverageAdvisoriesForTicket(ticketsRoot, ticketId));
}

/** Build coverage advisories for one ticket, or none if it is not an
 * in-progress, spec-bearing ticket. */
function coverageAdvisoriesForTicket(ticketsRoot: string, ticketId: string): string[] {
  const ticketDirectory = nodePath.join(ticketsRoot, ticketId);
  const ticketContent = readFileSafe(nodePath.join(ticketDirectory, 'ticket.md'));
  if (ticketContent === undefined || !isInProgress(ticketContent)) return [];

  const specContent = readFileSafe(nodePath.join(ticketDirectory, 'spec.md'));
  if (specContent === undefined) return [];

  const testDefinitionsContent = readFileSafe(
    nodePath.join(ticketDirectory, 'test-definitions.md'),
  );
  return formatCoverageReport(ticketId, buildCoverageReport(specContent, testDefinitionsContent));
}

/** Whether a ticket.md's frontmatter declares `status: in_progress`. */
function isInProgress(ticketContent: string): boolean {
  const lines = ticketContent.split('\n');
  if (lines[0]?.trim() !== '---') return false;
  for (let index = 1; index < lines.length; index += 1) {
    const line = (lines[index] ?? '').trim();
    if (line === '---') return false;
    if (line === 'status: in_progress') return true;
  }
  return false;
}

/** Render a coverage report into one advisory string per finding. */
function formatCoverageReport(ticketId: string, report: CoverageReport): string[] {
  return [
    ...report.uncovered.map(
      acId => `${ticketId}: acceptance criterion ${acId} has no scenario (uncovered)`,
    ),
    ...report.stale.map(
      reference =>
        `${ticketId}: scenario ref ${reference} matches no AC under its JTBD (stale ref)`,
    ),
    ...report.orphan.map(
      reference => `${ticketId}: scenario ref ${reference} names no JTBD in spec.md (orphan)`,
    ),
  ];
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
  /**
   * Non-blocking diagnostics — reported to the user but do NOT gate
   * non-zero exit. Use for situations where safeword's operation is
   * unaffected but a cleanup or attention is warranted (e.g., legacy
   * default-location file orphaned by a configured `paths.*` override).
   */
  advisories: string[];
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
      advisories: [],
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
    ...findGlossaryIssues(cwd),
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
    advisories: [
      ...findPersonaAdvisories(cwd),
      ...findGlossaryAdvisories(cwd),
      ...findCoverageAdvisories(cwd),
    ],
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

  // Advisories: non-blocking diagnostics. Reported even when issues
  // exist (no early-return above this point handles them); printed
  // here when the project is otherwise healthy.
  if (health.advisories.length > 0) {
    header('Advisories');
    for (const advisory of health.advisories) {
      warn(advisory);
    }
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
