/**
 * Architecture state-document self-heal (ticket QD5DTT, Slice 1).
 *
 * Reads the generated architecture state document at the fixed
 * `<namespace-root>/architecture.generated.md`, compares its recorded
 * shape-fingerprint against the live one, and deterministically
 * (LLM-free) re-extracts the skeleton when they differ — creating the document
 * when absent and regenerating it when its fingerprint is missing or corrupt.
 * This is the SessionStart entry point that keeps structural facts fresh,
 * including after out-of-band human edits.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { shapeFingerprint } from './architecture-fingerprint.js';
import {
  discoverLeafDirectories,
  discoverUnreadableWorkspaces,
  extractMonorepoModel,
  monorepoFingerprintOf,
  type MonorepoModel,
  type PackageNode,
  type UnreadableWorkspace,
} from './architecture-monorepo.js';
import { reconcileSections, type SectionStatus } from './architecture-reconcile.js';
import {
  extractSkeleton,
  PURPOSE_PLACEHOLDER,
  type SkeletonNode,
} from './architecture-skeleton.js';
import {
  GENERATED_ARCHITECTURE_FILENAME,
  resolveGeneratedArchitecturePath,
} from './configured-paths.js';

export type SelfHealAction =
  'created' | 'healed' | 'unchanged' | 'regenerated' | 'skipped' | 'noop';

export interface SelfHealResult {
  action: SelfHealAction;
  path: string;
}

/** Actions that mutate the doc on disk — the enforcement threshold (FPV0E4). */
const WOULD_CHANGE_ACTIONS = new Set<SelfHealAction>(['created', 'healed', 'regenerated']);

/**
 * Whether an action would change the tree — the single threshold both Slice-2
 * surfaces share. The commit-time hook stages when true; `--check` exits
 * non-zero when true. `unchanged`/`noop` (nothing to do) and `skipped` (foreign
 * doc, not ours to touch) are all false.
 */
export function isWouldChangeAction(action: SelfHealAction): boolean {
  return WOULD_CHANGE_ACTIONS.has(action);
}

const FINGERPRINT_KEY = 'fingerprint';

/** Frontmatter ownership marker — only documents carrying it are safeword's to rewrite. */
const GENERATOR_KEY = 'generator';
const GENERATOR_VALUE = 'safeword-architecture';

/** The frontmatter body (between the `---` fences), CRLF-tolerant, or undefined. */
function frontmatterBody(content: string): string | undefined {
  return /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)?.[1];
}

/**
 * Whether safeword owns this document, i.e. it carries the generator marker.
 * A document without it is hand-authored (or foreign) and must never be
 * overwritten — the marker survives even when the fingerprint is corrupted.
 * Exact-line match so a different generator (e.g. `safeword-architecture-v2`)
 * is not mistaken for this one.
 */
function isSafewordOwned(content: string): boolean {
  return (
    frontmatterBody(content)?.split(/\r?\n/).includes(`${GENERATOR_KEY}: ${GENERATOR_VALUE}`) ??
    false
  );
}

/** Parse the recorded fingerprint from a document's frontmatter, or undefined. */
export function readDocumentFingerprint(content: string): string | undefined {
  const line = frontmatterBody(content)
    ?.split(/\r?\n/)
    .find(candidate => candidate.startsWith(`${FINGERPRINT_KEY}:`));
  if (line === undefined) return undefined;

  const value = line.slice(FINGERPRINT_KEY.length + 1).trim();
  return value.length > 0 ? value : undefined;
}

const RECONCILED_PREFIX = '<!-- reconciled:';

/**
 * A single doc the self-heal machinery operates on. The ownership guard,
 * `decideAction`, fingerprint read/write, and stamp preservation are all shared
 * across the single-repo doc, the monorepo root index, and each leaf — only the
 * path, fingerprint, and renderer differ (ticket XG9SFP).
 */
