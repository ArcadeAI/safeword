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
import { findAllInTree, isDirectory, readFileSafe, readJson } from './fs.js';
import { readDelimitedBlock } from './manifest-block.js';
import { dependencySectionNames } from './manifest-dependencies.js';
import { readPyprojectName, readUvWorkspaceMembers } from './pyproject-manifest.js';
import { hasTomlTable, hasTomlTableKey, isTomlTableEmptyArray } from './toml.js';

const byString = (a: string, b: string): number => a.localeCompare(b);

export interface PackageNode {
  /** Package name from its manifest (falls back to the directory name). */
  name: string;
  /** Absolute path to the package directory. */
  dir: string;
  /** One-line purpose (the purpose floor); a placeholder until prose is written. */
  purpose: string;
  /**
   * Whether the package yields a non-empty skeleton (source modules to enumerate,
   * so it gets a leaf doc) — across every layout the extractor recognizes: `src/`,
   * `lib/`, or flat/top-level files for JS/TS, plus the Go/Rust/Python layouts
   * (issue #843). A package that is `false` here is listed in the root index but
   * explicitly marked "not introspected" rather than shown with a bare placeholder
   * — incomplete, never silently complete (ZRW21K).
   */
  introspected: boolean;
}

interface PackageEdge {
  from: string;
  to: string;
}

/**
 * A workspace manager that is PRESENT at the repo root but whose member list could
 * not be parsed (a malformed `go.work`, an unreadable Cargo `[workspace] members`, a
 * flow-style `pnpm-workspace.yaml`). Surfaced — never silently dropped (ticket UWP4XK,
 * GitHub #558): a manager that discovered nothing has no per-package "not introspected"
 * marker to carry (ZRW21K), so the honesty signal must live one layer up, at discovery.
 */
export interface UnreadableWorkspace {
  /** Human-facing manager label, e.g. `go.work`, `Cargo [workspace]`, `pnpm workspaces`. */
  manager: string;
  /** The config file the unreadable declaration lives in, e.g. `go.work`, `Cargo.toml`. */
  config: string;
}

/**
 * One manager's detection outcome. The discriminator is what #558 adds: `undefined`
 * used to mean BOTH "absent" and "present-but-unparseable", collapsing the honesty
 * signal. Now `absent` carries no signal, `parsed` carries globs/dirs to expand, and
 * `unreadable` carries the config to surface.
 */
type WorkspaceDetection =
  | { status: 'absent' }
  | { status: 'parsed'; patterns: string[] }
  | { status: 'unreadable'; manager: string; config: string };

const ABSENT: WorkspaceDetection = { status: 'absent' };

/** A workspace whose member globs/dirs were read. */
const parsed = (patterns: string[]): WorkspaceDetection => ({ status: 'parsed', patterns });

/** A workspace declared at `config` (by `manager`) whose member list could not be parsed. */
const unreadable = (manager: string, config: string): WorkspaceDetection => ({
  status: 'unreadable',
  manager,
  config,
});

/** Globs to expand plus the present-but-unparseable managers to surface. */
export interface WorkspaceDiscovery {
  patterns: string[];
  unreadable: UnreadableWorkspace[];
}

export interface MonorepoModel {
  packages: PackageNode[];
  edges: PackageEdge[];
  /** Managers present at the root but unparseable; surfaced in the root index + `--check`. */
  unreadableWorkspaces: UnreadableWorkspace[];
}

/**
 * Probe every workspace manager at the root, returning the globs to expand plus the
 * managers that are PRESENT but unparseable (ticket UWP4XK, GitHub #558).
 *
 * Within JS, package.json `workspaces` wins over pnpm-workspace.yaml (pnpm ignores the
 * package.json field, so a repo with both is npm-authoritative) — they are alternative
 * managers for the same ecosystem, not additive. A package.json that is PRESENT (parsed
 * or unparseable) still wins; only an absent one falls through to pnpm. Across ecosystems,
 * managers are UNIONED: go.work, Cargo `[workspace]`, and uv `[tool.uv.workspace]` describe
 * disjoint package sets (Go/Rust/Python dirs), so a polyglot monorepo declaring packages
 * with more than one manager at once is fully discovered (ticket MGWZ4P). Crucially, one
 * unparseable manager never blinds the readable ones: its globs simply don't contribute,
 * and it is recorded in `unreadable` instead of vanishing.
 */
