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
  /** Source files that could not be parsed and were skipped, by relative path. */
  skipped: string[];
}

export function extractSkeleton(projectDirectory: string): Skeleton {
  const sourceDirectory = nodePath.join(projectDirectory, 'src');

  let entries: Dirent[];
  try {
    entries = readdirSync(sourceDirectory, { withFileTypes: true });
  } catch {
    return { nodes: [], skipped: [] };
  }

  const nodes = entries
    .filter(entry => entry.isDirectory())
    .map(entry => ({
      name: entry.name,
      path: nodePath.join('src', entry.name),
      purpose: '',
    }));

  return { nodes, skipped: [] };
}
