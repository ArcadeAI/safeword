// Git-backed SHA resolver for the done-gate annotation ledger.
//
// Rebase/amend rewrite commit IDs while preserving the patch. The ledger keeps
// the old SHA annotation, so the done gate accepts it when the same patch is
// reachable from HEAD under exactly one new commit ID.

import { execFileSync } from 'node:child_process';

export type LedgerShaResolution = string | false;
export type LedgerShaResolver = (sha: string) => LedgerShaResolution;

function git(cwd: string, args: string[], input?: string): string {
  return execFileSync('git', args, {
    cwd,
    input,
    encoding: 'utf8',
    stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function resolveCommitSha(cwd: string, sha: string): string | undefined {
  try {
    return git(cwd, ['rev-parse', '--verify', `${sha}^{commit}`]);
  } catch {
    return undefined;
  }
}

function isAncestorOfHead(cwd: string, sha: string): boolean {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], {
      cwd,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

function patchIdForCommit(cwd: string, sha: string): string | undefined {
  try {
    const patch = git(cwd, ['show', '--format=format:', '--patch', '--no-ext-diff', sha]);
    const output = git(cwd, ['patch-id', '--stable'], patch);
    return output.split(/\s+/)[0] || undefined;
  } catch {
    return undefined;
  }
}

function allReachableCommits(cwd: string): string[] {
  try {
    const output = git(cwd, ['rev-list', '--no-merges', 'HEAD']);
    return output === '' ? [] : output.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function buildReachablePatchMap(cwd: string): Map<string, string[]> {
  const patchIdToCommits = new Map<string, string[]>();
  for (const commit of allReachableCommits(cwd)) {
    const patchId = patchIdForCommit(cwd, commit);
    if (!patchId) continue;
    const commits = patchIdToCommits.get(patchId) ?? [];
    commits.push(commit);
    patchIdToCommits.set(patchId, commits);
  }
  return patchIdToCommits;
}

export function createLedgerShaResolver(cwd: string): LedgerShaResolver {
  let reachablePatchMap: Map<string, string[]> | undefined;

  function patchMap(): Map<string, string[]> {
    reachablePatchMap ??= buildReachablePatchMap(cwd);
    return reachablePatchMap;
  }

  return (sha: string): LedgerShaResolution => {
    const fullSha = resolveCommitSha(cwd, sha);
    if (!fullSha) return false;
    if (isAncestorOfHead(cwd, fullSha)) return fullSha;

    const stalePatchId = patchIdForCommit(cwd, fullSha);
    if (!stalePatchId) return false;

    const candidates = patchMap().get(stalePatchId) ?? [];
    const [candidate] = candidates;
    return candidates.length === 1 && candidate ? candidate : false;
  };
}