export function discoverWorkspaces(projectDirectory: string): WorkspaceDiscovery {
  const detections = [
    detectJsWorkspaces(projectDirectory),
    detectGoWork(projectDirectory),
    detectCargoWorkspace(projectDirectory),
    detectUvWorkspace(projectDirectory),
  ];
  return {
    patterns: detections.flatMap(detection =>
      detection.status === 'parsed' ? detection.patterns : [],
    ),
    unreadable: detections.flatMap(detection =>
      detection.status === 'unreadable'
        ? [{ manager: detection.manager, config: detection.config }]
        : [],
    ),
  };
}

/**
 * Absolute directories of the leaf packages, sorted. The union of two sources:
 * the DECLARED workspace members (workspace globs expanded, recognized-manifest
 * dirs kept) and the ORPHAN non-JS packages a bounded tree walk finds outside any
 * declared workspace (issue #844). A dir claimed by both is listed once. Returns
 * `[]` for a non-workspace project with no orphan packages.
 */
export function discoverLeafDirectories(projectDirectory: string): string[] {
  return leafDirectoriesFrom(projectDirectory, discoverWorkspaces(projectDirectory).patterns);
}

/**
 * The declared-workspace ∪ orphan leaf union behind {@link discoverLeafDirectories},
 * taking already-read workspace patterns so a caller that has run discovery (the
 * model extractor) doesn't probe every manager a second time.
 */
function leafDirectoriesFrom(projectDirectory: string, patterns: string[]): string[] {
  const workspaceLeaves = resolveLeafDirectories(projectDirectory, patterns);
  const orphanLeaves = discoverOrphanManifestDirectories(projectDirectory);
  return [...new Set([...workspaceLeaves, ...orphanLeaves])].toSorted(byString);
}

/**
 * Non-JS language manifests a polyglot monorepo often keeps as standalone modules
 * that are NOT enrolled in a declared workspace (`go.work`, uv, Cargo `[workspace]`),
 * so `discoverWorkspaces` never sees them and the root index — the doc the staleness
 * gate anchors on — omits the platform's actual core (issue #844). JS is absent on
 * purpose: its packages come from the workspace graph. Each entry is gated by its
 * language pack so a project only pays for a language it opted into.
 */
const ORPHAN_MANIFESTS: {
  /** `installedPacks` ids that enable this language's walk (`go`/`golang` are aliases). */
  packs: string[];
  filename: string;
  /** Whether the manifest actually declares a package (vs. tooling/workspace-root config). */
  declaresPackage: (content: string) => boolean;
}[] = [
  { packs: ['golang', 'go'], filename: 'go.mod', declaresPackage: content => hasGoModule(content) },
  {
    packs: ['python'],
    filename: 'pyproject.toml',
    // A real package declares [project] (PEP 621) or [tool.poetry]; a pyproject that
    // only carries [tool.ruff]/[tool.black] tooling config is not a package leaf.
    declaresPackage: content =>
      hasTomlTable(content, 'project') || hasTomlTable(content, 'tool.poetry'),
  },
  {
    packs: ['rust'],
    filename: 'Cargo.toml',
    // A member crate declares [package]; a bare [workspace] root is not a leaf.
    declaresPackage: content => hasTomlTable(content, 'package'),
  },
];

/**
 * Directories of non-JS packages discovered outside any declared workspace (issue
 * #844): for every installed language pack, tree-walk for its manifest (bounded by
 * the shared exclude set in {@link findAllInTree}), keep the dirs whose manifest
 * actually declares a package, and drop the repo root itself (a root
 * `pyproject.toml`/`Cargo.toml` is tooling/workspace config, not a leaf). Empty when
 * no non-JS pack is installed, so a JS-only project is unaffected and pays for no walk.
 */
function discoverOrphanManifestDirectories(projectDirectory: string): string[] {
  const installed = installedPacks(projectDirectory);
  const directories = new Set<string>();
  for (const manifest of ORPHAN_MANIFESTS) {
    if (manifest.packs.every(pack => !installed.has(pack))) continue;
    for (const dir of orphanDirectoriesFor(projectDirectory, manifest)) directories.add(dir);
  }
  return [...directories];
}

/** Package dirs for one language's manifest: tree-walked, root dropped, package-declaring kept. */
function orphanDirectoriesFor(
  projectDirectory: string,
  manifest: { filename: string; declaresPackage: (content: string) => boolean },
): string[] {
  return findAllInTree(projectDirectory, manifest.filename).filter(dir => {
    if (dir === projectDirectory) return false; // the repo root is not a leaf package
    const content = readFileSafe(nodePath.join(dir, manifest.filename));
    return content !== undefined && manifest.declaresPackage(content);
  });
}

/** Whether a `go.mod`'s content declares a `module` path. */
function hasGoModule(content: string): boolean {
  return /^module\s+\S+/m.test(content);
}

