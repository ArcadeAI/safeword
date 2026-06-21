/**
 * Architecture state-document self-heal (ticket QD5DTT, Slice 1).
 *
 * Reads the document at the configured `paths.architecture`, compares its
 * recorded shape-fingerprint against the live one, and deterministically
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
import { resolveConfiguredPath } from './configured-paths.js';

export type SelfHealAction = 'created' | 'healed' | 'unchanged' | 'regenerated';

export interface SelfHealResult {
  action: SelfHealAction;
  path: string;
}

const FINGERPRINT_KEY = 'fingerprint';

/** Parse the recorded fingerprint from a document's frontmatter, or undefined. */
export function readDocumentFingerprint(content: string): string | undefined {
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(content);
  if (frontmatter === null) return undefined;

  const line = frontmatter[1]
    .split('\n')
    .find(candidate => candidate.startsWith(`${FINGERPRINT_KEY}:`));
  if (line === undefined) return undefined;

  const value = line.slice(FINGERPRINT_KEY.length + 1).trim();
  return value.length > 0 ? value : undefined;
}

const RECONCILED_PREFIX = '<!-- reconciled:';

export function selfHeal(projectDirectory: string): SelfHealResult {
  const path = resolveConfiguredPath(projectDirectory, 'architecture');
  const fingerprint = shapeFingerprint(projectDirectory);
  const existing = readExisting(path);
  const action = decideAction(existing, fingerprint);

  if (action !== 'unchanged') {
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

function decideAction(existing: string | undefined, fingerprint: string): SelfHealAction {
  if (existing === undefined) return 'created';

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
    stamps.set(match[1].trim(), match[2]);
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

  return `---\n${FINGERPRINT_KEY}: ${fingerprint}\n---\n\n# Architecture\n\n## Modules\n\n${sections}`;
}

function renderSection(node: SkeletonNode, stamp: string, status: SectionStatus): string {
  const marker =
    status === 'stale' ? '\n> ⚠ stale: structure changed since this section was reconciled.\n' : '';

  return `### ${node.name}\n\n${RECONCILED_PREFIX} ${stamp} -->\n\n\`${node.path}\` — ${node.purpose}\n${marker}`;
}

function renderOrphanSection(name: string): string {
  return `### ${name}\n\n> ⚠ orphaned: this section describes a module that no longer exists.\n`;
}