interface HealTarget {
  path: string;
  fingerprint: string;
  /** Whether the target has content to render — drives the noop/created decision. */
  hasContent: boolean;
  parseProse?: (existing: string) => Map<string, PriorPurpose>;
  /** Optional exact structural check for facts deliberately outside the legacy fingerprint. */
  matchesExisting?: (existing: string) => boolean;
  render: (priorStamps: Map<string, string>, priorProse: Map<string, PriorPurpose>) => string;
}

function healTarget(target: HealTarget): SelfHealResult {
  const existing = readExisting(target.path);
  const action = decideAction(
    existing,
    target.fingerprint,
    target.hasContent,
    target.matchesExisting,
  );

  if (isWouldChangeAction(action)) {
    mkdirSync(nodePath.dirname(target.path), { recursive: true });
    const priorStamps = existing === undefined ? new Map() : parseSectionStamps(existing);
    const priorProse =
      existing === undefined ? new Map() : (target.parseProse ?? parseSectionProse)(existing);
    writeFileSync(target.path, target.render(priorStamps, priorProse));
  }

  return { action, path: target.path };
}

/** Dry-run of {@link healTarget}: the action it would take, writing nothing. */
function planTarget(target: HealTarget): SelfHealAction {
  return decideAction(
    readExisting(target.path),
    target.fingerprint,
    target.hasContent,
    target.matchesExisting,
  );
}

/** A `src/`-skeleton doc: the skeleton of `directory`, rendered to `path`. */
function skeletonTarget(directory: string, path: string): HealTarget {
  const fingerprint = shapeFingerprint(directory);
  const nodes = extractSkeleton(directory).nodes;
  return {
    path,
    fingerprint,
    hasContent: nodes.length > 0,
    matchesExisting: existing => hasMatchingNodePaths(existing, nodes),
    render: (priorStamps, priorProse) =>
      renderDocument(nodes, fingerprint, priorStamps, priorProse),
  };
}

/** The single-repo doc: the project's `src/` skeleton at the namespace-root path. */
function singleRepoTarget(projectDirectory: string): HealTarget {
  return skeletonTarget(projectDirectory, resolveGeneratedArchitecturePath(projectDirectory));
}

/** A colocated leaf: the package's own skeleton at `packages/<pkg>/architecture.generated.md`. */
function leafTarget(packageDirectory: string): HealTarget {
  return skeletonTarget(
    packageDirectory,
    nodePath.join(packageDirectory, GENERATED_ARCHITECTURE_FILENAME),
  );
}

/** The derived root index: the package graph at the namespace-root path. */
function rootIndexTarget(projectDirectory: string): HealTarget {
  const model = extractMonorepoModel(projectDirectory);
  const fingerprint = monorepoFingerprintOf(projectDirectory, model);
  return {
    path: resolveGeneratedArchitecturePath(projectDirectory),
    fingerprint,
    // An unreadable workspace is content too: a root index that exists only to carry the
    // "config unreadable" advisory is still worth writing — silence would read as "no
    // monorepo here" when in fact one is present but unreadable (UWP4XK).
    hasContent: model.packages.length > 0 || model.unreadableWorkspaces.length > 0,
    matchesExisting: existing => hasMatchingRootPackagePurposes(existing, model.packages),
    parseProse: parseRootPackageProse,
    render: (_priorStamps, priorProse) => renderRootIndex(model, fingerprint, priorProse),
  };
}

/** The targets a project heals: single-repo → one; monorepo → root index + per-leaf. */
function projectTargets(projectDirectory: string): HealTarget[] {
  const leaves = discoverLeafDirectories(projectDirectory);
  // A repo whose ONLY workspace signal is an unparseable manager (zero discovered leaves)
  // is still a monorepo we must not mistake for a single-repo: render the root index so the
  // "config unreadable" advisory has a home, rather than silently emitting a single-repo doc
  // that omits the whole declared-but-unreadable workspace (UWP4XK).
  if (leaves.length === 0 && discoverUnreadableWorkspaces(projectDirectory).length === 0) {
    return [singleRepoTarget(projectDirectory)];
  }
  return [rootIndexTarget(projectDirectory), ...leaves.map(leaf => leafTarget(leaf))];
}

