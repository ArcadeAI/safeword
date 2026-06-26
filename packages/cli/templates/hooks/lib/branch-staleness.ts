// Safeword: detect when a `git checkout` / `git switch` target branch is behind
// or diverged from its upstream, so a "catch up to main" checkout doesn't
// silently repoint the worktree to stale content (#366). Pure parsing + decision;
// the git I/O lives in the hook.

/** Flags that mean the command creates/detaches a branch — no upstream-staleness risk. */
const CREATE_OR_DETACH = new Set(['-b', '-B', '-c', '-C', '--orphan', '--detach', '-d']);

/**
 * The branch a `git checkout` / `git switch` command switches to, or null when
 * the command creates a branch, detaches HEAD, or checks out paths (`--`).
 */
export function parseCheckoutTarget(command: string): string | null {
  const tokens = command.trim().split(/\s+/);
  const gitIndex = tokens.indexOf('git');
  if (gitIndex === -1) return null;
  const subcommand = tokens[gitIndex + 1];
  if (subcommand !== 'checkout' && subcommand !== 'switch') return null;

  const args = tokens.slice(gitIndex + 2);
  for (const arg of args) {
    if (arg === '--') return null; // path checkout, not a branch switch
    if (CREATE_OR_DETACH.has(arg)) return null;
  }
  return args.find(arg => !arg.startsWith('-')) ?? null;
}

export interface BranchDivergence {
  branch: string;
  /** Short upstream ref name, e.g. `origin/main`. */
  upstream: string;
  /** Local commits not on the upstream. */
  ahead: number;
  /** Upstream commits not on the local branch. */
  behind: number;
}

/**
 * A non-blocking warning when the target branch is behind its upstream (checking
 * it out would serve stale content), or null when it is up to date / ahead only.
 */
export function decideStaleBranchWarning(divergence: BranchDivergence): string | null {
  const { branch, upstream, ahead, behind } = divergence;
  if (behind <= 0) return null;
  if (ahead > 0) {
    return `⚠️ Local '${branch}' has diverged from ${upstream} (${ahead} ahead, ${behind} behind). Checking it out serves stale content and the worktree won't match ${upstream}. Reconcile before working off it — e.g. \`git reset --hard ${upstream}\` if the local commits are throwaway parallel-worktree artifacts, or rebase/merge to keep them.`;
  }
  return `⚠️ Local '${branch}' is ${behind} commit(s) behind ${upstream}. Checking it out serves stale content until you \`git pull --ff-only\`.`;
}
