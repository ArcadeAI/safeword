/**
 * Monorepo model for the hierarchical architecture doc (ticket XG9SFP, Slice 3).
 *
 * Discovers workspace leaf packages, builds the package/edge model that the
 * derived root index renders, and computes the root-index fingerprint. The
 * fingerprint deliberately covers only ROOT-owned shape — the package set, the
 * inter-package dependency edges, and the shared dependency-cruiser boundary
 * config — so a boundary-config edit moves the root once and never churns a
 * leaf, while a leaf's internal `src/` change moves only that leaf's own
 * `shapeFingerprint`.
 */

import { createHash } from 'node:crypto';
import { globSync } from 'node:fs';
import nodePath from 'node:path';

import { extractSkeleton } from './architecture-skeleton.js';
import { detectWorkspaces } from './depcruise-config.js';
import { isDirectory, readFileSafe, readJson } from './fs.js';

/** Placeholder purpose for a freshly modelled package awaiting prose. */
const PURPOSE_PLACEHOLDER = 'No description yet — awaiting prose.';

/** Candidate dependency-cruiser config filenames (the shared, root-owned boundary). */
const DEPENDENCY_CRUISER_CONFIG_NAMES = [
  '.dependency-cruiser.cjs',
  '.dependency-cruiser.js',
  '.dependency-cruiser.mjs',
  '.dependency-cruiser.json',
];

/** Manifest sections whose workspace-internal keys become inter-package edges. */
const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

const byString = (a: string, b: string): number => a.localeCompare(b);

export interface PackageNode {
  /** Package name from its manifest (falls back to the directory name). */
  name: string;
  /** Absolute path to the package directory. */
  dir: string;
  /** One-line purpose (the purpose floor); a placeholder until prose is written. */
  purpose: string;
  /**
   * Whether the package has a recognized source layout (a non-empty `src/`
   * skeleton, so it gets a leaf doc). A package that is `false` here is listed in
   * the root index but explicitly marked "not introspected" rather than shown
   * with a bare placeholder — incomplete, never silently complete (ZRW21K).
   */
  introspected: boolean;
}

interface PackageEdge {
  from: string;
  to: string;
}

export interface MonorepoModel {
  packages: PackageNode[];
  edges: PackageEdge[];
}

/**
 * Absolute directories of the workspace leaf packages, sorted. Expands the
 * workspace globs from the manifest and keeps only directories that carry a
 * `package.json`. Returns `[]` for a non-workspace project.
 */
export function discoverLeafDirectories(projectDirectory: string): string[] {
  // package.json `workspaces` wins; pnpm-workspace.yaml is the fallback (pnpm
  // ignores the package.json field, so a repo with both is npm-authoritative).
  const patterns = detectWorkspaces(projectDirectory) ?? detectPnpmWorkspaces(projectDirectory);
  if (patterns === undefined) return [];

  const matches = new Set<string>();
  for (const pattern of patterns) {
    const globMatches = globSync(pattern, { cwd: projectDirectory });
    for (const match of globMatches) {
      const absolute = nodePath.join(projectDirectory, match);
      if (
        isDirectory(absolute) &&
        readJson(nodePath.join(absolute, 'package.json')) !== undefined
      ) {
        matches.add(absolute);
      }
    }
  }

  return [...matches].toSorted(byString);
}

/** The package/edge model the root index renders over. */
export function extractMonorepoModel(projectDirectory: string): MonorepoModel {
  const packages: PackageNode[] = discoverLeafDirectories(projectDirectory)
    .map(dir => ({
      name: packageName(dir),
      dir,
      purpose: PURPOSE_PLACEHOLDER,
      introspected: extractSkeleton(dir).nodes.length > 0,
    }))
    .toSorted((a, b) => byString(a.name, b.name));

  const names = new Set(packages.map(node => node.name));
  const edges: PackageEdge[] = [];
  for (const node of packages) {
    for (const dependencyName of manifestDependencyNames(node.dir)) {
      if (names.has(dependencyName) && dependencyName !== node.name) {
        edges.push({ from: node.name, to: dependencyName });
      }
    }
  }
  edges.sort((a, b) => byString(a.from, b.from) || byString(a.to, b.to));

  return { packages, edges };
}

