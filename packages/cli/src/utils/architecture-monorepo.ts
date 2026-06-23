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
  const patterns = detectWorkspaces(projectDirectory);
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
    packages: model.packages.map(node => node.name),
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
