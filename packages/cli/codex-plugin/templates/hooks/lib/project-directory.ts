// Safeword: the one rule for choosing the project directory (#5467).
//
// Hosts keep CLAUDE_PROJECT_DIR at the checkout a session launched in, even
// after the session enters a git worktree; the hook input `cwd` follows the
// session. Every hook, script and CLI command picks its project here, in this
// order:
//
//   1. the edited file's enrolled git working tree;
//   2. the cwd's enrolled git working tree — a hook passes the host-reported
//      `cwd`, a helper or CLI command passes its own `process.cwd()`;
//   3. the launch checkout.
//
// "Enrolled" means `.safeword/SAFEWORD.md` exists. A walk stops at the first
// git working tree it meets: an unenrolled tree yields nothing, so a vendored
// repository never hands its files to an enrolled ancestor. Paths compare by
// real path (macOS `/var` vs `/private/var`). A parity test keeps every other
// file from reading CLAUDE_PROJECT_DIR or git's toplevel to pick a project.

import { existsSync, realpathSync } from 'node:fs';
import nodePath from 'node:path';

import { canonicalPathForGate, hasSafewordProjectMarker } from './namespace-root.js';

/** The checkout the session launched in: CLAUDE_PROJECT_DIR, else the process cwd. */
export function resolveLaunchDirectory(environment: NodeJS.ProcessEnv = process.env): string {
  return environment.CLAUDE_PROJECT_DIR || process.cwd();
}

/**
 * The project a surface should read and write, by the rule above. `cwd` is
 * required so each caller states which working directory it means; the
 * resolver never reads ambient process state for it.
 */
export function resolveProjectDirectory(input: {
  launchDirectory?: string;
  editedFile?: string;
  cwd: string | undefined;
}): string {
  const launchDirectory = input.launchDirectory ?? resolveLaunchDirectory();
  // A path reached through a symlink belongs to the tree it lands in, not the
  // tree its lexical ancestors sit in. Keep the host spelling unless the real
  // path names a different owner.
  const owner = (lexicalDirectory: string, realDirectory: string) => {
    const lexical = enrolledWorkingTree(launchDirectory, lexicalDirectory);
    const real = enrolledWorkingTree(launchDirectory, realDirectory);
    return lexical !== undefined && real !== undefined && isSameDirectory(lexical, real)
      ? lexical
      : real;
  };

  if (input.editedFile) {
    const file = nodePath.resolve(baseDirectory(launchDirectory, input.cwd), input.editedFile);
    const fileOwner = owner(nodePath.dirname(file), nodePath.dirname(canonicalPathForGate(file)));
    if (fileOwner !== undefined) return fileOwner;
  }

  if (!input.cwd) return launchDirectory;
  const cwd = baseDirectory(launchDirectory, input.cwd);
  return owner(cwd, canonicalPathForGate(cwd)) ?? launchDirectory;
}

/**
 * The real path of an edit target as the host meant it, resolved from the
 * same base as `resolveProjectDirectory`: the reported `cwd` (which may be a
 * worktree), else the launch checkout — never the hook process's own cwd.
 * Empty stays empty.
 */
export function canonicalEditTarget(
  launchDirectory: string,
  filePath: string,
  cwd: string | undefined,
): string {
  if (filePath === '') return filePath;
  return canonicalPathForGate(nodePath.resolve(baseDirectory(launchDirectory, cwd), filePath));
}

/** Where a relative path starts: the reported cwd (itself relative to launch), else launch. */
function baseDirectory(launchDirectory: string, cwd: string | undefined): string {
  return cwd ? nodePath.resolve(launchDirectory, cwd) : launchDirectory;
}

/**
 * The project for one tool call. Edit tools resolve from the edited file
 * (#5247); every tool also resolves from the host-reported `cwd`, so a shell
 * in a worktree reads the receipt its own observer wrote there (#5382). Pre-
 * and post-tool hooks share this so the gate reads exactly where the observer
 * wrote.
 */
export function resolveToolProjectDirectory(
  launchDirectory: string,
  call: { tool: string; editedFile: string; cwd: string | undefined },
): string {
  return resolveProjectDirectory({
    launchDirectory,
    editedFile: EDIT_TOOL_NAMES.has(call.tool) ? call.editedFile : undefined,
    cwd: call.cwd,
  });
}

const EDIT_TOOL_NAMES = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/** The first git working tree at or above `start`, when it is enrolled. */
function enrolledWorkingTree(launchDirectory: string, start: string): string | undefined {
  let directory = start;
  for (;;) {
    if (existsSync(nodePath.join(directory, '.git'))) {
      if (!hasSafewordProjectMarker(directory)) return undefined;
      return isSameDirectory(directory, launchDirectory) ? launchDirectory : directory;
    }
    const parent = nodePath.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

function isSameDirectory(left: string, right: string): boolean {
  if (nodePath.resolve(left) === nodePath.resolve(right)) return true;
  try {
    return realpathSync(left) === realpathSync(right);
  } catch {
    return false;
  }
}
