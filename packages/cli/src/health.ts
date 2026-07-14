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

import { detectUnanchoredPhaseState } from '../templates/hooks/lib/phase-provenance.js';
import { getMissingPacks } from './packs/registry.js';
import type { ProjectType } from './packs/types.js';
import { typescriptPackages } from './packs/typescript/files.js';
import { reconcile } from './reconcile.js';
import { BDD_LANE_FILE_PATHS, BDD_LANE_SCRIPT, SAFEWORD_PLUGIN_SCHEMA } from './schema.js';
import { readTickets } from './ticket-sync/index.js';
import { listArchitectureRecords } from './utils/architecture-records.js';
import {
  defaultConfiguredPath,
  readConfiguredDocumentationSources,
  readConfiguredPath,
  resolveConfiguredPath,
  resolveTicketsDirectory,
} from './utils/configured-paths.js';
import { createProjectContext } from './utils/context.js';
import { findFeatureSourcePath } from './utils/feature-source.js';
import { exists, isDirectory, readFileSafe, readJson } from './utils/fs.js';
import { FeatureParseError, findFeatureLineageIssues } from './utils/gherkin-feature.js';
import { parseGlossary, validateGlossary } from './utils/glossary.js';
import { header, info, listItem, success, warn } from './utils/output.js';
import { parsePersonas, validatePersonas } from './utils/personas.js';
import {
  buildCoverageReport,
  buildCoverageReportFromFeature,
  buildSurfaceCoverageReportFromFeature,
  type CoverageReport,
  findMixedCriteriaJtbds,
  findRulesMissingRejectionPaths,
  isRuleId,
  type SurfaceCoverageReport,
} from './utils/scenario-coverage.js';
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

/**
 * Cucumber-harness misalignment advisories (ticket 56JCFZ, TB3.AC1+AC2).
 * Persistent and zero-exit — the setup-time notice alone is ignorable:
 * - Host harness detected, safeword's lane absent, `paths.*` unset → name
 *   the harness and the exact config lines to add. Silent once set.
 * - Host harness AND safeword's starter lane both present (a repo bitten by
 *   pre-56JCFZ scaffolding) → enumerate the leftover lane surface, derived
 *   from the schema constants so the list can't drift. Never edits/deletes.
 */
function findCucumberHarnessAdvisories(
  cwd: string,
  // Detection already ran once for this invocation (createProjectContext →
  // detectProjectType); reuse it instead of re-sweeping the filesystem.
  { existingCucumberHarness, scaffoldBddLane }: ProjectType,
): string[] {
  if (existingCucumberHarness === undefined) return [];

  if (scaffoldBddLane) {
    return [buildLeftoverLaneAdvisory(cwd, existingCucumberHarness)];
  }

  // paths.features alone silences this: the readers consume only the
  // features directory. paths.steps matters only to the scaffolded runner
  // (relocated TypeScript steps), which a host-harness repo isn't using.
  if (readConfiguredPath(cwd, 'features') !== undefined) return [];
  return [
    `Detected a cucumber harness (${existingCucumberHarness}) but paths.features is not set in .safeword/config.json — codify, lint-gherkin, and check cannot see your suite. Add e.g. "paths": { "features": "tests/behaviors", "steps": "tests/steps" } (paths.steps only matters when the scaffolded runner reads relocated TypeScript steps).`,
  ];
}

/** Enumerate the starter-lane leftovers (files/deps/script) from schema constants. */
function buildLeftoverLaneAdvisory(cwd: string, evidence: string): string {
  const leftovers: string[] = BDD_LANE_FILE_PATHS.filter(filePath =>
    exists(nodePath.join(cwd, filePath)),
  );

  const manifest = readPackageJsonSafe(cwd);
  const developmentDependencies = manifest?.devDependencies ?? {};
  leftovers.push(
    ...typescriptPackages.conditional.scaffoldBddLane.filter(dependency =>
      Object.hasOwn(developmentDependencies, dependency),
    ),
  );
  if (typeof manifest?.scripts?.[BDD_LANE_SCRIPT] === 'string') {
    leftovers.push(`"${BDD_LANE_SCRIPT}" script`);
  }

  return `Duplicate BDD lane: a cucumber harness (${evidence}) coexists with safeword's starter lane. Leftover scaffold: ${leftovers.join(', ')}. Safeword never removes these — if the host harness is the real suite, delete the leftovers and set paths.features / paths.steps in .safeword/config.json so safeword reads it.`;
}