export function selfHeal(projectDirectory: string): SelfHealResult {
  return healTarget(singleRepoTarget(projectDirectory));
}

/**
 * Dry-run of {@link selfHeal}: report the action it *would* take, writing
 * nothing. The Slice-2 enforcement surfaces use this to decide whether the
 * single-repo doc is stale without mutating the tree.
 */
export function planSelfHeal(projectDirectory: string): SelfHealAction {
  return planTarget(singleRepoTarget(projectDirectory));
}

/**
 * Self-heal every node of a project (ticket XG9SFP): a single-repo project
 * heals one doc (byte-identical to {@link selfHeal}); a monorepo heals the
 * derived root index plus one colocated leaf per package with a `src/` tree
 * (empty-skeleton packages noop). Each node is fingerprinted independently, so
 * an unchanged node returns `unchanged` and is left untouched.
 */
export function selfHealProject(projectDirectory: string): SelfHealResult[] {
  return projectTargets(projectDirectory).map(target => healTarget(target));
}

/** Dry-run of {@link selfHealProject}: the action per node, writing nothing. */
export function planSelfHealProject(projectDirectory: string): SelfHealAction[] {
  return projectTargets(projectDirectory).map(target => planTarget(target));
}

function readExisting(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

function decideAction(
  existing: string | undefined,
  fingerprint: string,
  hasModules: boolean,
  matchesExisting?: (existing: string) => boolean,
): SelfHealAction {
  // Don't birth an empty doc: a contentless "## Modules" implies "no modules",
  // which is false for a monorepo the single-repo extractor can't read yet.
  // An existing doc still heals toward empty (orphan markers show real removals).
  if (existing === undefined) return hasModules ? 'created' : 'noop';

  // Never touch a document safeword does not own — a hand-written architecture
  // doc has no generator marker and must be left exactly as-is.
  if (!isSafewordOwned(existing)) return 'skipped';

  const recorded = readDocumentFingerprint(existing);
  if (recorded === undefined) return 'regenerated';
  if (recorded !== fingerprint) return 'healed';
  if (matchesExisting !== undefined && !matchesExisting(existing)) return 'healed';
  return 'unchanged';
}

/**
 * Compare rendered node references with the live skeleton. Canonical paths stay
 * outside the released name-only fingerprint recipe so upgrades do not falsely
 * stale every existing section, but path-only drift still self-heals.
 */
function hasMatchingNodePaths(content: string, nodes: SkeletonNode[]): boolean {
  const paths = new Map<string, string>();
  const pattern = /^### (.+)\n+<!-- reconciled: \S+ -->\n+`([^`]*)`\s*$/gm;

  for (const match of normalizeLineEndings(content).matchAll(pattern)) {
    const name = match[1];
    const path = match[2];
    if (name !== undefined && path !== undefined) paths.set(name.trim(), path);
  }

  return (
    paths.size === nodes.length &&
    nodes.every(node => paths.get(node.name) === node.path) &&
    hasMatchingGeneratedPurposes(nodes, parseSectionProse(content))
  );
}

/** Whether no generated purpose has changed since this document was written. */
function hasMatchingGeneratedPurposes(
  nodes: readonly Pick<SkeletonNode, 'name' | 'purpose'>[],
  priorProse: Map<string, PriorPurpose>,
): boolean {
  return nodes.every(node => {
    const prior = priorProse.get(node.name);
    return prior?.generated !== true || prior.text === node.purpose;
  });
}

/** Root-index equivalent of {@link hasMatchingNodePaths}; there are no code paths to compare. */
function hasMatchingRootPackagePurposes(content: string, packages: PackageNode[]): boolean {
  return hasMatchingGeneratedPurposes(packages, parseRootPackageProse(content));
}

/**
 * Map each section's node name to the fingerprint it was last reconciled
 * against, so a heal can preserve prior stamps and mark prose that lags the
 * new structure instead of silently bumping it current.
 */
function parseSectionStamps(content: string): Map<string, string> {
  const stamps = new Map<string, string>();
  const pattern = /^### (.+)\n+<!-- reconciled: (\S+) -->/gm;

  for (const match of normalizeLineEndings(content).matchAll(pattern)) {
    const name = match[1];
    const stamp = match[2];
    if (name !== undefined && stamp !== undefined) stamps.set(name.trim(), stamp);
  }

  return stamps;
}

/**
 * Normalize only the parser's view of line endings. The original document bytes
 * remain untouched when no structural heal is needed.
 */
function normalizeLineEndings(content: string): string {
  return content.replaceAll('\r\n', '\n');
}

/**
 * Map each section's node name to its preserved prose (ticket JT852Q) — the twin
 * of {@link parseSectionStamps}. The prose region is the section body after the
 * machine-owned `` `path` `` code-reference line, excluding the reconciled marker
 * and the `> ⚠ stale`/`> ⚠ orphaned` blockquote markers. Empty/whitespace-only
 * prose is omitted (so the render falls back to the placeholder, honoring the
 * purpose floor). CRLF-tolerant, so a heal preserves prose written under either
 * line ending. This is what lets a deterministic heal keep a module's
 * description instead of resetting it to the placeholder.
 */
interface PriorPurpose {
  text: string;
  /** True only when this exact text is still generated metadata, not human prose. */
  generated: boolean;
}

const SEEDED_PURPOSE_PREFIX = '<!-- seeded-purpose: ';

function seededPurposeMarker(purpose: string): string {
  return `${SEEDED_PURPOSE_PREFIX}${purposeDigest(purpose)} -->`;
}

function purposeDigest(purpose: string): string {
  return createHash('sha256').update(purpose).digest('hex');
}

function parseSeededPurposeDigest(line: string): string | undefined {
  if (!line.startsWith(SEEDED_PURPOSE_PREFIX) || !line.endsWith(' -->')) return undefined;
  const digest = line.slice(SEEDED_PURPOSE_PREFIX.length, -' -->'.length);
  return /^[a-f0-9]{64}$/.test(digest) ? digest : undefined;
}

/** Preserve a non-empty section body and classify whether it is still generator-owned. */
function recordPriorPurpose(
  purposes: Map<string, PriorPurpose>,
  name: string | undefined,
  lines: string[],
  seededDigest: string | undefined,
): void {
  if (name === undefined) return;
  const text = lines.join('\n').trim();
  if (text.length === 0) return;
  purposes.set(name, {
    text,
    generated: text === PURPOSE_PLACEHOLDER || seededDigest === purposeDigest(text),
  });
}

function parseSectionProse(content: string): Map<string, PriorPurpose> {
  const prose = new Map<string, PriorPurpose>();
  let name: string | undefined;
  let inProse = false;
  let buffer: string[] = [];
  let seededDigest: string | undefined;

  const flush = (next: string | undefined): void => {
    recordPriorPurpose(prose, name, buffer, seededDigest);
    name = next;
    buffer = [];
    inProse = false;
    seededDigest = undefined;
  };

  for (const line of content.split(/\r?\n/)) {
    const heading = /^### (.+)$/.exec(line)?.[1];
    if (heading !== undefined) {
      flush(heading.trim());
    } else if (line.startsWith('## ')) {
      flush(undefined);
    } else if (name !== undefined) {
      seededDigest = parseSeededPurposeDigest(line) ?? seededDigest;
      inProse = accumulateProseLine(line, inProse, buffer);
    }
  }
  flush(undefined);

  return prose;
}

/**
 * Classify one line inside a section: machine-owned markers are skipped; the
 * `` `path` `` code-reference opens the prose region; every line after it is
 * prose. Returns the next `inProse` state.
 */
function accumulateProseLine(line: string, inProse: boolean, buffer: string[]): boolean {
  if (
    line.startsWith(RECONCILED_PREFIX) ||
    line.startsWith('> ⚠') ||
    line.startsWith(SEEDED_PURPOSE_PREFIX)
  ) {
    return inProse;
  }
  if (!inProse) return /^`[^`]*`\s*$/.test(line);
  buffer.push(line);
  return true;
}

/**
 * Root-index package purposes have no code-reference line, unlike module
 * sections. Parse only the `## Packages` section and retain a human edit while
 * recognizing unchanged placeholders/seeds as generator-owned.
 */
function parseRootPackageProse(content: string): Map<string, PriorPurpose> {
  const prose = new Map<string, PriorPurpose>();
  let isInPackages = false;
  let name: string | undefined;
  let buffer: string[] = [];
  let seededDigest: string | undefined;

  const flush = (): void => {
    recordPriorPurpose(prose, name, buffer, seededDigest);
    name = undefined;
    buffer = [];
    seededDigest = undefined;
  };

  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      flush();
      isInPackages = line.slice(3).trim() === 'Packages';
    } else if (isInPackages && line.startsWith('### ')) {
      flush();
      name = line.slice(4).trim();
    } else if (name !== undefined) {
      seededDigest = parseSeededPurposeDigest(line) ?? seededDigest;
      if (
        !line.startsWith(RECONCILED_PREFIX) &&
        !line.startsWith(SEEDED_PURPOSE_PREFIX) &&
        !line.startsWith('> ⚠')
      ) {
        buffer.push(line);
      }
    }
  }
  flush();
  return prose;
}

