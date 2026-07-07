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

export function reconcile(_tracker: ReconcileTracker): Promise<ReconcileResult> {
  return Promise.resolve({ flagged: [], skipped: [], failed: [] });
}