interface PackageJsonManifest {
  scripts?: Record<string, unknown>;
  devDependencies?: Record<string, string>;
}

function readPackageJsonSafe(cwd: string): PackageJsonManifest | undefined {
  return readJson(nodePath.join(cwd, 'package.json')) as PackageJsonManifest | undefined;
}

function findDocumentationSourceIssues(cwd: string): string[] {
  return readConfiguredDocumentationSources(cwd).flatMap(source => {
    if (source.type !== 'local') return [];
    return exists(source.resolvedPath)
      ? []
      : [`docs-source: ${source.path}: file or directory not found`];
  });
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
  let isInSection = false;
  const body: string[] = [];
  for (const raw of implPlanContent.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      isInSection = line.slice(3).trim().toLowerCase() === 'arch alignment';
      continue;
    }
    if (isInSection && line !== '') body.push(line);
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
 * feature source or legacy (spec.md, test-definitions.md) pair is cross-referenced
 * into uncovered ACs, stale AC refs, and orphan scenarios. Coverage gaps stay
 * zero-exit advisories; invalid Gherkin is a health issue because the source
 * cannot be read.
 */
interface CoverageDiagnostics {
  issues: string[];
  advisories: string[];
}

function emptyCoverageDiagnostics(): CoverageDiagnostics {
  return { issues: [], advisories: [] };
}

function findCoverageDiagnostics(cwd: string): CoverageDiagnostics {
  const ticketsRoot = resolveTicketsDirectory(cwd);
  const all = emptyCoverageDiagnostics();
  for (const ticketId of listTicketIds(ticketsRoot)) {
    const ticketDiagnostics = coverageDiagnosticsForTicket(cwd, ticketsRoot, ticketId);
    all.issues.push(...ticketDiagnostics.issues);
    all.advisories.push(...ticketDiagnostics.advisories);
    const anchorAdvisory = phaseAnchorAdvisoryForTicket(cwd, ticketsRoot, ticketId);
    if (anchorAdvisory !== undefined) all.advisories.push(anchorAdvisory);
  }
  return all;
}

/**
 * Phase-anchor advisory (issue #824, epic #808; HGYGND artifact-path grammar):
 * an in-progress feature ticket whose current phase carries no valid
 * `phase_anchors` entry gets a zero-exit nudge — the at-rest view of the
 * anchor substrate, verified against the working tree (a filesystem reader is
 * injected, so existence + shape are checked, not just format). Advisory only:
 * enforcement belongs to the deliverable-boundary gate (#810). Hex-shaped
 * legacy anchors are grandfathered by the detector and never re-litigated.
 */
function phaseAnchorAdvisoryForTicket(
  cwd: string,
  ticketsRoot: string,
  ticketId: string,
): string | undefined {
  const content = readFileSafe(nodePath.join(ticketsRoot, ticketId, 'ticket.md'));
  if (content === undefined || !isInProgress(content)) return undefined;
  const verdict = detectUnanchoredPhaseState(content, relpath =>
    readFileSafe(nodePath.join(cwd, relpath)),
  );
  if (verdict.kind !== 'unanchored') return undefined;
  return `${formatCoverageTicketLabel(ticketId)}: ${verdict.reason} The anchor is the exited phase's artifact — boundary checks verify it against the tree.`;
}

/** Build coverage advisories for one ticket, or none if it is not an
 * in-progress, spec-bearing ticket. */
function coverageDiagnosticsForTicket(
  cwd: string,
  ticketsRoot: string,
  ticketId: string,
): CoverageDiagnostics {
  const ticketDirectory = nodePath.join(ticketsRoot, ticketId);
  const ticketContent = readFileSafe(nodePath.join(ticketDirectory, 'ticket.md'));
  if (ticketContent === undefined || !isInProgress(ticketContent))
    return emptyCoverageDiagnostics();

  const specContent = readFileSafe(nodePath.join(ticketDirectory, 'spec.md'));
  if (specContent === undefined) return emptyCoverageDiagnostics();

  const featureSource = readFeatureSource(cwd, ticketId);
  try {
    const report =
      featureSource === undefined
        ? buildCoverageReport(
            specContent,
            readFileSafe(nodePath.join(ticketDirectory, 'test-definitions.md')),
          )
        : buildCoverageReportFromFeature(specContent, featureSource.content);
    const surfaceReport =
      featureSource === undefined
        ? undefined
        : buildSurfaceCoverageReportFromFeature(specContent, featureSource.content);
    const lineageIssues =
      featureSource === undefined ? [] : formatFeatureLineageIssues(cwd, ticketId, featureSource);
    const ruleTier = ruleTierDiagnostics(ticketId, specContent, featureSource);
    return {
      issues: [...lineageIssues, ...ruleTier.issues],
      advisories: [
        ...formatCoverageReport(ticketId, report),
        ...ruleTier.advisories,
        ...formatSurfaceCoverageReport(ticketId, surfaceReport),
      ],
    };
  } catch (parseError: unknown) {
    if (parseError instanceof FeatureParseError && featureSource !== undefined) {
      return {
        issues: [
          `${formatCoverageTicketLabel(ticketId)}: ${nodePath.relative(cwd, featureSource.path)}: invalid Gherkin feature: ${parseError.message}`,
        ],
        advisories: [],
      };
    }
    throw parseError;
  }
}

/** Rule-tier findings for one ticket: mixed-criteria JTBDs (issues) and
 * numbered rules missing a rejection-path scenario (advisories). */
function ruleTierDiagnostics(
  ticketId: string,
  specContent: string,
  featureSource: FeatureSource | undefined,
): CoverageDiagnostics {
  const label = formatCoverageTicketLabel(ticketId);
  return {
    issues: findMixedCriteriaJtbds(specContent).map(
      jtbd =>
        `${label}: JTBD ${jtbd} declares both Acceptance Criteria and numbered Rules; keep one criteria kind per job — convert one set or split the job`,
    ),
    advisories:
      featureSource === undefined
        ? []
        : findRulesMissingRejectionPaths(specContent, featureSource.content).map(
            ruleId =>
              `${label}: numbered rule ${ruleId} has no example of the rule being broken — add a @rejection-tagged scenario under it`,
          ),
  };
}

function formatFeatureLineageIssues(
  cwd: string,
  ticketId: string,
  featureSource: FeatureSource,
): string[] {
  const label = formatCoverageTicketLabel(ticketId);
  const relativePath = nodePath.relative(cwd, featureSource.path);
  return findFeatureLineageIssues(featureSource.content).map(
    issue => `${label}: ${relativePath}: ${issue}`,
  );
}

interface FeatureSource {
  path: string;
  content: string;
}

function readFeatureSource(cwd: string, ticketFolder: string): FeatureSource | undefined {
  const featurePath = findFeatureSourcePath(cwd, ticketFolder);
  const content = featurePath === undefined ? undefined : readFileSafe(featurePath);
  return featurePath === undefined || content === undefined
    ? undefined
    : { path: featurePath, content };
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
  const ticketLabel = formatCoverageTicketLabel(ticketId);
  return [
    ...report.uncovered.map(id =>
      isRuleId(id)
        ? `${ticketLabel}: numbered rule ${id} has no scenario illustrating it (uncovered) — add a scenario tagged @${id}`
        : `${ticketLabel}: acceptance criterion ${id} has no scenario (uncovered)`,
    ),
    ...report.stale.map(reference =>
      isRuleId(reference)
        ? `${ticketLabel}: scenario ref ${reference} matches no numbered rule under its JTBD (stale ref) — retag to a declared rule or declare it in spec.md`
        : `${ticketLabel}: scenario ref ${reference} matches no AC under its JTBD (stale ref)`,
    ),
    ...report.orphan.map(reference =>
      isRuleId(reference)
        ? `${ticketLabel}: scenario ref ${reference} names no JTBD in spec.md (orphan) — fix the tag's JTBD id or add that JTBD to spec.md`
        : `${ticketLabel}: scenario ref ${reference} names no JTBD in spec.md (orphan)`,
    ),
  ];
}

function formatSurfaceCoverageReport(
  ticketId: string,
  report: SurfaceCoverageReport | undefined,
): string[] {
  if (report === undefined) return [];
  const ticketLabel = formatCoverageTicketLabel(ticketId);
  return [
    ...report.missing.map(
      surface =>
        `${ticketLabel}: affected surface ${surface.name} has no @surface.* scenario tag (uncovered surface)`,
    ),
    ...report.stale.map(
      slug =>
        `${ticketLabel}: scenario surface tag @surface.${slug} is not listed under spec.md ## Surfaces Affected (stale surface)`,
    ),
  ];
}

function formatCoverageTicketLabel(ticketId: string): string {
  const dashIndex = ticketId.indexOf('-');
  return dashIndex === -1
    ? ticketId
    : formatTicketReference(ticketId.slice(0, dashIndex), ticketId.slice(dashIndex + 1));
}

function ticketReferenceOf(id: string, labelById: ReadonlyMap<string, string>): string {
  const title = labelById.get(id);
  return title === undefined ? id : formatTicketReference(id, title);
}

/**
 * Warn-only checks (dangling + cycle) over one directed relation field —
 * depends_on (soft, AKZJXC) and blocked_on (hard, MBGQ89). Generic over the edge
 * set; only the field name and cycle wording differ.
 */
function relationAdvisoriesFor(
  nodes: { id: string; dependsOn: string[] }[],
  danglingField: string,
  cycleLabel: string,
  labelById: ReadonlyMap<string, string>,
): string[] {
  const dangling = findDanglingDependencies(nodes).map(
    ({ from, missing }) =>
      `${ticketReferenceOf(from, labelById)}: ${danglingField} ${missing} — no such ticket (dangling ref)`,
  );
  const cyclic = findTicketsInCycles(nodes);
  const cycle =
    cyclic.length > 0
      ? [
          `${cycleLabel} cycle among: ${cyclic.map(id => ticketReferenceOf(id, labelById)).join(', ')} (break the loop)`,
        ]
      : [];
  return [...dangling, ...cycle];
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

  const labelById = new Map(entries.map(entry => [entry.id, entry.title]));
  const statusById = new Map(entries.map(entry => [entry.id, entry.status]));

  // MBGQ89: a blocked_on_override is stale once every listed blocker is `done`
  // (done auto-unblocks, so the override no longer does anything — clean it up).
  const staleOverrides = entries
    .filter(
      entry =>
        entry.blockedOnOverride !== undefined &&
        entry.blockedOn.length > 0 &&
        entry.blockedOn.every(id => statusById.get(id) === 'done'),
    )
    .map(
      entry =>
        `${ticketReferenceOf(entry.id, labelById)}: blocked_on_override is stale — every blocker is done; remove it`,
    );

  return [
    ...relationAdvisoriesFor(
      entries.map(entry => ({ id: entry.id, dependsOn: entry.dependsOn })),
      'depends_on',
      'dependency',
      labelById,
    ),
    ...relationAdvisoriesFor(
      entries.map(entry => ({ id: entry.id, dependsOn: entry.blockedOn })),
      'blocked_on',
      'blocked_on',
      labelById,
    ),
    ...staleOverrides,
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
export interface CheckHealthOptions {
  /**
   * When true, package/pack installation state is excluded from the health
   * result — `missingPackages` and `missingPacks` come back empty regardless
   * of what is on disk. Used by the setup/upgrade self-verify when install was
   * deliberately skipped (`SAFEWORD_SKIP_INSTALL`): a command that was told not
   * to install must not then fault itself for absent packages. Config-file
   * health (missing files, broken patches, persona/glossary) is still checked.
   * Standalone `check` leaves this false so the diagnostic reports the truth.
   */
  skipPackageChecks?: boolean;
}

export async function checkHealth(
  cwd: string,
  options: CheckHealthOptions = {},
): Promise<HealthStatus> {
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
  const result = await reconcile(SAFEWORD_PLUGIN_SCHEMA, 'upgrade', ctx, {
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
    ...findDocumentationSourceIssues(cwd),
  ];

  // Check for missing .claude/settings.json
  if (!exists(nodePath.join(cwd, '.claude', 'settings.json'))) {
    issues.push('Missing: .claude/settings.json');
  }

  // Check for missing language packs (unless install was deliberately skipped)
  const missingPacks = options.skipPackageChecks ? [] : getMissingPacks(cwd);
  const coverageDiagnostics = findCoverageDiagnostics(cwd);
  issues.push(...coverageDiagnostics.issues);

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
      ...findCucumberHarnessAdvisories(cwd, ctx.projectType),
      ...coverageDiagnostics.advisories,
      ...findRelationAdvisories(cwd),
      ...findArchitectureAdvisories(cwd),
    ],
    missingPackages: options.skipPackageChecks ? [] : result.packagesToInstall,
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
