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

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { shapeFingerprint } from './architecture-fingerprint.js';
import {
  discoverLeafDirectories,
  extractMonorepoModel,
  monorepoFingerprint,
  type MonorepoModel,
  type PackageNode,
} from './architecture-monorepo.js';
import { reconcileSections, type SectionStatus } from './architecture-reconcile.js';
import { extractSkeleton, type SkeletonNode } from './architecture-skeleton.js';
import {
  GENERATED_ARCHITECTURE_FILENAME,
  resolveGeneratedArchitecturePath,
} from './configured-paths.js';

export type SelfHealAction =
  | 'created'
  | 'healed'
  | 'unchanged'
  | 'regenerated'
  | 'skipped'
  | 'noop';

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
  render: (priorStamps: Map<string, string>, priorProse: Map<string, string>) => string;
}

function healTarget(target: HealTarget): SelfHealResult {
  const existing = readExisting(target.path);
  const action = decideAction(existing, target.fingerprint, target.hasContent);

  if (isWouldChangeAction(action)) {
    mkdirSync(nodePath.dirname(target.path), { recursive: true });
    const priorStamps = existing === undefined ? new Map() : parseSectionStamps(existing);
    const priorProse = existing === undefined ? new Map() : parseSectionProse(existing);
    writeFileSync(target.path, target.render(priorStamps, priorProse));
  }

  return { action, path: target.path };
}

/** Dry-run of {@link healTarget}: the action it would take, writing nothing. */
function planTarget(target: HealTarget): SelfHealAction {
  return decideAction(readExisting(target.path), target.fingerprint, target.hasContent);
}

/** The single-repo doc: the project's `src/` skeleton at the namespace-root path. */
function singleRepoTarget(projectDirectory: string): HealTarget {
  const fingerprint = shapeFingerprint(projectDirectory);
  const nodes = extractSkeleton(projectDirectory).nodes;
  return {
    path: resolveGeneratedArchitecturePath(projectDirectory),
    fingerprint,
    hasContent: nodes.length > 0,
    render: (priorStamps, priorProse) =>
      renderDocument(nodes, fingerprint, priorStamps, priorProse),
  };
}

/** A colocated leaf: the package's own skeleton at `packages/<pkg>/architecture.generated.md`. */
function leafTarget(packageDirectory: string): HealTarget {
  const fingerprint = shapeFingerprint(packageDirectory);
  const nodes = extractSkeleton(packageDirectory).nodes;
  return {
    path: nodePath.join(packageDirectory, GENERATED_ARCHITECTURE_FILENAME),
    fingerprint,
    hasContent: nodes.length > 0,
    render: (priorStamps, priorProse) =>
      renderDocument(nodes, fingerprint, priorStamps, priorProse),
  };
}

/** The derived root index: the package graph at the namespace-root path. */
function rootIndexTarget(projectDirectory: string): HealTarget {
  const fingerprint = monorepoFingerprint(projectDirectory);
  const model = extractMonorepoModel(projectDirectory);
  return {
    path: resolveGeneratedArchitecturePath(projectDirectory),
    fingerprint,
    hasContent: model.packages.length > 0,
    render: () => renderRootIndex(model, fingerprint),
  };
}

/** The targets a project heals: single-repo → one; monorepo → root index + per-leaf. */
function projectTargets(projectDirectory: string): HealTarget[] {
  const leaves = discoverLeafDirectories(projectDirectory);
  if (leaves.length === 0) return [singleRepoTarget(projectDirectory)];
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
  return 'unchanged';
}

/**
 * Map each section's node name to the fingerprint it was last reconciled
 * against, so a heal can preserve prior stamps and mark prose that lags the
 * new structure instead of silently bumping it current.
 */
function parseSectionStamps(content: string): Map<string, string> {
  const stamps = new Map<string, string>();
  const pattern = /^### (.+)\n+<!-- reconciled: (\S+) -->/gm;

  for (const match of content.matchAll(pattern)) {
    const name = match[1];
    const stamp = match[2];
    if (name !== undefined && stamp !== undefined) stamps.set(name.trim(), stamp);
  }

  return stamps;
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
function parseSectionProse(content: string): Map<string, string> {
  const prose = new Map<string, string>();
  let name: string | undefined;
  let inProse = false;
  let buffer: string[] = [];

  const flush = (): void => {
    if (name !== undefined) {
      const text = buffer.join('\n').trim();
      if (text.length > 0) prose.set(name, text);
    }
    buffer = [];
    inProse = false;
  };

  for (const line of content.split(/\r?\n/)) {
    const heading = /^### (.+)$/.exec(line);
    if (heading?.[1] !== undefined) {
      flush();
      name = heading[1].trim();
    } else if (line.startsWith('## ')) {
      flush();
      name = undefined;
    } else if (name === undefined || line.startsWith(RECONCILED_PREFIX) || line.startsWith('> ⚠')) {
      // Outside a section, or a machine-owned marker line — never prose.
    } else if (!inProse && /^`[^`]*`\s*$/.test(line)) {
      inProse = true; // the code-reference line; prose begins after it
    } else if (inProse) {
      buffer.push(line);
    }
  }
  flush();

  return prose;
}

function renderDocument(
  nodes: SkeletonNode[],
  fingerprint: string,
  priorStamps: Map<string, string>,
  priorProse: Map<string, string>,
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
      // A section the heal has seen before keeps its prior stamp; a brand-new
      // node is stamped current (a placeholder awaiting prose, not stale).
      const stamp = priorStamps.get(verdict.node) ?? fingerprint;
      // Preserve prior prose; a new (or emptied) section falls back to the
      // placeholder the skeleton carries (the purpose floor).
      const prose = priorProse.get(verdict.node) ?? node?.purpose ?? '';
      return node === undefined
        ? renderOrphanSection(verdict.node)
        : renderSection(node, stamp, verdict.status, prose);
    })
    .join('\n');

  return `---\n${GENERATOR_KEY}: ${GENERATOR_VALUE}\n${FINGERPRINT_KEY}: ${fingerprint}\n---\n\n# Architecture\n\n## Modules\n\n${sections}`;
}

function renderSection(
  node: SkeletonNode,
  stamp: string,
  status: SectionStatus,
  prose: string,
): string {
  const marker =
    status === 'stale' ? '\n> ⚠ stale: structure changed since this section was reconciled.\n' : '';

  // Prose is its own block after the machine-owned code-reference line, so a
  // deterministic heal can preserve it (ticket JT852Q).
  return `### ${node.name}\n\n${RECONCILED_PREFIX} ${stamp} -->\n\n\`${node.path}\`\n\n${prose}\n${marker}`;
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
function renderRootIndex(model: MonorepoModel, fingerprint: string): string {
  const sections = model.packages.map(node => renderPackageSection(node, fingerprint)).join('\n');

  const edgeLines = model.edges.map(edge => `- \`${edge.from}\` → \`${edge.to}\``).join('\n');
  const dependencies =
    model.edges.length === 0 ? '_No inter-package dependencies._\n' : `${edgeLines}\n`;

  return `---\n${GENERATOR_KEY}: ${GENERATOR_VALUE}\n${FINGERPRINT_KEY}: ${fingerprint}\n---\n\n# Architecture\n\n## Packages\n\n${sections}\n\n## Dependencies\n\n${dependencies}`;
}

function renderPackageSection(node: PackageNode, stamp: string): string {
  return `### ${node.name}\n\n${RECONCILED_PREFIX} ${stamp} -->\n\n${node.purpose}\n`;
}