/**
 * The shared frontmatter every generated doc opens with: the ownership marker, the
 * fingerprint line, and the `# Architecture` heading. This is the serialization side of the
 * contract that `readDocumentFingerprint` / `isSafewordOwned` (and the standalone hook
 * parser) read back, so both renderers must emit it byte-identically — one writer guarantees
 * that.
 */
function architectureFrontmatter(fingerprint: string): string {
  return `---\n${GENERATOR_KEY}: ${GENERATOR_VALUE}\n${FINGERPRINT_KEY}: ${fingerprint}\n---\n\n# Architecture\n\n`;
}

function renderDocument(
  nodes: SkeletonNode[],
  fingerprint: string,
  priorStamps: Map<string, string>,
  priorProse: Map<string, PriorPurpose>,
): string {
  // reconcileSections is the single source of truth for per-section status;
  // this layer only renders markers from its verdicts.
  const verdicts = reconcileSections({
    priorStamps: Object.fromEntries(priorStamps),
    nodeNames: nodes.map(node => node.name),
    fingerprint,
  });
  const nodeByName = new Map(nodes.map(node => [node.name, node]));

  const sections = verdicts
    .map(verdict => {
      const node = nodeByName.get(verdict.node);
      if (node === undefined) return renderOrphanSection(verdict.node);
      // A section the heal has seen before keeps its prior stamp; a brand-new
      // node is stamped current (a placeholder awaiting prose, not stale).
      const stamp = priorStamps.get(verdict.node) ?? fingerprint;
      const prior = priorProse.get(verdict.node);
      // Metadata seeds remain refreshable, while anything a person wrote wins
      // permanently over source-derived text on future structural heals.
      const useSeed = node.seededPurpose === true && (prior === undefined || prior.generated);
      const prose = useSeed || prior?.generated ? node.purpose : (prior?.text ?? node.purpose);
      return renderSection(node, stamp, verdict.status, prose, useSeed);
    })
    .join('\n');

  return `${architectureFrontmatter(fingerprint)}## Modules\n\n${sections}`;
}