/**
 * The language packs the project opted into, from `.safeword/config.json`
 * `installedPacks` — the gate for the orphan-manifest walk (issue #844). Read
 * locally (best-effort, a single field) rather than importing the packs module, so
 * this discovery layer stays free of a `utils → packs` dependency; `test-plan`
 * reads the same field the same way for the same reason. An absent/unreadable
 * config yields an empty set — no orphan walk, discovery unchanged.
 */
function installedPacks(projectDirectory: string): Set<string> {
  const config = readJson(nodePath.join(projectDirectory, '.safeword', 'config.json'));
  if (config === null || typeof config !== 'object') return new Set();
  const packs = (config as { installedPacks?: unknown }).installedPacks;
  if (!Array.isArray(packs)) return new Set();
  return new Set(packs.filter((pack): pack is string => typeof pack === 'string'));
}

/** The present-but-unparseable workspace managers at the root, if any (UWP4XK). */
export function discoverUnreadableWorkspaces(projectDirectory: string): UnreadableWorkspace[] {
  return discoverWorkspaces(projectDirectory).unreadable;
}

/** Expand the discovered patterns to leaf dirs (glob → keep recognized-manifest dirs, deduped). */
function resolveLeafDirectories(projectDirectory: string, patterns: string[]): string[] {
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

/**
 * JS workspace detection with precedence: package.json `workspaces` wins over
 * pnpm-workspace.yaml when present (parsed OR unparseable), preserving ZRW21K's
 * "package.json is authoritative" rule; only an absent package.json consults pnpm.
 */
function detectJsWorkspaces(projectDirectory: string): WorkspaceDetection {
  const packageJson = detectPackageJsonWorkspaces(projectDirectory);
  return packageJson.status === 'absent' ? detectPnpmWorkspaces(projectDirectory) : packageJson;
}

/**
 * package.json `workspaces`: absent when the field is missing or an explicitly-empty list
 * (a deliberate "no workspaces"); parsed when it is a non-empty `string[]` or
 * `{ packages: string[] }`; unreadable when present in some other (malformed) shape.
 */
function detectPackageJsonWorkspaces(projectDirectory: string): WorkspaceDetection {
  const workspaces = readManifest(projectDirectory)?.workspaces;
  if (workspaces === undefined) return ABSENT;

  const list = workspaceList(workspaces);
  if (list === undefined) return unreadable('package.json workspaces', 'package.json');
  const patterns = list.filter((entry): entry is string => typeof entry === 'string');
  // An explicitly-empty list is a deliberate "no workspaces", not an unparse — stay absent.
  return patterns.length > 0 ? parsed(patterns) : ABSENT;
}

/** The glob list of a package.json `workspaces` field — a bare array or `{ packages: [] }`. */
function workspaceList(workspaces: unknown): unknown[] | undefined {
  if (Array.isArray(workspaces)) return workspaces;
  if (isObjectRecord(workspaces) && Array.isArray(workspaces.packages)) return workspaces.packages;
  return undefined;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
  const { patterns, unreadable: unreadableWorkspaces } = discoverWorkspaces(projectDirectory);
  // Includes both declared workspace members and orphan non-JS packages (issue #844).
  const packages: PackageNode[] = leafDirectoriesFrom(projectDirectory, patterns)
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

  return { packages, edges, unreadableWorkspaces };
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
    // The unreadable-workspace advisory is root shape too: it must re-render when an
    // unparseable config appears or is fixed. Contributed ONLY when non-empty, so a
    // repo with no unreadable config keeps its existing fingerprint — no churn (UWP4XK).
    ...(model.unreadableWorkspaces.length > 0 && {
      unreadable: model.unreadableWorkspaces.map(entry => `${entry.manager}:${entry.config}`),
    }),
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
 * The detection for a TOML workspace whose member list lives in `[<table>] members`:
 * `parsed` with the globs when readable, `absent` for an explicitly-empty `members = []`
 * (declares no members, like package.json `workspaces: []` — U8), otherwise `unreadable`
 * (present but unparseable — UWP4XK). Shared by the Cargo and uv detectors, which differ
 * only in their pre-checks and these arguments.
 */
function resolveTomlWorkspaceMembers(
  content: string,
  readMembers: (content: string) => string[] | undefined,
  table: string,
  label: string,
  configFile: string,
): WorkspaceDetection {
  const members = readMembers(content);
  if (members !== undefined) return parsed(members);
  if (isTomlTableEmptyArray(content, table, 'members')) return ABSENT;
  return unreadable(label, configFile);
}

/**
 * Read workspace member globs from a `pyproject.toml` `[tool.uv.workspace] members`
 * array (ticket HWSEPV) — uv stores its workspace list here. `absent` when the file or the
 * uv-workspace table is missing (a single Python package, or a non-uv pyproject); `parsed`
 * with the globs when readable; `unreadable` when the table is PRESENT but `members` can't
 * be parsed (UWP4XK) — surfaced, not silently empty.
 */
function detectUvWorkspace(projectDirectory: string): WorkspaceDetection {
  const content = readFileSafe(nodePath.join(projectDirectory, 'pyproject.toml'));
  if (content === undefined) return ABSENT; // no pyproject.toml
  if (!hasTomlTable(content, 'tool.uv.workspace')) return ABSENT; // a non-uv pyproject
  return resolveTomlWorkspaceMembers(
    content,
    readUvWorkspaceMembers,
    'tool.uv.workspace',
    'uv workspace',
    'pyproject.toml',
  );
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
 * `absent` when the file is missing OR has no top-level `packages:` key at all (a
 * catalog-only / settings-only `pnpm-workspace.yaml` is valid and declares no members —
 * out of scope, not a coverage gap); `parsed` with the include globs (quotes stripped,
 * `!`-exclusions skipped) for the block-list form; `unreadable` only when a `packages:` key
 * IS present but no glob parses (flow-style `packages: [..]`, an empty block, or other
 * shapes out of scope) — a present-but-unparseable member list, surfaced not silently empty
 * (UWP4XK).
 */
function detectPnpmWorkspaces(projectDirectory: string): WorkspaceDetection {
  const content = readFileSafe(nodePath.join(projectDirectory, 'pnpm-workspace.yaml'));
  if (content === undefined) return ABSENT;

  const lines = content.split(/\r?\n/);
  // A top-level `packages:` key (block `packages:` or flow `packages: [..]`) is the member
  // declaration; without it the file declares no members (catalog-only) → absent.
  if (lines.every(line => !line.startsWith('packages:'))) return ABSENT;

  const start = lines.findIndex(line => /^packages:\s*$/.test(line));
  const globs = start === -1 ? [] : collectPnpmGlobs(lines.slice(start + 1));
  return globs.length > 0 ? parsed(globs) : unreadable('pnpm workspaces', 'pnpm-workspace.yaml');
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
 * Returns the member directories (leading `./` stripped, quotes removed) as `parsed`. An
 * entry that is not a clean relative path (e.g. junk, or a multi-token line) is skipped,
 * not fatal — a single unreadable entry never blinds the rest. `absent` when the file is
 * missing OR has no `use` directive at all (a freshly `go work init`-ed file with no
 * modules yet declares no members — out of scope, not a coverage gap); `unreadable` only
 * when a `use` directive IS present but no target parses (a malformed file) — a
 * present-but-unparseable member list, surfaced not silently empty (UWP4XK).
 */
function detectGoWork(projectDirectory: string): WorkspaceDetection {
  const content = readFileSafe(nodePath.join(projectDirectory, 'go.work'));
  if (content === undefined) return ABSENT;

  const lines = content.split(/\r?\n/);
  const directories: string[] = [];
  collectGoWorkBlock(lines, directories);
  collectGoWorkSingleLines(lines, directories);
  if (directories.length > 0) return parsed(directories);
  // No member dir parsed: a malformed `use` (present but junk) is unreadable; a go.work
  // with no `use` directive at all declares no members and stays absent.
  return lines.some(line => /^\s*use\b/.test(line)) ? unreadable('go.work', 'go.work') : ABSENT;
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
 * YKFA5X) — Cargo stores its workspace list here, not in package.json. `absent` when the
 * file, the `[workspace]` table, or the `members` key is missing; `parsed` with the globs
 * when readable; `unreadable` only when `members` is PRESENT but can't be parsed (UWP4XK).
 * A `[workspace]` with NO `members` key is a valid root-package workspace that
 * auto-discovers members from path deps (or lists `default-members`) — out of scope like
 * nested workspaces, NOT a coverage gap, so it stays `absent` rather than false-alarming.
 */
function detectCargoWorkspace(projectDirectory: string): WorkspaceDetection {
  const content = readFileSafe(nodePath.join(projectDirectory, 'Cargo.toml'));
  if (content === undefined) return ABSENT; // no Cargo.toml
  if (!hasTomlTable(content, 'workspace')) return ABSENT; // a single crate, not a workspace
  if (!hasTomlTableKey(content, 'workspace', 'members')) return ABSENT; // auto-discovery, out of scope
  return resolveTomlWorkspaceMembers(
    content,
    readCargoWorkspaceMembers,
    'workspace',
    'Cargo [workspace]',
    'Cargo.toml',
  );
}
