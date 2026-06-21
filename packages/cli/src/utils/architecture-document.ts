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
import { reconcileSections, type SectionStatus } from './architecture-reconcile.js';
import { extractSkeleton, type SkeletonNode } from './architecture-skeleton.js';
import { resolveGeneratedArchitecturePath } from './configured-paths.js';

type SelfHealAction = 'created' | 'healed' | 'unchanged' | 'regenerated' | 'skipped' | 'noop';

export interface SelfHealResult {
  action: SelfHealAction;
  path: string;
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

export function selfHeal(projectDirectory: string): SelfHealResult {
  const path = resolveGeneratedArchitecturePath(projectDirectory);
  const fingerprint = shapeFingerprint(projectDirectory);
  const existing = readExisting(path);
  const hasModules = extractSkeleton(projectDirectory).nodes.length > 0;
  const action = decideAction(existing, fingerprint, hasModules);

  if (action !== 'unchanged' && action !== 'skipped' && action !== 'noop') {
    mkdirSync(nodePath.dirname(path), { recursive: true });
    const priorStamps = existing === undefined ? new Map() : parseSectionStamps(existing);
    writeFileSync(path, renderDocument(projectDirectory, fingerprint, priorStamps));
  }

  return { action, path };
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

function renderDocument(
  projectDirectory: string,
  fingerprint: string,
  priorStamps: Map<string, string>,
): string {
  const nodes = extractSkeleton(projectDirectory).nodes;

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
      return node === undefined
        ? renderOrphanSection(verdict.node)
        : renderSection(node, stamp, verdict.status);
    })
    .join('\n');

  return `---\n${GENERATOR_KEY}: ${GENERATOR_VALUE}\n${FINGERPRINT_KEY}: ${fingerprint}\n---\n\n# Architecture\n\n## Modules\n\n${sections}`;
}

function renderSection(node: SkeletonNode, stamp: string, status: SectionStatus): string {
  const marker =
    status === 'stale' ? '\n> ⚠ stale: structure changed since this section was reconciled.\n' : '';

  return `### ${node.name}\n\n${RECONCILED_PREFIX} ${stamp} -->\n\n\`${node.path}\` — ${node.purpose}\n${marker}`;
}

function renderOrphanSection(name: string): string {
  return `### ${name}\n\n> ⚠ orphaned: this section describes a module that no longer exists.\n`;
}