function renderSection(
  node: SkeletonNode,
  stamp: string,
  status: SectionStatus,
  prose: string,
  seededPurpose: boolean,
): string {
  const marker =
    status === 'stale' ? '\n> ⚠ stale: structure changed since this section was reconciled.\n' : '';

  // Prose is its own block after the machine-owned code-reference line, so a
  // deterministic heal can preserve it (ticket JT852Q).
  const seed = seededPurpose ? `\n${seededPurposeMarker(prose)}\n` : '';
  return `### ${node.name}\n\n${RECONCILED_PREFIX} ${stamp} -->\n\n\`${node.path}\`\n${seed}\n${prose}\n${marker}`;
}

function renderOrphanSection(name: string): string {
  return `### ${name}\n\n> ⚠ orphaned: this section describes a module that no longer exists.\n`;
}

/**
 * Render the derived monorepo root index (ticket XG9SFP): a `## Packages`
 * section (one reconciled subsection per package) plus a `## Dependencies`
 * section listing inter-package edges. Shares the ownership marker and
 * fingerprint frontmatter with the single-repo doc, so the root index self-heals
 * identically. Unlike the leaf/single-repo doc it does NOT carry reconcile
 * orphan/stale markers: the root index is fully derived (no human prose to
 * protect), so a removed package is simply dropped rather than left as an
 * accumulating ghost section — freshness is the package set + fingerprint, not
 * per-section prose markers.
 */
