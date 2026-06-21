/**
 * Deterministic architecture skeleton extractor (ticket QD5DTT, Slice 1).
 *
 * Enumerates the structural facts of a single-repo project — the top-level
 * `src/` modules, each with a code reference and a one-line purpose floor —
 * with zero language-model involvement, so the architecture state doc can
 * never hallucinate structure. The fingerprint and reconcile layers build on
 * the model this returns.
 */

import { type Dirent, readdirSync } from 'node:fs';
import nodePath from 'node:path';

/** Placeholder purpose for a freshly extracted node awaiting human prose. */
const PURPOSE_PLACEHOLDER = 'No description yet — awaiting prose.';

export interface SkeletonNode {
  /** Module name — the top-level `src/` subdirectory. */
  name: string;
  /** Code reference: the module's path relative to the project root. */
  path: string;
  /** One-line purpose (the purpose floor); a placeholder until prose is written. */
  purpose: string;
}

export interface Skeleton {
  /** Structural nodes, one per top-level module. */
  nodes: SkeletonNode[];
}

export function extractSkeleton(projectDirectory: string): Skeleton {
  const sourceDirectory = nodePath.join(projectDirectory, 'src');

  let entries: Dirent[];
  try {
    entries = readdirSync(sourceDirectory, { withFileTypes: true });
  } catch {
    return { nodes: [] };
  }

  const nodes = entries
    .filter(entry => entry.isDirectory())
    .map(entry => ({
      name: entry.name,
      // Forward slashes always — the rendered doc and fingerprint must be
      // platform-stable (the fingerprint normalizes paths the same way).
      path: `src/${entry.name}`,
      purpose: PURPOSE_PLACEHOLDER,
    }))
    // Sort by name so the rendered document is deterministic across
    // filesystems (readdirSync order is not guaranteed), like the fingerprint.
    .toSorted((a, b) => a.name.localeCompare(b.name));

  return { nodes };
}

/**
 * The names of nodes that violate the purpose floor — every skeleton node must
 * carry a non-empty one-line purpose. Catches a doc whose purpose was blanked
 * (e.g. hand-edited away), which would otherwise leave the floor unenforced.
 */
export function purposeFloorViolations(nodes: SkeletonNode[]): string[] {
  return nodes.filter(node => node.purpose.trim().length === 0).map(node => node.name);
}
