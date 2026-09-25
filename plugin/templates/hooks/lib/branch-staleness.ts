// Safeword: detect when a `git checkout` / `git switch` target branch is behind
// or diverged from its upstream, so a "catch up to main" checkout doesn't
// silently repoint the worktree to stale content (#366). Pure parsing + decision;
// the git I/O lives in the hook. Tokenization comes from the shared
// shell-segments tokenizer (EDDABK follow-up), so a compound command is parsed
// per segment: `git fetch && git checkout main` resolves `main`, and flags in a
// neighboring segment can no longer null out or fake a checkout target.

import nodePath from 'node:path';

import { commandWords, splitShellSegments } from './shell-segments.js';

/** Flags that mean the command creates/detaches a branch — no upstream-staleness risk. */
const CREATE_OR_DETACH = new Set(['-b', '-B', '-c', '-C', '--orphan', '--detach', '-d']);

/**
 * The branch the first `git checkout` / `git switch` segment of `command`
 * switches to, or null when no segment is one, the command creates a branch,
 * detaches HEAD, or checks out paths (`--`).
 */
export function parseCheckoutTarget(command: string): string | null {
  for (const segment of splitShellSegments(command)) {
    const words = commandWords(segment);
    let index = 0;
    while (words[index] === 'sudo') index += 1;
    // Basename-match `git` so `/usr/bin/git checkout main` warns the same as
    // bare `git` — consistent with the security gates (HRDN42).
    if (nodePath.basename(words[index] ?? '') !== 'git') continue;
    const subcommand = words[index + 1];
    if (subcommand !== 'checkout' && subcommand !== 'switch') continue;

    const args = words.slice(index + 2);
    if (args.some(arg => arg === '--' || CREATE_OR_DETACH.has(arg))) return null;
    return args.find(arg => !arg.startsWith('-')) ?? null;
  }
  return null;
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
