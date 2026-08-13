/**
 * Namespace migration — automatic convergence of a legacy `.safeword-project/`
 * onto `.project/` (ticket 9MMWS7, epic AQJ95G).
 *
 * `planNamespaceMigration` classifies the install; `executeNamespaceMigration`
 * performs the move (git mv when the directory is tracked, so history is
 * preserved; filesystem rename otherwise), safely merges a split namespace,
 * and rewrites stale per-file `paths.*` overrides that pointed into the legacy root.
 */

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  constants as fsConstants,
  cpSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  rmdirSync,
  rmSync,
} from 'node:fs';
import nodePath from 'node:path';

import { writeDurableFile } from '../codex-plugin/durable-write.js';
import { readConfiguredPath } from './configured-paths.js';
import { isDirectory } from './fs.js';

const LEGACY_ROOT = '.safeword-project';
const DEFAULT_ROOT = '.project';

export type MigrationPlan =
  | 'offer' // legacy-only install — converge unless explicitly disabled
  | 'already-current' // .project/ present (or nothing to move) — no offer
  | 'both-dirs' // both roots exist — merge, archiving authored collisions
  | 'custom-root' // explicit paths.projectRoot — user opted out of defaults
  | 'blocked'; // target exists but is not a directory — cannot move

export interface MigrationResult {
  method: 'git' | 'rename' | 'merge';
  conflicts: { path: string; archivedAs: string }[];
  rewrittenKeys: string[];
}

export interface NamespaceMigrationHooks {
  readonly afterFilesCopied?: () => void;
  readonly afterLegacyRetired?: () => void;
  readonly removeRetiredLegacy?: (path: string) => void;
}

export class NamespaceStructuralCollisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NamespaceStructuralCollisionError';
  }
}

export class NamespaceMergeIncompleteError extends Error {
  constructor(message: string, cause: unknown) {
    super(message, { cause });
    this.name = 'NamespaceMergeIncompleteError';
  }
}

function validateNamespaceTree(root: string, label: string): void {
  if (lstatSync(root).isSymbolicLink()) {
    throw new Error(`${label} is a symlink: ${root}`);
  }
  const visit = (directory: string): void => {
    const entries = readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = nodePath.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`${label} contains a symlink: ${path}`);
      }
      if (entry.isDirectory()) visit(path);
      else if (!entry.isFile()) {
        throw new Error(`${label} contains an unsupported file: ${path}`);
      }
    }
  };
  visit(root);
}

function validateDirectoryRoot(path: string, label: string): void {
  if (!existsSync(path)) return;
  const metadata = lstatSync(path);
  if (metadata.isSymbolicLink()) throw new Error(`${label} is a symlink: ${path}`);
  if (!metadata.isDirectory()) throw new Error(`${label} is not a directory: ${path}`);
}

function conflictArchivePath(source: string, relative: string): string {
  const metadata = lstatSync(source);
  const digest = createHash('sha256')
    .update(`${metadata.mode.toString(8)}\0`)
    .update(readFileSync(source))
    .digest('hex');
  return nodePath.join('.safeword', 'namespace-migration-conflicts-v1', digest, relative);
}

