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

import { exists, isDirectory } from './fs.js';

/** Placeholder purpose for a freshly extracted node awaiting human prose. */
const PURPOSE_PLACEHOLDER = 'No description yet — awaiting prose.';

/**
 * Conventional top-level directories of a Go module (ticket ZD70P1). Used as the
 * structural modules when a directory has a `go.mod` and no `src/` tree, so a Go
 * project is described by its real layout instead of the empty skeleton that left
 * it "not introspected".
 */
const GO_LAYOUT_DIRECTORIES = ['cmd', 'internal', 'pkg'] as const;

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
  // The `src/` layout (TS/JS) is authoritative and unchanged: when it yields
  // modules, that is the skeleton.
  const sourceNodes = enumerateModuleDirectories(
    nodePath.join(projectDirectory, 'src'),
    name => `src/${name}`,
  );
  if (sourceNodes.length > 0) return { nodes: sourceNodes };

  // No `src/` modules: a Go module (a `go.mod` is present) is described by its
  // conventional top-level layout directories instead (ticket ZD70P1). A flat Go
  // package with none of these stays an empty skeleton — honestly "not
  // introspected" (ZRW21K), never falsely complete.
  if (exists(nodePath.join(projectDirectory, 'go.mod'))) {
    return { nodes: goLayoutNodes(projectDirectory) };
  }

  return { nodes: sourceNodes };
}

/**
 * The immediate subdirectories of `directory` as skeleton nodes, sorted by name
 * (readdirSync order is not guaranteed; the rendered doc and fingerprint must be
 * deterministic). `pathFor` maps a module name to its forward-slashed code
 * reference — platform-stable, the way the fingerprint normalizes paths.
 */
function enumerateModuleDirectories(
  directory: string,
  pathFor: (name: string) => string,
): SkeletonNode[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => ({ name: entry.name, path: pathFor(entry.name), purpose: PURPOSE_PLACEHOLDER }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

/** The recognized Go layout directories that actually exist, as sorted nodes. */
function goLayoutNodes(projectDirectory: string): SkeletonNode[] {
  return GO_LAYOUT_DIRECTORIES.filter(name => isDirectory(nodePath.join(projectDirectory, name)))
    .map(name => ({ name, path: name, purpose: PURPOSE_PLACEHOLDER }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

/**
 * The names of nodes that violate the purpose floor — every skeleton node must
 * carry a non-empty one-line purpose. Catches a doc whose purpose was blanked
 * (e.g. hand-edited away), which would otherwise leave the floor unenforced.
 */
export function purposeFloorViolations(nodes: SkeletonNode[]): string[] {
  return nodes.filter(node => node.purpose.trim().length === 0).map(node => node.name);
}
