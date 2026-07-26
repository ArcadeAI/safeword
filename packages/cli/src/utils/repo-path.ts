import nodePath from 'node:path';

/** Normalize an OS-native relative path to Git's forward-slashed path grammar. */
export function toRepoPath(value: string): string {
  return value.split(nodePath.win32.sep).join(nodePath.posix.sep);
}

/** Return an absolute path relative to the repository in Git path grammar. */
export function toRepoRelativePath(cwd: string, absolutePath: string): string {
  return toRepoPath(nodePath.relative(cwd, absolutePath));
}

/** Normalize a configured directory that must remain inside the repository. */
export function toRepoDirectory(cwd: string, configuredPath: string): string | undefined {
  const repoPath = nodePath.isAbsolute(configuredPath)
    ? toRepoRelativePath(cwd, configuredPath)
    : toRepoPath(configuredPath);
  let normalized = repoPath.startsWith('./') ? repoPath.slice(2) : repoPath;
  while (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return normalized !== '' &&
    normalized !== '.' &&
    normalized !== '..' &&
    !normalized.startsWith('../')
    ? normalized
    : undefined;
}
