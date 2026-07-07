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

import { LEDGER_MARKER, parseLedger, type Provenance } from './ledger.js';

// The issue body is code-assembled by buildDraft; this line shape is stable.
const SURFACE_LINE = /\*\*Safeword surface:\*\* `([^`]+)`/;

function surfaceOf(issue: ReconcileIssue): string | undefined {
  return SURFACE_LINE.exec(issue.body)?.[1];
}

/**
 * Normalize an issue's newest provenance to its code-state date: a dogfood SHA
 * keys on its capture time; a version keys on its release-tag date (resolved
 * through the tracker). Undefined = unreconcilable, caller skips.
 */
async function codeStateDate(
  provenance: Provenance,
  tracker: ReconcileTracker,
): Promise<string | undefined> {
  if (provenance.sha) return provenance.at;
  if (provenance.version) return tracker.resolveTagDate(`v${provenance.version}`);
  return undefined;
}

function flagBody(): string {
  return [
    RECONCILE_MARKER,
    '**Possibly resolved** — this surface changed on the default branch after the',
    'newest recorded encounter. Verify against current HEAD before closing; the',
    'reconcile sweep never closes issues.',
  ].join('\n');
}

export async function reconcile(tracker: ReconcileTracker): Promise<ReconcileResult> {
  const result: ReconcileResult = { flagged: [], skipped: [], failed: [] };
  const issues = await tracker.listIssues({ state: 'open', labels: ['retro'] });

  for (const issue of issues) {
    // Per-issue isolation (triage precedent): one poisoned issue or failing
    // query must not sink the rest of the sweep.
    try {
      const surface = surfaceOf(issue);
      if (!surface || surface.startsWith('process/')) {
        result.skipped.push(issue.number);
        continue;
      }

      const comments = await tracker.listComments(issue.number);
      if (comments.some(comment => comment.body.includes(RECONCILE_MARKER))) {
        result.skipped.push(issue.number); // already flagged — idempotent
        continue;
      }

      const ledgerComment = comments.find(comment => comment.body.includes(LEDGER_MARKER));
      const provenance = ledgerComment ? parseLedger(ledgerComment.body).provenance : undefined;
      if (!provenance) {
        result.skipped.push(issue.number); // pre-provenance — never guessed at
        continue;
      }

      const since = await codeStateDate(provenance, tracker);
      if (!since) {
        result.skipped.push(issue.number); // unresolvable tag — never guessed at
        continue;
      }

      if (!(await tracker.surfaceTouchedSince(surface, since))) {
        result.skipped.push(issue.number);
        continue;
      }

      await tracker.createComment(issue.number, flagBody());
      await tracker.addLabels(issue.number, [RECONCILE_LABEL]);
      result.flagged.push(issue.number);
    } catch {
      result.failed.push(issue.number);
    }
  }

  return result;
}