function renderRootIndex(
  model: MonorepoModel,
  fingerprint: string,
  priorProse: Map<string, PriorPurpose>,
): string {
  const sections = model.packages
    .map(node => renderPackageSection(node, fingerprint, priorProse.get(node.name)))
    .join('\n');

  const edgeLines = model.edges.map(edge => `- \`${edge.from}\` → \`${edge.to}\``).join('\n');
  const dependencies =
    model.edges.length === 0 ? '_No inter-package dependencies._\n' : `${edgeLines}\n`;

  return `${architectureFrontmatter(fingerprint)}## Packages\n\n${sections}\n## Dependencies\n\n${dependencies}${renderCoverageGaps(model.unreadableWorkspaces)}`;
}

/**
 * A `## Coverage gaps` advisory naming each workspace manager that is present at the root
 * but unparseable (ticket UWP4XK, GitHub #558). Empty string when there are none, so the
 * section appears only when it carries weight. This is the discovery-layer analogue of the
 * per-package "not introspected" marker (ZRW21K): a manager that discovered nothing has no
 * package line to mark, so the honesty signal lives here instead — the packages it would
 * have contributed may be missing from the index above, and the index says so out loud.
 */
function renderCoverageGaps(unreadable: UnreadableWorkspace[]): string {
  if (unreadable.length === 0) return '';
  const items = unreadable.map(entry => `> - \`${entry.config}\` (${entry.manager})`).join('\n');
  return `## Coverage gaps\n\n> ⚠ not introspected — workspace config unreadable. A present workspace manager's member list could not be parsed, so its packages may be missing above. Fix the config and re-run \`safeword architecture\`:\n${items}\n`;
}

function renderPackageSection(
  node: PackageNode,
  stamp: string,
  prior: PriorPurpose | undefined,
): string {
  // An un-introspected package (no source modules to enumerate, so no leaf doc) is
  // marked explicitly — never shown with the bare prose placeholder, which would
  // read as "described but empty" rather than "nothing to map here" (ZRW21K). The
  // wording says "no source modules" rather than "no recognized source layout":
  // with the broadened recognizer (issue #843) a package reaches this only when it
  // genuinely has no enumerable modules, not because its layout was misread.
  const { purpose, seeded } = resolvePackagePurpose(node, prior);
  const body = renderPackagePurposeBody(node, purpose);
  const seed = seeded ? `\n${seededPurposeMarker(node.purpose)}\n` : '';
  return `### ${node.name}\n\n${RECONCILED_PREFIX} ${stamp} -->\n${seed}\n${body}\n`;
}

/** Resolve a root-package purpose, preferring human prose over generator-owned text. */
function resolvePackagePurpose(
  node: PackageNode,
  prior: PriorPurpose | undefined,
): { purpose: string | undefined; seeded: boolean } {
  const generatedPrior = prior?.generated === true;
  const seeded = node.seededPurpose === true && (prior === undefined || generatedPrior);
  return {
    purpose: seeded || generatedPrior ? node.purpose : prior?.text,
    seeded,
  };
}

/** Render the available purpose together with the honesty marker when no modules were found. */
function renderPackagePurposeBody(node: PackageNode, purpose: string | undefined): string {
  if (node.introspected) return purpose ?? node.purpose;
  if (purpose !== undefined) return `${purpose}\n\n> ⚠ not introspected — no source modules to map`;
  return '> ⚠ not introspected — no source modules to map';
}
