import nodePath from 'node:path';

/** Normalize an OS-native relative path to Git's forward-slashed path grammar. */
export function toRepoPath(value: string): string {
  return value.split(nodePath.win32.sep).join(nodePath.posix.sep);
}

/** Return an absolute path relative to the repository in Git path grammar. */
export function toRepoRelativePath(cwd: string, absolutePath: string): string {
  return toRepoPath(nodePath.relative(cwd, absolutePath));
}
