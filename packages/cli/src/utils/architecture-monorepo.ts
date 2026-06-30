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

import { extractSkeleton, PURPOSE_PLACEHOLDER } from './architecture-skeleton.js';
import { readBoundaryConfig } from './boundary-config.js';
import { readCargoPackageName, readCargoWorkspaceMembers } from './cargo-manifest.js';
import { detectWorkspaces } from './depcruise-config.js';
import { isDirectory, readFileSafe, readJson } from './fs.js';
import { readDelimitedBlock } from './manifest-block.js';
import { dependencySectionNames } from './manifest-dependencies.js';
import { readPyprojectName, readUvWorkspaceMembers } from './pyproject-manifest.js';

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
  // Within JS, package.json `workspaces` wins over pnpm-workspace.yaml (pnpm
  // ignores the package.json field, so a repo with both is npm-authoritative) —
  // they are alternative managers for the same ecosystem, not additive. Across
  // ecosystems, managers are UNIONED: go.work, Cargo `[workspace]`, and uv
  // `[tool.uv.workspace]` describe disjoint package sets (Go/Rust/Python dirs),
  // so a polyglot monorepo declaring packages with more than one manager at once
  // is fully discovered, never silently reduced to the first manager's packages
  // (ticket MGWZ4P). Same-dir overlaps collapse in the leaf `Set` below.
  const jsPatterns = detectWorkspaces(projectDirectory) ?? detectPnpmWorkspaces(projectDirectory);
  const patterns = [
    jsPatterns,
    detectGoWork(projectDirectory),
    detectCargoWorkspace(projectDirectory),
    detectUvWorkspace(projectDirectory),
  ]
    .filter((group): group is string[] => group !== undefined)
    .flat();
  if (patterns.length === 0) return [];

  const matches = new Set<string>();
  for (const pattern of patterns) {
    const globMatches = globSync(pattern, { cwd: projectDirectory });
    for (const match of globMatches) {
      const absolute = nodePath.join(projectDirectory, match);
      if (isDirectory(absolute) && hasRecognizedManifest(absolute)) {
        matches.add(absolute);
      }
    }
  }

  return [...matches].toSorted(byString);
}

/** A discovered directory is a leaf package if it carries a recognized manifest. */
function hasRecognizedManifest(directory: string): boolean {
  return (
    readJson(nodePath.join(directory, 'package.json')) !== undefined ||
    readFileSafe(nodePath.join(directory, 'go.mod')) !== undefined ||
    readFileSafe(nodePath.join(directory, 'Cargo.toml')) !== undefined ||
    readFileSafe(nodePath.join(directory, 'pyproject.toml')) !== undefined
  );
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
  if (typeof name === 'string' && name.length > 0) return name;
  // A Go package's identity is its go.mod `module` directive and a Rust crate's is
  // its Cargo.toml `[package] name` (tickets ZD70P1, YKFA5X) — the analogues of
  // package.json `name`; fall back to the directory basename.
  return (
    readGoModuleName(packageDirectory) ??
    readCargoCrateName(packageDirectory) ??
    readPyprojectCrateName(packageDirectory) ??
    nodePath.basename(packageDirectory)
  );
}

/** The `module` path declared in a directory's `go.mod`, if any. */
function readGoModuleName(packageDirectory: string): string | undefined {
  const content = readFileSafe(nodePath.join(packageDirectory, 'go.mod'));
  if (content === undefined) return undefined;
  return /^module\s+(\S+)/m.exec(content)?.[1];
}

/** The `[package] name` declared in a directory's `Cargo.toml`, if any. */
function readCargoCrateName(packageDirectory: string): string | undefined {
  const content = readFileSafe(nodePath.join(packageDirectory, 'Cargo.toml'));
  return content === undefined ? undefined : readCargoPackageName(content);
}

/** The PEP 621 `[project] name` declared in a directory's `pyproject.toml`, if any. */
function readPyprojectCrateName(packageDirectory: string): string | undefined {
  const content = readFileSafe(nodePath.join(packageDirectory, 'pyproject.toml'));
  return content === undefined ? undefined : readPyprojectName(content);
}

