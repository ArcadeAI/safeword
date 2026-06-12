/**
 * Check command - Verify project health and configuration
 *
 * Uses reconcile() with dryRun to detect missing files and configuration issues.
 */

import { readdirSync, statSync } from 'node:fs';
import nodePath from 'node:path';

import { getMissingPacks } from '../packs/registry.js';
import { reconcile } from '../reconcile.js';
import { SAFEWORD_SCHEMA } from '../schema.js';
import { readTickets, syncTickets } from '../ticket-sync/index.js';
import { listArchitectureRecords } from '../utils/architecture-records.js';
import {
  defaultConfiguredPath,
  readConfiguredPath,
  resolveConfiguredPath,
  resolveTicketsDirectory,
} from '../utils/configured-paths.js';
import { createProjectContext } from '../utils/context.js';
import { exists, readFileSafe } from '../utils/fs.js';
import { parseGlossary, validateGlossary } from '../utils/glossary.js';
import { header, info, keyValue, listItem, success, warn } from '../utils/output.js';
import { parsePersonas, validatePersonas } from '../utils/personas.js';
import { buildCoverageReport, type CoverageReport } from '../utils/scenario-coverage.js';
import { formatTicketReference } from '../utils/ticket-reference.js';
import { findDanglingDependencies, findTicketsInCycles } from '../utils/ticket-relations.js';
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
  const filePath = resolveConfiguredPath(cwd, 'personas');
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
 * the default personas file still exists, emit an advisory naming
 * the orphaned file. Safeword reads from the override; the legacy file
 * is dead weight and may confuse readers who think they're editing the
 * live file. Zero-exit — non-destructive (data-loss principle from
 * ticket K7N2QM); user owns cleanup.
 */
/**
 * Both-namespace-roots advisory (ticket 9MMWS7): both `.project/` and
 * `.safeword-project/` present means a migration was left half-finished (or
 * the dirs were created independently). Zero-exit nudge naming the finishing
 * action; silent on any single root — declining migration is never a nag.
 */
function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function findNamespaceAdvisories(cwd: string): string[] {
  if (
    isDirectory(nodePath.join(cwd, '.project')) &&
    isDirectory(nodePath.join(cwd, '.safeword-project'))
  ) {
    return [
      'Both .project/ and .safeword-project/ exist — safeword reads .project/. Merge any needed legacy content into .project/ and remove .safeword-project/ (or run `safeword upgrade --migrate-namespace` after removing .project/ if the legacy directory is the real one).',
    ];
  }
  return [];
}

