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
  return existsSync(nodePath.join(projectDirectory, '.safeword', 'SAFEWORD.md'));
}

/**
 * The Safeword checkout that owns `filePath`: its nearest enclosing git
 * working tree, when that tree is enrolled. Hosts keep CLAUDE_PROJECT_DIR at
 * the launch checkout after a session enters a git worktree, so gates that
 * read a ticket's sibling artifacts must root at the edited file's own tree
 * (#5247). Falls back to `launchDirectory` for files outside any enrolled tree.
 */
export function resolveOwningProjectDirectory(launchDirectory: string, filePath: string): string {
  if (filePath === '') return launchDirectory;
  return resolveDirectoryOwner(launchDirectory, nodePath.dirname(filePath));
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
 * The project a hook should gate or record against for one tool call. Edits
 * resolve from the edited file (#5247); shell commands have no edited file, so
 * they resolve from the host-reported shell `cwd` — otherwise a session inside
 * `.claude/worktrees/<name>` would have its PR-readiness gate and its readiness
 * receipt read and written in the launch checkout. Pre- and post-tool hooks
 * share this so the gate reads exactly where the observer wrote.
 */
export function resolveToolProjectDirectory(
  launchDirectory: string,
  call: { tool: string; editedFile: string; cwd: string | undefined },
): string {
  if (EDIT_TOOL_NAMES.has(call.tool)) {
    return resolveOwningProjectDirectory(launchDirectory, call.editedFile);
  }
  if (call.tool === 'Bash' && call.cwd !== undefined && call.cwd !== '') {
    return resolveWorkingProjectDirectory(
      launchDirectory,
      nodePath.resolve(launchDirectory, call.cwd),
    );
  }
  return launchDirectory;
}

const EDIT_TOOL_NAMES = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

// Compare real paths so a canonicalized spelling of the launch checkout
// (macOS \ vs \) still resolves to the launch spelling.
function isSameDirectory(left: string, right: string): boolean {
  if (nodePath.resolve(left) === nodePath.resolve(right)) return true;
  try {
    return realpathSync(left) === realpathSync(right);
  } catch {
    return false;
  }
}

function resolveDirectoryOwner(launchDirectory: string, startDirectory: string): string {
  let directory = startDirectory;
  for (;;) {
    if (existsSync(nodePath.join(directory, '.git'))) {
      const owns = hasSafewordProjectMarker(directory);
      return owns && !isSameDirectory(directory, launchDirectory) ? directory : launchDirectory;
    }
    const parent = nodePath.dirname(directory);
    if (parent === directory) return launchDirectory;
    directory = parent;
  }
}

/**
 * The Safeword checkout the process is working in: `launchDirectory`, unless
 * `workingDirectory` sits inside a different enrolled git working tree (a
 * worktree the session entered). Helpers a skill or agent shells out to get
 * no edited file to root at, so they root at their own cwd (#5361).
 */
export function resolveWorkingProjectDirectory(
  launchDirectory: string,
  workingDirectory: string,
): string {
  return resolveOwningProjectDirectory(launchDirectory, nodePath.join(workingDirectory, 'cwd'));
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

  let parsed: { paths?: Record<string, unknown> };
  try {
    parsed = JSON.parse(readFileSync(configPath, 'utf8')) as { paths?: Record<string, unknown> };
  } catch {
    return undefined;
  }

  const raw = parsed.paths?.[key];
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
 * True when `filePath` lies under `<namespace root>/<subpath>` for either
 * the default or the legacy root. String-level check for hook filters that
 * receive edited-file paths in unknown (absolute or relative) form.
 */
export function isNamespacePath(filePath: string, subpath: string): boolean {
  return [NAMESPACE_ROOT_DEFAULT, NAMESPACE_ROOT_LEGACY].some(root => {
    const needle = `${root}/${subpath}`;
    // Boundary-anchored: the root must start the path or follow a separator,
    // so `foo.project/…` never matches the `.project/` root.
    return filePath.startsWith(needle) || filePath.includes(`/${needle}`);
  });
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
