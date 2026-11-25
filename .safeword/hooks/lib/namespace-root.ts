// Safeword: namespace-root resolver (hook-side copy, ticket TAGWZ8).
//
// Resolves the directory holding safeword's project knowledge (tickets,
// learnings, personas, glossary, surfaces, architecture). Precedence (epic AQJ95G):
// explicit config `paths.projectRoot` in `.safeword/config.json` →
// `.project/` → legacy `.safeword-project/`; neither present → `.project/`.
//
// Deliberate duplicate of `resolveNamespaceRoot` in the CLI's
// `src/utils/configured-paths.ts` — hooks run standalone under bun in
// customer repos with no import path to the CLI. A differential test pins
// the two copies against shared fixtures (P58R22 pattern).

import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import nodePath from 'node:path';

export const NAMESPACE_ROOT_DEFAULT = '.project';
export const NAMESPACE_ROOT_LEGACY = '.safeword-project';

/** True after explicit Safeword setup has enrolled this repository. */
export function hasSafewordProjectMarker(projectDirectory: string): boolean {
  // The dedicated marker, or the project handbook copy older installs carry.
  return ['enrolled', 'SAFEWORD.md'].some(marker =>
    existsSync(nodePath.join(projectDirectory, '.safeword', marker)),
  );
}

/**
 * The real path of a tool's target file, resolving symlinks even when the
 * file itself does not exist yet. Pre- and post-tool hooks both canonicalize
 * before resolving ownership, so a path reached through a symlink into an
 * enrolled worktree is gated and recorded in that same worktree.
 */
export function canonicalPathForGate(path: string, seen = new Set<string>()): string {
  if (seen.has(path)) return path;
  seen.add(path);
  try {
    return realpathSync(path);
  } catch {
    try {
      if (lstatSync(path).isSymbolicLink()) {
        const target = readlinkSync(path);
        return canonicalPathForGate(nodePath.resolve(nodePath.dirname(path), target), seen);
      }
    } catch {
      // The requested path itself may not exist yet.
    }
    const parent = nodePath.dirname(path);
    if (parent === path) return path;
    return nodePath.join(canonicalPathForGate(parent, seen), nodePath.basename(path));
  }
}

/**
 * The raw non-empty `paths.<key>` string from `.safeword/config.json`, or
 * `undefined` (unset, empty, non-string, or missing/unparseable config).
 * Shared by the hook-side path resolvers (projectRoot here, architecture in
 * architecture-document-nudge.ts) — hooks run standalone, so this is their
 * one config-reading seam.
 */
export function readConfiguredPathValue(projectDirectory: string, key: string): string | undefined {
  const configPath = nodePath.join(projectDirectory, '.safeword', 'config.json');
  if (!existsSync(configPath)) return undefined;

  let parsed: { paths?: Record<string, unknown> } | null;
  try {
    parsed = JSON.parse(readFileSync(configPath, 'utf8')) as {
      paths?: Record<string, unknown>;
    } | null;
  } catch {
    return undefined;
  }

  const raw = parsed?.paths?.[key];
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  return raw;
}

/** Resolve a configured project path or derive its default from the namespace root. */
export function resolveConfiguredPath(
  projectDirectory: string,
  key: string,
  defaultBasename = `${key}.md`,
): string {
  const configured = readConfiguredPathValue(projectDirectory, key);
  if (configured === undefined) {
    return nodePath.join(resolveNamespaceRoot(projectDirectory), defaultBasename);
  }
  return nodePath.isAbsolute(configured) ? configured : nodePath.join(projectDirectory, configured);
}

function readConfiguredProjectRoot(projectDirectory: string): string | undefined {
  return readConfiguredPathValue(projectDirectory, 'projectRoot');
}

/**
 * True when `filePath` lies under `<namespace root>/<subpath>` for the
 * default or the legacy root (string-level, for paths in unknown absolute or
 * relative form), or — given `projectDirectory` — under the root configured
 * by its `paths.projectRoot`. Relative paths resolve against that directory.
 */
export function isNamespacePath(
  filePath: string,
  subpath: string,
  projectDirectory?: string,
): boolean {
  const matchesBuiltInRoot = [NAMESPACE_ROOT_DEFAULT, NAMESPACE_ROOT_LEGACY].some(root => {
    const needle = `${root}/${subpath}`;
    // Boundary-anchored: the root must start the path or follow a separator,
    // so `foo.project/…` never matches the `.project/` root.
    return filePath.startsWith(needle) || filePath.includes(`/${needle}`);
  });
  if (matchesBuiltInRoot || projectDirectory === undefined || filePath === '') {
    return matchesBuiltInRoot;
  }
  return configuredNamespaceRelativePath(filePath, projectDirectory)?.startsWith(subpath) ?? false;
}

/**
 * `filePath` relative to the configured `paths.projectRoot` (POSIX
 * separators, trailing `/` kept), or `undefined` when no root is configured
 * or the path lies outside it. Both sides are compared lexically and
 * canonically, so a macOS `/var` ↔ `/private/var` alias still matches.
 */
export function configuredNamespaceRelativePath(
  filePath: string,
  projectDirectory: string,
): string | undefined {
  const configured = readConfiguredProjectRoot(projectDirectory);
  if (configured === undefined) return undefined;
  const root = nodePath.resolve(projectDirectory, configured);
  const target = nodePath.resolve(projectDirectory, filePath);
  for (const [base, candidate] of [
    [root, target],
    [canonicalPathForGate(root), canonicalPathForGate(target)],
  ] as const) {
    const relative = nodePath.relative(base, candidate);
    if (relative === '' || relative.startsWith('..') || nodePath.isAbsolute(relative)) continue;
    const posix = relative.split(nodePath.sep).join('/');
    return filePath.endsWith('/') ? `${posix}/` : posix;
  }
  return undefined;
}

/** True when `path` exists and is a directory (a stray file is not a root). */
function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** Absolute path of the resolved namespace root for `projectDirectory`. */
export function resolveNamespaceRoot(projectDirectory: string): string {
  const configured = readConfiguredProjectRoot(projectDirectory);
  if (configured !== undefined) {
    return nodePath.isAbsolute(configured)
      ? configured
      : nodePath.join(projectDirectory, configured);
  }

  const defaultRoot = nodePath.join(projectDirectory, NAMESPACE_ROOT_DEFAULT);
  if (isDirectory(defaultRoot)) return defaultRoot;

  const legacyRoot = nodePath.join(projectDirectory, NAMESPACE_ROOT_LEGACY);
  if (isDirectory(legacyRoot)) return legacyRoot;

  return defaultRoot;
}
