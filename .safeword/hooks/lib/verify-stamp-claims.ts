// Safeword: holding a written stamp to its claim at gate time (ticket PB1GMZ).
//
// write-review-stamp.ts refuses to write an independence claim the coordinator
// does not witness. That is not enough on its own: the ledger is a plain text
// file, so a line appended directly never passed through that hook. Requiring
// the line to carry a `review-id` only raises the bar to "any token" —
// `review-id:not-real` parses.
//
// So the gate re-checks the claim against the coordinator before honouring it,
// through the same pure decision core the write path uses. A stamp whose claim
// cannot be witnessed is dropped, and the gate then sees what it should have
// seen all along: no satisfying stamp.
//
// This costs one `review status` call per claimed stamp at a gate boundary, and
// only for stamps that claim a coordinator verdict — self-review stamps and
// skips never reach the coordinator at all.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';

import { createReviewReceiptReader } from './read-receipt.js';
import {
  claimFromScope,
  claimsCoordinatorVerdict,
  receiptGateVerdict,
  type StampClaim,
} from './review-receipt.js';
import type { ReviewStamp } from './review-ledger.js';
import { resolveNamespaceRoot } from './namespace-root.js';

const DEFAULT_BASE_REFS = [
  'refs/remotes/origin/HEAD',
  'refs/remotes/origin/main',
  'refs/remotes/origin/master',
  'refs/heads/main',
  'refs/heads/master',
] as const;

function runGit(projectDirectory: string, args: string[]): string | undefined {
  const result = spawnSync('git', ['-C', projectDirectory, ...args], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout : undefined;
}

function addPaths(paths: Set<string>, output: string | undefined): boolean {
  if (output === undefined) return false;
  for (const path of output.split('\0')) if (path !== '') paths.add(path);
  return true;
}

/** Current branch plus staged, unstaged, and untracked work, relative to the repo root. */
function currentWorkFiles(projectDirectory: string): string[] {
  const baseRef = DEFAULT_BASE_REFS.find(
    ref =>
      runGit(projectDirectory, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]) !==
      undefined,
  );
  if (baseRef === undefined) return [];
  const mergeBase = runGit(projectDirectory, ['merge-base', 'HEAD', baseRef])?.trim();
  if (!mergeBase) return [];

  const paths = new Set<string>();
  if (
    !addPaths(
      paths,
      runGit(projectDirectory, ['diff', '--relative', '--name-only', '-z', `${mergeBase}...HEAD`]),
    ) ||
    !addPaths(
      paths,
      runGit(projectDirectory, ['diff', '--relative', '--name-only', '-z', 'HEAD']),
    ) ||
    !addPaths(paths, runGit(projectDirectory, ['ls-files', '--others', '--exclude-standard', '-z']))
  )
    return [];
  return [...paths];
}

/** Dynamic project facts needed to bind a receipt to the phase's real work. */
export function reviewClaimContext(
  projectDirectory: string,
  ticketDirectory: string,
): Pick<StampClaim, 'intakeArtifact' | 'implementationFiles'> {
  return {
    intakeArtifact: existsSync(nodePath.join(ticketDirectory, 'spec.md')) ? 'spec.md' : 'ticket.md',
    implementationFiles: currentWorkFiles(projectDirectory),
  };
}

/**
 * The stamps that may be trusted, dropping any whose coordinator claim the
 * cited review does not actually witness. Stamps claiming no coordinator
 * verdict pass through untouched — they assert nothing needing a witness.
 */
export function verifiedStamps(
  stamps: readonly ReviewStamp[],
  projectDirectory: string,
  scope: string,
): ReviewStamp[] {
  const readReceipt = createReviewReceiptReader(projectDirectory);
  return stamps
    .filter(stamp => stamp.scope === scope)
    .filter(stamp => {
      if (stamp.skipReason !== undefined || !claimsCoordinatorVerdict(stamp.independence))
        return true;
      if (stamp.reviewId === undefined) return false;

      const ticketDirectory = nodePath.join(
        resolveNamespaceRoot(projectDirectory),
        'tickets',
        stamp.scope.slice(0, stamp.scope.indexOf(':')),
      );
      const claim = claimFromScope(stamp.scope, {
        projectDirectory,
        ticketDirectory,
        ...reviewClaimContext(projectDirectory, ticketDirectory),
        independence: stamp.independence,
        authorAgent: stamp.author,
        reviewerAgent: stamp.reviewer,
      });
      if (claim === undefined) return false;

      return receiptGateVerdict(claim, readReceipt(stamp.reviewId)).ok;
    });
}