// The branches here are the explicit prepare/commit/rollback states of one
// filesystem transaction; splitting that state would obscure recovery order.
// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- Transaction states must remain visibly ordered.
function mergeLegacyDirectory(
  cwd: string,
  hooks: NamespaceMigrationHooks,
): MigrationResult['conflicts'] {
  const legacy = nodePath.join(cwd, LEGACY_ROOT);
  const current = nodePath.join(cwd, DEFAULT_ROOT);
  const recovery = nodePath.join(cwd, '.safeword', 'namespace-migration-conflicts-v1');
  const safewordRoot = nodePath.join(cwd, '.safeword');
  const conflicts: MigrationResult['conflicts'] = [];
  validateNamespaceTree(legacy, 'Legacy project namespace');
  validateNamespaceTree(current, 'Current project namespace');
  validateDirectoryRoot(safewordRoot, 'Safeword state directory');
  if (existsSync(recovery)) validateNamespaceTree(recovery, 'Namespace recovery directory');

  const validateMergeShape = (from: string, relative: string): void => {
    const entries = readdirSync(from, { withFileTypes: true });
    for (const entry of entries) {
      const child = relative === '' ? entry.name : nodePath.join(relative, entry.name);
      const source = nodePath.join(from, entry.name);
      const target = nodePath.join(current, child);
      if (entry.isDirectory()) {
        if (existsSync(target) && !lstatSync(target).isDirectory()) {
          throw new NamespaceStructuralCollisionError(
            `Cannot merge project namespaces: directory ${child} conflicts with a file.`,
          );
        }
        validateMergeShape(source, child);
      } else if (existsSync(target) && !lstatSync(target).isFile()) {
        throw new NamespaceStructuralCollisionError(
          `Cannot merge project namespaces: file ${child} conflicts with a directory.`,
        );
      }
    }
  };
  // Refuse every structural collision before copying or archiving anything so
  // a failed merge leaves both namespace trees byte-for-byte recoverable.
  validateMergeShape(legacy, '');

  const createdFiles: string[] = [];
  const createdDirectories = new Set<string>();
  const ensureDirectory = (directory: string): void => {
    const missing: string[] = [];
    let cursor = directory;
    while (!existsSync(cursor)) {
      missing.push(cursor);
      cursor = nodePath.dirname(cursor);
    }
    mkdirSync(directory, { recursive: true });
    for (const path of missing) createdDirectories.add(path);
  };
  const visit = (from: string, relative: string): void => {
    const entries = readdirSync(from, { withFileTypes: true });
    for (const entry of entries) {
      const child = relative === '' ? entry.name : nodePath.join(relative, entry.name);
      const source = nodePath.join(from, entry.name);
      const target = nodePath.join(current, child);
      if (entry.isDirectory()) {
        ensureDirectory(target);
        visit(source, child);
      } else if (existsSync(target)) {
        const archivedAs = conflictArchivePath(source, child);
        const archived = nodePath.join(cwd, archivedAs);
        ensureDirectory(nodePath.dirname(archived));
        if (!existsSync(archived)) {
          createdFiles.push(archived);
          cpSync(source, archived, { dereference: false });
        }
        conflicts.push({ path: child, archivedAs });
      } else {
        ensureDirectory(nodePath.dirname(target));
        createdFiles.push(target);
        cpSync(source, target, { dereference: false });
      }
    }
  };
  const retiredLegacy = nodePath.join(
    cwd,
    '.safeword',
    `namespace-migration-retired-${process.pid}`,
  );
  let legacyWasRetired = false;
  try {
    visit(legacy, '');
    hooks.afterFilesCopied?.();
    ensureDirectory(nodePath.dirname(retiredLegacy));
    renameSync(legacy, retiredLegacy);
    legacyWasRetired = true;
    hooks.afterLegacyRetired?.();
  } catch (error) {
    let legacyWasRestored = !legacyWasRetired;
    if (legacyWasRetired) {
      try {
        renameSync(retiredLegacy, legacy);
        legacyWasRestored = true;
      } catch {
        // Keep the complete destination copy when the source tree cannot be restored.
      }
    }
    if (legacyWasRestored) {
      for (const path of createdFiles.toReversed()) rmSync(path, { force: true });
      const deepestDirectoriesFirst = [...createdDirectories].toSorted(
        (a, b) => b.length - a.length,
      );
      for (const directory of deepestDirectoriesFirst) {
        try {
          rmdirSync(directory);
        } catch {
          // A non-empty directory predates this attempt or contains recovery evidence.
        }
      }
    }
    throw new NamespaceMergeIncompleteError(
      `Project namespace merge failed before it could commit: ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  }
  try {
    const removeRetiredLegacy =
      hooks.removeRetiredLegacy ??
      (path => {
        rmSync(path, { recursive: true, force: true });
      });
    removeRetiredLegacy(retiredLegacy);
  } catch {
    // The complete `.project` copy is committed. Retain the retired duplicate as recovery evidence.
  }
  return conflicts.toSorted((left, right) => left.path.localeCompare(right.path));
}

/** Classify the install for the migration offer. */
export function planNamespaceMigration(cwd: string): MigrationPlan {
  if (readConfiguredPath(cwd, 'projectRoot') !== undefined) return 'custom-root';

  const legacyPath = nodePath.join(cwd, LEGACY_ROOT);
  if (!isDirectory(legacyPath)) return 'already-current';

  const targetPath = nodePath.join(cwd, DEFAULT_ROOT);
  if (isDirectory(targetPath)) return 'both-dirs';
  if (existsSync(targetPath)) return 'blocked';

  return 'offer';
}

/** True when git tracks anything under the legacy directory. */
function isGitTracked(cwd: string): boolean {
  try {
    const output = execSync(`git ls-files --error-unmatch "${LEGACY_ROOT}" 2>/dev/null | head -1`, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Rewrite per-file `paths.*` values prefixed with the legacy root so they
 * follow the moved namespace. Surgical: only string values under `paths`
 * that start with `.safeword-project/` are touched.
 */
const MAX_NAMESPACE_CONFIG_BYTES = 1024 * 1024;

// Keep all descriptor identity checks adjacent so none can be dropped by a caller.
// eslint-disable-next-line complexity -- Security checks must remain adjacent and fail closed.
function readSafeNamespaceConfig(path: string): string | undefined {
  let descriptor: number | undefined;
  try {
    const before = lstatSync(path);
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1 ||
      before.size > MAX_NAMESPACE_CONFIG_BYTES
    ) {
      return undefined;
    }
    descriptor = openSync(
      path,
      fsConstants.O_RDONLY | fsConstants.O_NONBLOCK | (fsConstants.O_NOFOLLOW ?? 0),
    );
    const opened = fstatSync(descriptor);
    if (
      !opened.isFile() ||
      opened.nlink !== 1 ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino
    ) {
      return undefined;
    }
    const buffer = Buffer.alloc(MAX_NAMESPACE_CONFIG_BYTES + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const count = readSync(descriptor, buffer, offset, buffer.length - offset, offset);
      if (count === 0) break;
      offset += count;
    }
    const after = fstatSync(descriptor);
    if (
      offset > MAX_NAMESPACE_CONFIG_BYTES ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.nlink !== 1
    ) {
      return undefined;
    }
    return buffer.subarray(0, offset).toString('utf8');
  } catch {
    return undefined;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

// Parsing, shape validation, and the surgical rewrite deliberately fail closed.
// eslint-disable-next-line complexity -- Parse, validate, and rewrite form one fail-closed boundary.
function rewriteLegacyPathOverrides(cwd: string): string[] {
  const configPath = nodePath.join(cwd, '.safeword', 'config.json');
  if (!existsSync(configPath)) return [];

  let parsed: Record<string, unknown>;
  try {
    const source = readSafeNamespaceConfig(configPath);
    if (source === undefined) return [];
    const value = JSON.parse(source) as unknown;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
    parsed = value as Record<string, unknown>;
  } catch {
    return [];
  }
  const paths = parsed.paths;
  if (typeof paths !== 'object' || paths === null || Array.isArray(paths)) return [];

  const rewritten: string[] = [];
  for (const [key, value] of Object.entries(paths)) {
    if (!(typeof value === 'string' && value.startsWith(`${LEGACY_ROOT}/`))) {
      continue;
    }

    (paths as Record<string, unknown>)[key] = `${DEFAULT_ROOT}${value.slice(LEGACY_ROOT.length)}`;
    rewritten.push(key);
  }
  if (rewritten.length > 0) {
    writeDurableFile(configPath, `${JSON.stringify(parsed, undefined, 2)}\n`, { mode: 0o644 });
  }
  return rewritten.toSorted((a, b) => a.localeCompare(b));
}

/**
 * Move the legacy namespace to `.project/` and rewrite stale config
 * overrides. Caller must have confirmed consent and a plan of 'offer'.
 * Throws with context when the move itself fails — the tree is unchanged
 * in that case (a directory rename is atomic on one filesystem).
 */
export function executeNamespaceMigration(
  cwd: string,
  hooks: NamespaceMigrationHooks = {},
): MigrationResult {
  const legacy = nodePath.join(cwd, LEGACY_ROOT);
  validateNamespaceTree(legacy, 'Legacy project namespace');
  if (planNamespaceMigration(cwd) === 'both-dirs') {
    const conflicts = mergeLegacyDirectory(cwd, hooks);
    return { method: 'merge', conflicts, rewrittenKeys: rewriteLegacyPathOverrides(cwd) };
  }
  const method: MigrationResult['method'] = isGitTracked(cwd) ? 'git' : 'rename';

  try {
    if (method === 'git') {
      execSync(`git mv "${LEGACY_ROOT}" "${DEFAULT_ROOT}"`, { cwd, stdio: 'pipe' });
    } else {
      renameSync(nodePath.join(cwd, LEGACY_ROOT), nodePath.join(cwd, DEFAULT_ROOT));
    }
  } catch (error) {
    throw new Error(
      `Failed to move ${LEGACY_ROOT}/ to ${DEFAULT_ROOT}/: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  return { method, conflicts: [], rewrittenKeys: rewriteLegacyPathOverrides(cwd) };
}