/**
 * Read workspace member globs from a `pyproject.toml` `[tool.uv.workspace] members`
 * array (ticket HWSEPV) — uv stores its workspace list here. Returns the path globs, or
 * `undefined` when the file is absent or has no uv-workspace table (so a single Python
 * package, or a non-uv pyproject, degrades to no-workspaces).
 */
function detectUvWorkspace(projectDirectory: string): string[] | undefined {
  const content = readFileSafe(nodePath.join(projectDirectory, 'pyproject.toml'));
  return content === undefined ? undefined : readUvWorkspaceMembers(content);
}

function manifestDependencyNames(packageDirectory: string): string[] {
  const manifest = readManifest(packageDirectory);
  return manifest === undefined ? [] : dependencySectionNames(manifest);
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

/**
 * Read workspace member directories from `go.work` (ticket ZD70P1) — Go stores its
 * workspace list in `use` directives, not in package.json. A dependency-free parse
 * of both forms:
 *
 *   use ./svc                 // single-line
 *   use (                     // block
 *       ./svc
 *       ./gateway
 *   )
 *
 * Returns the member directories (leading `./` stripped, quotes removed), or
 * `undefined` when the file is absent or no `use` target parses. An entry that is
 * not a clean relative path (e.g. junk, or a multi-token line) is skipped, not
 * fatal — a single unreadable entry never blinds the rest (incomplete, never
 * silently wrong).
 */
function detectGoWork(projectDirectory: string): string[] | undefined {
  const content = readFileSafe(nodePath.join(projectDirectory, 'go.work'));
  if (content === undefined) return undefined;

  const lines = content.split(/\r?\n/);
  const directories: string[] = [];
  collectGoWorkBlock(lines, directories);
  collectGoWorkSingleLines(lines, directories);
  return directories.length > 0 ? directories : undefined;
}

/** Member directories from a `use (\n  ./x\n)` block, stopping at the closing paren. */
function collectGoWorkBlock(lines: string[], directories: string[]): void {
  for (const entry of readDelimitedBlock(lines, /^use\s*\(\s*$/)) {
    const target = normalizeUseTarget(entry);
    if (target !== undefined) directories.push(target);
  }
}

/** Member directories from single-line `use ./x` directives (ignores the block opener). */
function collectGoWorkSingleLines(lines: string[], directories: string[]): void {
  for (const line of lines) {
    const match = /^use\s+(\S.*)$/.exec(line.trim());
    if (match?.[1] === undefined || match[1].startsWith('(')) continue;
    const target = normalizeUseTarget(match[1]);
    if (target !== undefined) directories.push(target);
  }
}

/** A clean relative member dir (trailing comment, quotes + leading `./` stripped), or undefined if junk. */
function normalizeUseTarget(raw: string): string | undefined {
  // A `use ./svc // comment` entry is idiomatic Go (the docs' own example); strip
  // the trailing comment before the junk check, or the whole entry is dropped.
  const commentAt = raw.indexOf('//');
  const noComment = (commentAt === -1 ? raw : raw.slice(0, commentAt)).trim();
  const unquoted = noComment.replaceAll(/^["']|["']$/g, '');
  if (unquoted === '' || /\s/.test(unquoted)) return undefined; // empty or multi-token junk
  return unquoted.replace(/^\.\//, '');
}

/**
 * Read workspace member globs from a `Cargo.toml` `[workspace] members` array (ticket
 * YKFA5X) — Cargo stores its workspace list here, not in package.json. Returns the
 * path globs, or `undefined` when the file is absent or has no parseable members
 * array (so a single crate, or an unparseable manifest, degrades to no-workspaces).
 */
function detectCargoWorkspace(projectDirectory: string): string[] | undefined {
  const content = readFileSafe(nodePath.join(projectDirectory, 'Cargo.toml'));
  return content === undefined ? undefined : readCargoWorkspaceMembers(content);
}