/**
 * Root-index fingerprint: a hash over the package set, the inter-package edges,
 * and the shared boundary config. Distinct from per-leaf `shapeFingerprint`.
 */
export function monorepoFingerprint(projectDirectory: string): string {
  const model = extractMonorepoModel(projectDirectory);
  const inputs = {
    // Introspection status is part of the root shape: a package gaining or losing
    // a `src/` tree flips its root-index line (marker ↔ described), so the root
    // index must re-render — otherwise the "not introspected" marker goes stale.
    packages: model.packages.map(node => `${node.name}:${node.introspected}`),
    edges: model.edges.map(edge => `${edge.from}->${edge.to}`),
    boundaryConfig: readBoundaryConfig(projectDirectory),
  };
  return createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
}

function readManifest(packageDirectory: string): Record<string, unknown> | undefined {
  const manifest = readJson(nodePath.join(packageDirectory, 'package.json'));
  return manifest !== null && typeof manifest === 'object'
    ? (manifest as Record<string, unknown>)
    : undefined;
}

function packageName(packageDirectory: string): string {
  const name = readManifest(packageDirectory)?.name;
  return typeof name === 'string' && name.length > 0 ? name : nodePath.basename(packageDirectory);
}

function manifestDependencyNames(packageDirectory: string): string[] {
  const manifest = readManifest(packageDirectory);
  if (manifest === undefined) return [];

  const names = new Set<string>();
  for (const section of DEPENDENCY_SECTIONS) {
    const entry = manifest[section];
    if (entry !== null && typeof entry === 'object') {
      for (const name of Object.keys(entry)) names.add(name);
    }
  }
  return [...names];
}

function readBoundaryConfig(projectDirectory: string): string {
  for (const name of DEPENDENCY_CRUISER_CONFIG_NAMES) {
    const content = readFileSafe(nodePath.join(projectDirectory, name));
    if (content !== undefined) return content;
  }
  return '';
}

/**
 * Read workspace globs from `pnpm-workspace.yaml` (ticket ZRW21K) — pnpm stores
 * its workspace list here, not in `package.json`'s `workspaces` field, so a pnpm
 * monorepo would otherwise be invisible. A dependency-free parse of the
 * block-list form:
 *
 *   packages:
 *     - "packages/*"
 *     - "apps/*"
 *
 * Returns the include globs (quotes stripped, `!`-exclusions skipped), or
 * `undefined` when the file is absent or not in the block-list form (flow-style
 * `packages: [..]` and other shapes are out of scope and degrade to no-workspaces
 * — incomplete, never silently wrong).
 */
function detectPnpmWorkspaces(projectDirectory: string): string[] | undefined {
  const content = readFileSafe(nodePath.join(projectDirectory, 'pnpm-workspace.yaml'));
  if (content === undefined) return undefined;

  const lines = content.split(/\r?\n/);
  const start = lines.findIndex(line => /^packages:\s*$/.test(line));
  if (start === -1) return undefined;

  const globs = collectPnpmGlobs(lines.slice(start + 1));
  return globs.length > 0 ? globs : undefined;
}

/** Collect the include globs from a pnpm `packages:` block, stopping at the dedent. */
function collectPnpmGlobs(blockLines: string[]): string[] {
  const globs: string[] = [];
  for (const line of blockLines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue; // blank/comment inside the block
    const item = /^\s+-\s+(\S.*)$/.exec(line);
    if (item?.[1] === undefined) break; // dedent / non-list line — block ended
    const glob = item[1].trim().replaceAll(/^["']|["']$/g, '');
    if (glob.length > 0 && !glob.startsWith('!')) globs.push(glob);
  }
  return globs;
}
