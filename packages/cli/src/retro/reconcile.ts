// Reconcile sweep (G19QG7): flag open retro issues whose surface changed after
// their newest recorded code state as possibly-resolved. Flag-only — never
// closes; idempotent via the marker comment; per-issue isolation like triage.

import { RETRO_LABEL } from './draft.js';
import { PROCESS_PREFIX } from './egress.js';
import { LEDGER_MARKER, parseLedger, type StoredProvenance } from './ledger.js';
import type { IssueComment } from './triage.js';

export const RECONCILE_LABEL = 'possibly-resolved';
export const RECONCILE_MARKER = '<!-- retro-reconcile -->';

export interface ReconcileIssue {
  number: number;
  title: string;
  body: string;
  labels: string[];
}

/** The GitHub boundary for the sweep — injectable, like triage's IssueTracker. */
export interface ReconcileTracker {
  listIssues(query: { state: string; labels: string[] }): Promise<ReconcileIssue[]>;
  listComments(issueNumber: number): Promise<IssueComment[]>;
  createComment(issueNumber: number, body: string): Promise<IssueComment>;
  addLabels(issueNumber: number, labels: string[]): Promise<void>;
  /** ISO date of the commit a release tag points at, or undefined when unresolvable. */
  resolveTagDate(tag: string): Promise<string | undefined>;
  /** True when the default branch has commits touching `path` since `sinceIso`. */
  surfaceTouchedSince(path: string, sinceIso: string): Promise<boolean>;
}

export interface ReconcileResult {
  flagged: number[];
  /** Evaluated and found ineligible or already flagged. */
  skipped: number[];
  /** Not evaluated — the per-run flag bound was reached; a later run picks these up. */
  deferred: number[];
  failed: number[];
}

// The issue body is code-assembled by buildDraft; this line shape is stable.
const SURFACE_LINE = /\*\*Safeword surface:\*\* `([^`]+)`/;

function surfaceOf(issue: ReconcileIssue): string | undefined {
  return SURFACE_LINE.exec(issue.body)?.[1];
}

/**
 * Normalize stored provenance to the NEWEST code-state date across kinds: a
 * dogfood SHA keys on its capture time, a version keys on its release-tag date
 * (resolved through the tracker), and a mixed ledger keys on the later of the
 * two — never the newest wall clock. Undefined = unreconcilable, caller skips;
 * a version whose tag cannot be resolved never falls back to a guess.
 */
async function codeStateDate(
  provenance: StoredProvenance,
  tracker: ReconcileTracker,
): Promise<string | undefined> {
  const dates: string[] = [];
  if (provenance.dogfood) dates.push(provenance.dogfood.at);
  if (provenance.install) {
    const tagDate = await tracker.resolveTagDate(`v${provenance.install.version}`);
    if (tagDate === undefined) return undefined;
    dates.push(tagDate);
  }
  if (dates.length === 0) return undefined;
  // ISO-8601 UTC strings order lexically.
  return dates.toSorted((a, b) => a.localeCompare(b)).at(-1);
}

function flagBody(): string {
  return [
    RECONCILE_MARKER,
    '**Possibly resolved** — this surface changed on the default branch after the',
    'newest recorded encounter. Verify against current HEAD before closing; the',
    'reconcile sweep never closes issues.',
  ].join('\n');
}

export interface ReconcileOptions {
  /**
   * Per-run flag bound (actions/stale `operations-per-run` precedent): at most
   * this many issues are flagged per sweep; each applied flag lands complete
   * (comment + label together) and the remainder waits for a later run.
   */
  maxFlags?: number;
}

const DEFAULT_MAX_FLAGS = 30;

export async function reconcile(
  tracker: ReconcileTracker,
  options: ReconcileOptions = {},
): Promise<ReconcileResult> {
  const maxFlags = options.maxFlags ?? DEFAULT_MAX_FLAGS;
  const result: ReconcileResult = { flagged: [], skipped: [], deferred: [], failed: [] };
  const issues = await tracker.listIssues({ state: 'open', labels: [RETRO_LABEL] });

  for (const issue of issues) {
    if (result.flagged.length >= maxFlags) {
      result.deferred.push(issue.number); // bound reached — a later run picks these up
      continue;
    }
    // Per-issue isolation (triage precedent): one poisoned issue or failing
    // query must not sink the rest of the sweep.
    try {
      const verdict = await evaluateIssue(issue, tracker);
      if (verdict === 'skip') {
        result.skipped.push(issue.number);
      } else {
        await applyFlag(verdict, issue, tracker);
        result.flagged.push(issue.number);
      }
    } catch {
      result.failed.push(issue.number);
    }
  }

  return result;
}

type IssueVerdict = 'skip' | 'flag' | 'repair-label' | 'repair-comment';

/**
 * A flag lands complete (comment + label together): a run that died between
 * the two leaves a half-flag, which the next run repairs by applying only the
 * missing artifact instead of wedging on the marker check forever.
 */
async function applyFlag(
  verdict: Exclude<IssueVerdict, 'skip'>,
  issue: ReconcileIssue,
  tracker: ReconcileTracker,
): Promise<void> {
  if (verdict !== 'repair-label') await tracker.createComment(issue.number, flagBody());
  if (verdict !== 'repair-comment') await tracker.addLabels(issue.number, [RECONCILE_LABEL]);
}

/**
 * The per-issue decision, fail-closed at every rung: no file-path surface,
 * already flagged (comment marker AND label), no provenance (pre-feature), or
 * an unresolvable tag date all mean "leave untouched, never guess". A half-flag
 * (marker without label, or label without marker — a prior run's partial
 * failure) is completed without re-evaluating eligibility: the prior run
 * already decided to flag.
 */
async function evaluateIssue(
  issue: ReconcileIssue,
  tracker: ReconcileTracker,
): Promise<IssueVerdict> {
  const surface = surfaceOf(issue);
  if (!surface || surface.startsWith(PROCESS_PREFIX)) return 'skip';

  const comments = await tracker.listComments(issue.number);
  const existing = existingFlagVerdict(issue, comments);
  if (existing) return existing;

  const since = await eligibleSince(comments, tracker);
  if (!since) return 'skip';

  return (await tracker.surfaceTouchedSince(surface, since)) ? 'flag' : 'skip';
}

/** The newest recorded code-state date, or undefined when unreconcilable. */
async function eligibleSince(
  comments: IssueComment[],
  tracker: ReconcileTracker,
): Promise<string | undefined> {
  const ledgerComment = comments.find(comment => comment.body.includes(LEDGER_MARKER));
  const provenance = ledgerComment ? parseLedger(ledgerComment.body).provenance : undefined;
  if (!provenance) return undefined;
  return codeStateDate(provenance, tracker);
}

/** Idempotency rung: fully flagged → skip; half-flagged → the repair verdict. */
function existingFlagVerdict(
  issue: ReconcileIssue,
  comments: IssueComment[],
): IssueVerdict | undefined {
  const hasLabel = issue.labels.includes(RECONCILE_LABEL);
  const hasMarker = comments.some(comment => comment.body.includes(RECONCILE_MARKER));
  if (hasMarker && hasLabel) return 'skip';
  if (hasMarker) return 'repair-label';
  if (hasLabel) return 'repair-comment';
  return undefined;
}