function findPersonaAdvisories(cwd: string): string[] {
  const override = readConfiguredPath(cwd, 'personas');
  if (override === undefined) return [];
  const defaultPath = defaultConfiguredPath(cwd, 'personas');
  if (!exists(defaultPath)) return [];
  return [
    `${nodePath.relative(cwd, defaultPath)} exists but paths.personas points to ${override} — legacy file is orphaned. Consider removing.`,
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
  const filePath = resolveConfiguredPath(cwd, 'glossary');
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
  const defaultPath = defaultConfiguredPath(cwd, 'glossary');
  if (!exists(defaultPath)) return [];
  return [
    `${nodePath.relative(cwd, defaultPath)} exists but paths.glossary points to ${override} — legacy file is orphaned. Consider removing.`,
  ];
}

/** Ticket folder names under the tickets root (excluding `completed/`), or
 * empty when the root is missing/unreadable. */
function listTicketIds(ticketsRoot: string): string[] {
  try {
    return readdirSync(ticketsRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name !== 'completed')
      .map(entry => entry.name);
  } catch {
    return [];
  }
}

/**
 * Surface architecture-claim mismatches as non-blocking advisories (ticket
 * K4BWTQ). Structural only — no prose extraction (YR6C49 ruling): when an
 * in-progress ticket's impl-plan.md Arch alignment section carries content
 * (not `skip:`) but the resolved `paths.architecture` location does not
 * exist, the claim cannot be honoring anything recorded. Zero-exit.
 */
function findArchitectureAdvisories(cwd: string): string[] {
  const ticketsRoot = resolveTicketsDirectory(cwd);
  const ticketIds = listTicketIds(ticketsRoot);

  const resolved = resolveConfiguredPath(cwd, 'architecture');
  if (listArchitectureRecords(resolved).kind !== 'absent') return [];

  return ticketIds.flatMap(ticketId => {
    const ticketDirectory = nodePath.join(ticketsRoot, ticketId);
    const ticketContent = readFileSafe(nodePath.join(ticketDirectory, 'ticket.md'));
    if (ticketContent === undefined || !isInProgress(ticketContent)) return [];
    const implPlan = readFileSafe(nodePath.join(ticketDirectory, 'impl-plan.md'));
    if (implPlan === undefined) return [];
    if (!archAlignmentHasContent(implPlan)) return [];
    return [
      `${ticketId}: impl-plan.md Arch alignment claims alignment, but no architecture record exists at ${resolved} — record the decision or mark the section skip:`,
    ];
  });
}

/** Whether the impl plan's `## Arch alignment` section carries real content
 * (non-empty, not a `skip:` annotation). */
function archAlignmentHasContent(implPlanContent: string): boolean {
  let inSection = false;
  const body: string[] = [];
  for (const raw of implPlanContent.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      inSection = line.slice(3).trim().toLowerCase() === 'arch alignment';
      continue;
    }
    if (inSection && line !== '') body.push(line);
  }
  if (body.length === 0) return false;
  return !(body.length === 1 && (body[0] ?? '').toLowerCase().startsWith('skip:'));
}

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
  const ticketsRoot = resolveTicketsDirectory(cwd);
  return listTicketIds(ticketsRoot).flatMap(ticketId =>
    coverageAdvisoriesForTicket(ticketsRoot, ticketId),
  );
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
  const dashIndex = ticketId.indexOf('-');
  const ticketLabel =
    dashIndex === -1
      ? ticketId
      : formatTicketReference(ticketId.slice(0, dashIndex), ticketId.slice(dashIndex + 1));
  return [
    ...report.uncovered.map(
      acId => `${ticketLabel}: acceptance criterion ${acId} has no scenario (uncovered)`,
    ),
    ...report.stale.map(
      reference =>
        `${ticketLabel}: scenario ref ${reference} matches no AC under its JTBD (stale ref)`,
    ),
    ...report.orphan.map(
      reference => `${ticketLabel}: scenario ref ${reference} names no JTBD in spec.md (orphan)`,
    ),
  ];
}

/**
 * Surface structured-relation problems as non-blocking advisories (ticket
 * AKZJXC): a `depends_on` pointing at a ticket absent from the corpus (dangling
 * ref), and dependency cycles (A→B→A). Warn-only — a target may live on another
 * branch or in completed/, and a cycle is a planning smell, not a config fault.
 * Reads the full corpus (active + completed) so cross-status edges resolve.
 * Zero-exit.
 */
function findRelationAdvisories(cwd: string): string[] {
  const ticketsDirectory = resolveTicketsDirectory(cwd);
  let entries;
  try {
    const { active, completed } = readTickets(ticketsDirectory);
    entries = [...active, ...completed];
  } catch {
    return [];
  }

  const nodes = entries.map(entry => ({ id: entry.id, dependsOn: entry.dependsOn }));
  const labelById = new Map(entries.map(entry => [entry.id, entry.title]));
  const refOf = (id: string): string => {
    const title = labelById.get(id);
    return title === undefined ? id : formatTicketReference(id, title);
  };

  const dangling = findDanglingDependencies(nodes).map(
    ({ from, missing }) => `${refOf(from)}: depends_on ${missing} — no such ticket (dangling ref)`,
  );
  const cyclic = findTicketsInCycles(nodes);
  const cycle =
    cyclic.length > 0
      ? [`dependency cycle among: ${cyclic.map(id => refOf(id)).join(', ')} (break the loop)`]
      : [];
  return [...dangling, ...cycle];
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
      ...findNamespaceAdvisories(cwd),
      ...findPersonaAdvisories(cwd),
      ...findGlossaryAdvisories(cwd),
      ...findCoverageAdvisories(cwd),
      ...findRelationAdvisories(cwd),
      ...findArchitectureAdvisories(cwd),
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
  // Advisories first: non-blocking diagnostics that must surface even when
  // issues exist (the issue branches below early-return). Ticket 9MMWS7
  // exposed the old ordering, which silently swallowed advisories on any
  // unhealthy project.
  if (health.advisories.length > 0) {
    header('Advisories');
    for (const advisory of health.advisories) {
      warn(advisory);
    }
  }

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
