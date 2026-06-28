// Triage — file findings against the upstream tracker with zero duplicate
// issues but a record of every encounter. The IssueTracker is the only
// boundary (mockable in tests); all dedup/cap/ledger logic is deterministic.
//
// - A signature already represented by an open issue (matched by title) never
//   spawns a second issue (SM1.AC2); title-match also catches spool-filed issues.
// - New-issue creation is capped per session; the overflow is deferred.
// - Every encounter with a known issue updates the occurrence ledger idempotently
//   (one bump per session) and posts a shape comment only for a novel
//   manifestation (SM1.AC3).

import type { RetroDraft } from './draft.js';
import {
  emptyLedger,
  LEDGER_MARKER,
  type LedgerState,
  parseLedger,
  recordEncounter,
  renderLedger,
} from './ledger.js';

export interface IssueReference {
  number: number;
  title: string;
}

export interface IssueComment {
  id: number;
  body: string;
}

export interface CreateIssueInput {
  title: string;
  body: string;
  labels: string[];
}

export interface IssueTracker {
  searchByTitle(title: string): Promise<IssueReference[]>;
  createIssue(input: CreateIssueInput): Promise<IssueReference>;
  listComments(issueNumber: number): Promise<IssueComment[]>;
  createComment(issueNumber: number, body: string): Promise<IssueComment>;
  updateComment(commentId: number, body: string): Promise<void>;
}

export interface Encounter {
  draft: RetroDraft;
  /** Stable hash of the sanitized manifestation, for novelty (shape) detection. */
  manifestation: string;
}

export interface TriageContext {
  sessionId: string;
  harness: string;
  maxNewIssues?: number;
}

export interface TriageResult {
  created: string[];
  bumped: string[];
  commented: string[];
  deferred: string[];
  /** Encounters whose transport calls threw — isolated so one can't sink the batch. */
  failed: string[];
}

const DEFAULT_MAX_NEW_ISSUES = 5;

export async function triage(
  transport: IssueTracker,
  encounters: readonly Encounter[],
  ctx: TriageContext,
): Promise<TriageResult> {
  const result: TriageResult = { created: [], bumped: [], commented: [], deferred: [], failed: [] };
  const maxNew = ctx.maxNewIssues ?? DEFAULT_MAX_NEW_ISSUES;
  let newCount = 0;

  for (const encounter of encounters) {
    // Isolate each encounter: a transport error (or a poisoned upstream ledger)
    // on one issue must not abort the rest of the session's findings (C3).
    try {
      const matches = await transport.searchByTitle(encounter.draft.title);
      const [existing] = matches;

      if (existing) {
        await recordOnKnownIssue(transport, existing, encounter, ctx, result);
      } else if (newCount >= maxNew) {
        result.deferred.push(encounter.draft.title);
      } else {
        const issue = await transport.createIssue({
          title: encounter.draft.title,
          body: encounter.draft.body,
          labels: encounter.draft.labels,
        });
        newCount += 1;
        result.created.push(encounter.draft.title);
        await transport.createComment(issue.number, renderLedger(seedState(encounter, ctx)));
      }
    } catch {
      result.failed.push(encounter.draft.title);
    }
  }

  return result;
}

function seedState(encounter: Encounter, ctx: TriageContext): LedgerState {
  return recordEncounter(emptyLedger(), {
    sessionId: ctx.sessionId,
    harness: ctx.harness,
    manifestation: encounter.manifestation,
  }).state;
}

async function recordOnKnownIssue(
  transport: IssueTracker,
  issue: IssueReference,
  encounter: Encounter,
  ctx: TriageContext,
  result: TriageResult,
): Promise<void> {
  const comments = await transport.listComments(issue.number);
  const ledgerComment = comments.find(c => c.body.includes(LEDGER_MARKER));
  const previous = ledgerComment ? parseLedger(ledgerComment.body) : emptyLedger();

  const { state, changed, novel } = recordEncounter(previous, {
    sessionId: ctx.sessionId,
    harness: ctx.harness,
    manifestation: encounter.manifestation,
  });

  if (changed) {
    const body = renderLedger(state);
    if (ledgerComment) {
      await transport.updateComment(ledgerComment.id, body);
    } else {
      await transport.createComment(issue.number, body);
    }
    result.bumped.push(issue.title);
  }

  if (novel) {
    await transport.createComment(
      issue.number,
      `**New manifestation observed**\n\n${encounter.draft.body}`,
    );
    result.commented.push(issue.title);
  }
}
