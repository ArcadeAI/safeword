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
  if (configuredPath === '') return undefined;
  const repoPath = nodePath.isAbsolute(configuredPath)
    ? toRepoRelativePath(cwd, configuredPath)
    : toRepoPath(configuredPath);
  const canonical = nodePath.posix.normalize(repoPath);
  const normalized = canonical.endsWith('/') ? canonical.slice(0, -1) : canonical;
  if (normalized === '' || normalized === '.') return '';
  return normalized !== '..' && !normalized.startsWith('../') ? normalized : undefined;
}
