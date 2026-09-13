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

/**
 * A run of path-segment chars with ≥1 `/`. The leading negative lookbehind
 * drops URL hosts (`://…`) and mid-word matches; the optional leading `.`
 * captures dotfile dirs (`.safeword/…`); the optional trailing `/` keeps
 * directory references.
 */
const PATH_TOKEN = /(?<![\w:./-])\.?[\w-]+(?:\/[\w.-]+)+\/?/g;

/**
 * Extract repo-relative path-like tokens a ticket references from its text
 * (markdown links, backtick spans, bare paths), deduped. This is the relevance
 * signal at the resume boundary: a ticket's artifacts name the paths it cares
 * about. (A history signal — files the ticket's own commits touched — was
 * considered but deferred: at resume the ticket has usually edited nothing yet,
 * and a `git log --grep=<id>` proxy risks the false positives this filter
 * exists to avoid. See dimensions.md.)
 */
export function extractReferencedPaths(text: string): string[] {
  return [...new Set(text.match(PATH_TOKEN) ?? [])];
}

/** Inputs to the surface decision — pure snapshot of ticket + git + session state. */
export interface ReplanContext {
  ticketType: string | undefined;
  /** Current HEAD sha. */
  headSha: string;
  /** HEAD sha already prompted for this ticket this session (absent if none yet). */
  promptedHead: string | undefined;
  referencedPaths: readonly string[];
  /** Commits since the ticket's `last_modified`. */
  commits: readonly ReplanCommit[];
}

/**
 * Decide whether to surface the replan heads-up. Epics never trigger (you work
 * sub-tickets, not epics). The heads-up fires at most once per HEAD advance:
 * if HEAD has not moved past the already-prompted sha, stay silent even when
 * relevant commits exist — otherwise it would re-fire every turn. When HEAD has
 * advanced, delegate to the relevance count.
 */
export function decideReplan(context: ReplanContext): ReplanDecision {
  if (context.ticketType === 'epic') return { surface: false, relevantCommitCount: 0 };
  if (context.headSha !== '' && context.headSha === context.promptedHead) {
    return { surface: false, relevantCommitCount: 0 };
  }
  return shouldSurfaceReplan(context.commits, context.referencedPaths);
}

const COMMIT_SEPARATOR = String.fromCharCode(0x1f);

/**
 * Parse `git log --name-only --pretty=format:%x1f%H` output into commits. Each
 * block is prefixed by a unit separator (\x1f); the block's first line is the
 * sha (dropped) and the rest are the changed paths. Robust to the blank lines
 * `--name-only` interleaves, since splitting keys on the separator, not layout.
 */
export function parseGitLogNameOnly(raw: string): ReplanCommit[] {
  return raw
    .split(COMMIT_SEPARATOR)
    .map(block =>
      block
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean),
    )
    .filter(lines => lines.length > 0)
    .map(lines => ({ changedPaths: lines.slice(1) }));
}

/**
 * Shared re-decide clause (ticket 97BZ9S): when the resume check finds scope
 * may be stale, name `/figure-it-out` as the tool for re-deciding the approach
 * against current docs — so revalidation isn't just "is it still good?" but
 * "and if not, decide the new approach with evidence." Appended to both
 * heads-up messages; the narrow slice of ZBVGPF that runs figure-it-out during
 * revalidation without the full intake embedding.
 */
const REDECIDE_OFFER =
  " If scope shifted, I'll run `/figure-it-out` to re-decide the approach against current docs.";

/**
 * The opt-in heads-up: names the relevant-commit count and offers one step to
 * accept ("check the plan"); declining is just proceeding. Phrased so an agent
 * runs the investigation only on explicit accept (output-safety, design B).
 */
export function formatReplanHeadsUp(relevantCommitCount: number): string {
  const noun = relevantCommitCount === 1 ? 'commit' : 'commits';
  return `Resume check: ${relevantCommitCount} ${noun} since you last touched this ticket changed files it references — the plan may be stale. Say "check the plan" and I'll investigate whether scope still holds (still-good / change / cancel / split / merge); otherwise I'll proceed as planned.${REDECIDE_OFFER}`;
}

/** Terminal ticket statuses — a depends_on target in one of these is "resolved"
 * (cleared, abandoned, or moot), the event mature trackers (Linear, Jira) signal
 * on. Both spellings of cancel are accepted. */
const TERMINAL_STATUSES = new Set(['done', 'cancelled', 'canceled', 'superseded', 'wontfix']);

/**
 * A `depends_on` target resolved to its current status + repo-relative ticket.md
 * path, so it can be matched against the commit window.
 */
export interface BlockerTarget {
  id: string;
  slug: string;
  status: string;
  ticketPath: string;
}

/** A blocker that moved: it is terminal AND its ticket.md changed in the window. */
export interface MovedBlocker {
  id: string;
  slug: string;
  status: string;
}

/**
 * The `depends_on` targets whose blocker "moved": currently terminal AND their
 * ticket.md appears in the commit window. Mirrors how Linear/Jira fire on the
 * blocker's resolution transition (not on arbitrary edits); the rare false
 * positive — an edit to an already-terminal blocker — is dismissible.
 */
export function detectMovedBlockers(
  targets: readonly BlockerTarget[],
  commits: readonly ReplanCommit[],
): MovedBlocker[] {
  const changedPaths = new Set(commits.flatMap(commit => [...commit.changedPaths]));
  return targets
    .filter(target => TERMINAL_STATUSES.has(target.status) && changedPaths.has(target.ticketPath))
    .map(({ id, slug, status }) => ({ id, slug, status }));
}

/**
 * The opt-in blocker-moved heads-up: names the resolved blocker(s) slug-first and
 * offers the same one-step "check the plan" accept as the path-relevance heads-up.
 * Slug-first format is inlined — hooks are standalone and can't import src/.
 */
export function formatBlockerMovedHeadsUp(moved: readonly MovedBlocker[]): string {
  const list = moved.map(blocker => `${blocker.slug} (${blocker.id})`).join(', ');
  const subject = moved.length === 1 ? 'A blocker' : 'Blockers';
  const verb = moved.length === 1 ? 'is' : 'are';
  return `Resume check: ${subject} you depend on ${verb} now resolved — ${list} reached a terminal status since you last touched this ticket; the plan may be stale. Say "check the plan" and I'll investigate whether scope still holds; otherwise I'll proceed.${REDECIDE_OFFER}`;
}
