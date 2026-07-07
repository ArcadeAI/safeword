// Reconcile sweep (G19QG7): flag open retro issues whose surface changed after
// their newest recorded code state as possibly-resolved. Flag-only — never
// closes; idempotent via the marker comment; per-issue isolation like triage.

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
  skipped: number[];
  failed: number[];
}

import { LEDGER_MARKER, parseLedger, type StoredProvenance } from './ledger.js';

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
  const result: ReconcileResult = { flagged: [], skipped: [], failed: [] };
  const issues = await tracker.listIssues({ state: 'open', labels: ['retro'] });

  for (const issue of issues) {
    if (result.flagged.length >= maxFlags) {
      result.skipped.push(issue.number); // bound reached — deferred to a later run
      continue;
    }
    // Per-issue isolation (triage precedent): one poisoned issue or failing
    // query must not sink the rest of the sweep.
    try {
      if (await shouldFlag(issue, tracker)) {
        await tracker.createComment(issue.number, flagBody());
        await tracker.addLabels(issue.number, [RECONCILE_LABEL]);
        result.flagged.push(issue.number);
      } else {
        result.skipped.push(issue.number);
      }
    } catch {
      result.failed.push(issue.number);
    }
  }

  return result;
}

/**
 * The per-issue decision, fail-closed at every rung: no file-path surface,
 * already flagged (idempotency marker), no provenance (pre-feature), or an
 * unresolvable tag date all mean "leave untouched, never guess".
 */
async function shouldFlag(issue: ReconcileIssue, tracker: ReconcileTracker): Promise<boolean> {
  const surface = surfaceOf(issue);
  if (!surface || surface.startsWith('process/')) return false;

  const comments = await tracker.listComments(issue.number);
  if (comments.some(comment => comment.body.includes(RECONCILE_MARKER))) return false;

  const ledgerComment = comments.find(comment => comment.body.includes(LEDGER_MARKER));
  const provenance = ledgerComment ? parseLedger(ledgerComment.body).provenance : undefined;
  if (!provenance) return false;

  const since = await codeStateDate(provenance, tracker);
  if (!since) return false;

  return tracker.surfaceTouchedSince(surface, since);
}
