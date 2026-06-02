// Safeword: replan relevance filter (ticket 153, design B). Pure, no I/O.
//
// A changed path is "relevant" to a ticket if the ticket references it (exact
// match, or it lives under a referenced directory) AND it is not a high-churn
// manifest. Excluding high-churn manifests at the source keeps the replan
// heads-up's alert-to-action ratio high (a ticket that merely mentions
// package.json shouldn't replan on every dependency bump). See the ADR.

/** High-churn, low-signal paths excluded from relevance even when referenced. */
const HIGH_CHURN_DENYLIST = [
  /(^|\/)package\.json$/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)bun\.lockb?$/,
  /(^|\/)tsconfig[^/]*\.json$/,
  /(^|\/)\.gitignore$/,
];

function isHighChurn(path: string): boolean {
  return HIGH_CHURN_DENYLIST.some(pattern => pattern.test(path));
}

/**
 * Whether `changed` is covered by `reference` — an exact match, or `changed`
 * lives under `reference` when the reference names a directory.
 */
function isCoveredBy(changed: string, reference: string): boolean {
  if (changed === reference) return true;
  const directory = reference.endsWith('/') ? reference : `${reference}/`;
  return changed.startsWith(directory);
}

/**
 * The subset of `changedPaths` relevant to a ticket: those the ticket
 * references (exact or under a referenced directory), minus high-churn
 * manifests. Empty `referencedPaths` (no signal) yields no relevant paths —
 * the deliberate bias-quiet default for a drift-catcher.
 */
export function relevantChangedPaths(
  referencedPaths: readonly string[],
  changedPaths: readonly string[],
): string[] {
  return changedPaths.filter(
    changed =>
      !isHighChurn(changed) && referencedPaths.some(reference => isCoveredBy(changed, reference)),
  );
}

/** A commit reduced to the file paths it changed (`git diff --name-only`). */
export interface ReplanCommit {
  changedPaths: readonly string[];
}

/** Whether to surface a replan heads-up, and how many commits warrant it. */
export interface ReplanDecision {
  surface: boolean;
  relevantCommitCount: number;
}

/**
 * Decide whether to surface a replan heads-up. A commit is relevant when any of
 * its changed paths survive the relevance filter; we surface when ≥1 commit is
 * relevant, and the count drives the heads-up message ("N relevant commits…").
 */
export function shouldSurfaceReplan(
  commits: readonly ReplanCommit[],
  referencedPaths: readonly string[],
): ReplanDecision {
  const relevantCommitCount = commits.filter(
    commit => relevantChangedPaths(referencedPaths, commit.changedPaths).length > 0,
  ).length;
  return { surface: relevantCommitCount > 0, relevantCommitCount };
}
