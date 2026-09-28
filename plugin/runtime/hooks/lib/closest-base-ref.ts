import { spawnSync } from 'node:child_process';

const DEFAULT_BASE_REFS = [
  'refs/remotes/origin/HEAD',
  'refs/remotes/origin/main',
  'refs/remotes/origin/master',
  'refs/heads/main',
  'refs/heads/master',
] as const;

type BaseResolution =
  { state: 'found'; sha: string } | { state: 'missing-ref' } | { state: 'missing-merge-base' };

function git(projectDirectory: string, args: string[]): string | undefined {
  const result = spawnSync('git', ['-C', projectDirectory, ...args], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

/** Select the nearest divergence point, trusting local default-branch refs as Git does. */
export function closestDefaultMergeBase(projectDirectory: string): BaseResolution {
  let foundRef = false;
  let closest: { sha: string; distance: number } | undefined;

  for (const ref of DEFAULT_BASE_REFS) {
    if (!git(projectDirectory, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])) continue;
    foundRef = true;
    const sha = git(projectDirectory, ['merge-base', 'HEAD', ref]);
    if (!sha) continue;
    const count = git(projectDirectory, ['rev-list', '--count', `${sha}..HEAD`]);
    if (!count) continue;
    const distance = Number(count);
    if (!Number.isSafeInteger(distance)) continue;
    if (closest === undefined || distance < closest.distance) closest = { sha, distance };
  }

  if (closest !== undefined) return { state: 'found', sha: closest.sha };
  return { state: foundRef ? 'missing-merge-base' : 'missing-ref' };
}
