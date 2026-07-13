// Triage — file findings against the upstream tracker with zero duplicate
// issues but a record of every encounter. The IssueTracker is the only
// boundary (mockable in tests); all dedup/cap/ledger logic is deterministic.
//
// - A signature already represented by an open issue (matched by the content
//   signature embedded in the body, not the model-generated title — titles vary
//   across delta re-fires; ZFGWS1) never spawns a second issue (SM1.AC2).
// - New-issue creation is capped per session; the overflow is deferred.
// - Every encounter with a known issue updates the occurrence ledger idempotently
//   (one bump per session) and posts a shape comment only for a novel
//   manifestation (SM1.AC3).

import type { RetroDraft } from './draft.js';
import {
  emptyLedger,
  type EncounterInput,
  findLedgerComment,
  type LedgerState,
  parseLedger,
  type Provenance,
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
  /**
   * Find open issues carrying this content `signature` (matched in the body, not
   * the title — titles vary across delta re-fires; ZFGWS1). Returns the matches so
   * triage opens no duplicate for a signature already filed.
   */
  searchBySignature(signature: string): Promise<IssueReference[]>;
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
  /** Code-state provenance for this session's encounters (G19QG7). */
  provenance?: Provenance;
}

export interface TriageResult {
  created: string[];
  bumped: string[];
  commented: string[];
  deferred: string[];
  /** Encounters whose transport calls threw — isolated so one can't sink the batch. */
  failed: string[];
  /**
   * Signatures of the drafts that REACHED the tracker (created or matched an
   * existing issue) — the drafts the cloud-filing spool can safely drain. A
   * deferred (capped) or failed (threw) encounter is NOT here, so it stays spooled
   * for the agent path (BNGK9W).
   */
  filedSignatures: string[];
}

const DEFAULT_MAX_NEW_ISSUES = 5;

export async function triage(
  transport: IssueTracker,
  encounters: readonly Encounter[],
  ctx: TriageContext,
): Promise<TriageResult> {
  const result: TriageResult = {
    created: [],
    bumped: [],
    commented: [],
    deferred: [],
    failed: [],
    filedSignatures: [],
  };
  const maxNew = ctx.maxNewIssues ?? DEFAULT_MAX_NEW_ISSUES;
  // Bound the session id before it flows into the ledger-comment JSON (eng-review
  // #601): it is interpolated into a public issue body, so keep it to a bare token.
  // FG6V57: the rule is pinned byte-identical with retro-draft-spool.ts and
  // self-report.ts by a parity contract.
  const boundContext: TriageContext = {
    ...ctx,
    sessionId: ctx.sessionId.replaceAll(/[^\w.-]/g, '_').slice(0, 80) || 'unknown',
  };
  let newCount = 0;

  for (const encounter of encounters) {
    // Isolate each encounter: a transport error (or a poisoned upstream ledger)
    // on one issue must not abort the rest of the session's findings (C3).
    try {
      const matches = await transport.searchBySignature(encounter.draft.signature);
      const [existing] = matches;

      if (existing) {
        await recordOnKnownIssue(transport, existing, encounter, boundContext, result);
        // The finding is represented upstream (issue exists) — safe to drain.
        result.filedSignatures.push(encounter.draft.signature);
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
        result.filedSignatures.push(encounter.draft.signature);
        await transport.createComment(
          issue.number,
          renderLedger(seedState(encounter, boundContext)),
        );
      }
    } catch {
      result.failed.push(encounter.draft.title);
    }
  }

  return result;
}

// The ledger's per-encounter input, projected from an encounter + its bound
// context. One mapping, so `seedState` and `recordOnKnownIssue` can't drift.
function toEncounterInput(encounter: Encounter, ctx: TriageContext): EncounterInput {
  return {
    sessionId: ctx.sessionId,
    harness: ctx.harness,
    manifestation: encounter.manifestation,
    ...(ctx.provenance && { provenance: ctx.provenance }),
  };
}

function seedState(encounter: Encounter, ctx: TriageContext): LedgerState {
  return recordEncounter(emptyLedger(), toEncounterInput(encounter, ctx)).state;
}

async function recordOnKnownIssue(
  transport: IssueTracker,
  issue: IssueReference,
  encounter: Encounter,
  ctx: TriageContext,
  result: TriageResult,
): Promise<void> {
  const comments = await transport.listComments(issue.number);
  const ledgerComment = findLedgerComment(comments);
  const previous = ledgerComment ? parseLedger(ledgerComment.body) : emptyLedger();

  const { state, changed, novel } = recordEncounter(previous, toEncounterInput(encounter, ctx));

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
