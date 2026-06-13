/**
 * Config-health verification core (ticket 3293WH).
 *
 * Extracted from the `check` command so mutating commands (`setup`,
 * `upgrade`) can prove their own postcondition at exit. Deliberately
 * network-free: the npm update-check stays in commands/check.ts — a
 * postcondition check must not depend on the registry being reachable,
 * and an "update available" nag right after upgrading would be wrong.
 *
 * Uses reconcile() with dryRun to detect missing files and configuration
 * issues.
 */

import { readdirSync } from 'node:fs';
import nodePath from 'node:path';

import { getMissingPacks } from './packs/registry.js';
import { reconcile } from './reconcile.js';
import { SAFEWORD_SCHEMA } from './schema.js';
import { readTickets } from './ticket-sync/index.js';
import { listArchitectureRecords } from './utils/architecture-records.js';
import {
  defaultConfiguredPath,
  readConfiguredPath,
  resolveConfiguredPath,
  resolveTicketsDirectory,
} from './utils/configured-paths.js';
import { createProjectContext } from './utils/context.js';
import { exists, isDirectory, readFileSafe } from './utils/fs.js';
import { parseGlossary, validateGlossary } from './utils/glossary.js';
import { header, info, listItem, success, warn } from './utils/output.js';
import { parsePersonas, validatePersonas } from './utils/personas.js';
import { buildCoverageReport, type CoverageReport } from './utils/scenario-coverage.js';
import { formatTicketReference } from './utils/ticket-reference.js';
import { findDanglingDependencies, findTicketsInCycles } from './utils/ticket-relations.js';
import { VERSION } from './version.js';

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
 * Both-namespace-roots advisory (ticket 9MMWS7): both `.project/` and
 * `.safeword-project/` present means a migration was left half-finished (or
 * the dirs were created independently). Zero-exit nudge naming the finishing
 * action; silent on any single root — declining migration is never a nag.
 */
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

/**
 * Surface non-blocking diagnostics about persona path configuration.
 * When `paths.personas` is set AND the default-location file still exists,
 * emit a zero-exit advisory naming the orphaned file. Safeword reads from
 * the override; the legacy file is dead weight and may confuse readers who
 * think they're editing the live file. Non-destructive (data-loss principle
 * from ticket K7N2QM); user owns cleanup.
 */
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

export interface HealthStatus {
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
 * Check project configuration health using reconcile dryRun
 * @param cwd
 */
export async function checkHealth(cwd: string): Promise<HealthStatus> {
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

export interface ReportHealthOptions {
  /**
   * Replaces the default `Run \`safeword upgrade\` …` instruction on every
   * failure branch. Used by the post-upgrade self-verify (ticket 3293WH
   * AC5): upgrade telling the user to run `safeword upgrade` as the fix is
   * a contradiction — an issue the reconcile just ran couldn't fix won't be
   * fixed by running it again.
   */
  repairHint?: string;
}

interface FailureSection {
  title: string;
  lines: string[];
  render: (line: string) => void;
  defaultHint: string;
}

/** The highest-priority failure section to report, or undefined when healthy.
 * Packs first (explains missing files), then packages, then issues. */
function firstFailureSection(health: HealthStatus): FailureSection | undefined {
  if (health.missingPacks.length > 0) {
    return {
      title: 'Missing Language Packs',
      lines: health.missingPacks.map(pack => `${pack} pack not installed`),
      render: listItem,
      defaultHint: 'Run `safeword upgrade` to install missing packs',
    };
  }
  if (health.missingPackages.length > 0) {
    return {
      title: 'Missing Packages',
      lines: health.missingPackages,
      render: listItem,
      defaultHint: 'Run `safeword upgrade` to install missing packages',
    };
  }
  if (health.issues.length > 0) {
    return {
      title: 'Issues Found',
      lines: health.issues,
      render: warn,
      defaultHint: 'Run `safeword upgrade` to repair configuration',
    };
  }
  return undefined;
}

/**
 * Report issues or success
 * @param health
 * @param options
 * @returns true if there are issues requiring attention
 */
export function reportHealthSummary(
  health: HealthStatus,
  options: ReportHealthOptions = {},
): boolean {
  // Advisories first: non-blocking diagnostics that must surface even when
  // issues exist (the failure branch below returns early). Ticket 9MMWS7
  // exposed the old ordering, which silently swallowed advisories on any
  // unhealthy project.
  if (health.advisories.length > 0) {
    header('Advisories');
    for (const advisory of health.advisories) {
      warn(advisory);
    }
  }

  const failure = firstFailureSection(health);
  if (failure === undefined) {
    success('\nConfiguration is healthy');
    return false;
  }

  header(failure.title);
  for (const line of failure.lines) {
    failure.render(line);
  }
  info(`\n${options.repairHint ?? failure.defaultHint}`);
  return true;
}
