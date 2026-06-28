import { describe, expect, it } from 'vitest';

import type { RetroDraft } from './draft.js';
import { LEDGER_MARKER, renderLedger } from './ledger.js';
import {
  type CreateIssueInput,
  type Encounter,
  type IssueComment,
  type IssueReference,
  type IssueTracker,
  triage,
} from './triage.js';

interface StoredIssue {
  number: number;
  title: string;
  body: string;
  labels: string[];
}

// In-memory GitHub. Only the transport boundary is faked; all triage/ledger
// logic is real (wiring-style test per dimensions.md).
class FakeGitHub implements IssueTracker {
  private nextIssue = 1;
  private nextComment = 1;
  failListComments = false;
  readonly issues: StoredIssue[] = [];
  readonly commentsByIssue = new Map<number, IssueComment[]>();
  readonly calls = { createIssue: 0, createComment: 0, updateComment: 0 };

  seedIssue(title: string, ledger?: { sessions: string[]; manifestations: string[] }): StoredIssue {
    const issue: StoredIssue = { number: this.nextIssue++, title, body: '', labels: [] };
    this.issues.push(issue);
    const comments: IssueComment[] = [];
    if (ledger) {
      comments.push({
        id: this.nextComment++,
        body: renderLedger({
          total: ledger.sessions.length,
          harness: { claude: ledger.sessions.length },
          sessions: ledger.sessions,
          manifestations: ledger.manifestations,
        }),
      });
    }
    this.commentsByIssue.set(issue.number, comments);
    return issue;
  }

  searchByTitle(title: string): Promise<IssueReference[]> {
    return Promise.resolve(
      this.issues.filter(i => i.title === title).map(i => ({ number: i.number, title: i.title })),
    );
  }

  createIssue(input: CreateIssueInput): Promise<IssueReference> {
    this.calls.createIssue += 1;
    const issue: StoredIssue = { number: this.nextIssue++, ...input };
    this.issues.push(issue);
    this.commentsByIssue.set(issue.number, []);
    return Promise.resolve({ number: issue.number, title: issue.title });
  }

  listComments(issueNumber: number): Promise<IssueComment[]> {
    if (this.failListComments) return Promise.reject(new Error('transport boom'));
    return Promise.resolve(this.commentsByIssue.get(issueNumber) ?? []);
  }

  createComment(issueNumber: number, body: string): Promise<IssueComment> {
    this.calls.createComment += 1;
    const comment: IssueComment = { id: this.nextComment++, body };
    (this.commentsByIssue.get(issueNumber) ?? []).push(comment);
    return Promise.resolve(comment);
  }

  updateComment(commentId: number, body: string): Promise<void> {
    this.calls.updateComment += 1;
    for (const comments of this.commentsByIssue.values()) {
      const found = comments.find(c => c.id === commentId);
      if (found) found.body = body;
    }
    return Promise.resolve();
  }

  ledgerOf(issueNumber: number): string | undefined {
    return this.commentsByIssue.get(issueNumber)?.find(c => c.body.includes(LEDGER_MARKER))?.body;
  }
}

const draft = (title: string): RetroDraft => ({
  signature: `retro:${title}`,
  title,
  body: `body for ${title}`,
  labels: ['self-report', 'retro', 'rough-edge'],
});

const enc = (title: string, manifestation = 'm1'): Encounter => ({
  draft: draft(title),
  manifestation,
});
const ctx = (over: Partial<{ sessionId: string; harness: string; maxNewIssues: number }> = {}) => ({
  sessionId: 'sess-a',
  harness: 'claude',
  ...over,
});

describe('triage — never a duplicate issue (SM1.AC2)', () => {
  it('retro-transcript-mining.SM1.AC2.unticketed_signature_creates_one_issue', async () => {
    const gh = new FakeGitHub();
    const result = await triage(gh, [enc('New friction')], ctx());
    expect(gh.calls.createIssue).toBe(1);
    expect(result.created).toEqual(['New friction']);
  });

  it('retro-transcript-mining.SM1.AC2.existing_signature_creates_no_duplicate', async () => {
    const gh = new FakeGitHub();
    gh.seedIssue('Known friction', { sessions: ['old'], manifestations: ['m1'] });
    const result = await triage(gh, [enc('Known friction')], ctx());
    expect(gh.calls.createIssue).toBe(0);
    expect(result.created).toEqual([]);
  });

  it('retro-transcript-mining.SM1.AC2.matches_spool_filed_issue_without_duplicating', async () => {
    const gh = new FakeGitHub();
    // A spool-filed issue: same title, no retro ledger comment (non-retro origin).
    gh.seedIssue('Coverage gate crash');
    const result = await triage(gh, [enc('Coverage gate crash')], ctx());
    expect(gh.calls.createIssue).toBe(0);
    expect(result.created).toEqual([]);
  });

  it('retro-transcript-mining.SM1.AC2.exactly_five_new_signatures_all_file', async () => {
    const gh = new FakeGitHub();
    const encounters = ['a', 'b', 'c', 'd', 'e'].map(t => enc(t));
    const result = await triage(gh, encounters, ctx());
    expect(gh.calls.createIssue).toBe(5);
    expect(result.created).toHaveLength(5);
    expect(result.deferred).toEqual([]);
  });

  it('retro-transcript-mining.SM1.AC2.per_session_new_issue_cap_is_enforced', async () => {
    const gh = new FakeGitHub();
    const encounters = ['a', 'b', 'c', 'd', 'e', 'f'].map(t => enc(t));
    const result = await triage(gh, encounters, ctx());
    expect(gh.calls.createIssue).toBe(5);
    expect(result.created).toHaveLength(5);
    expect(result.deferred).toEqual(['f']);
  });
});

describe('triage — count every encounter, record novel shapes (SM1.AC3)', () => {
  it('retro-transcript-mining.SM1.AC3.known_issue_hit_bumps_the_ledger_once', async () => {
    const gh = new FakeGitHub();
    gh.seedIssue('Known friction', { sessions: ['old'], manifestations: ['m1'] });
    await triage(gh, [enc('Known friction')], ctx({ sessionId: 'sess-new' }));
    expect(gh.calls.updateComment).toBe(1);
    expect(gh.ledgerOf(1)).toContain('2 across 2 session(s)');
  });

  it('retro-transcript-mining.SM1.AC3.rerun_on_same_transcript_does_not_double_count', async () => {
    const gh = new FakeGitHub();
    gh.seedIssue('Known friction', { sessions: ['sess-a'], manifestations: ['m1'] });
    await triage(gh, [enc('Known friction')], ctx({ sessionId: 'sess-a' }));
    expect(gh.calls.updateComment).toBe(0);
    expect(gh.calls.createComment).toBe(0);
    expect(gh.ledgerOf(1)).toContain('1 across 1 session(s)');
  });

  it('retro-transcript-mining.SM1.AC3.novel_manifestation_adds_a_comment', async () => {
    const gh = new FakeGitHub();
    gh.seedIssue('Known friction', { sessions: ['old'], manifestations: ['m1'] });
    const result = await triage(
      gh,
      [enc('Known friction', 'm-new')],
      ctx({ sessionId: 'sess-new' }),
    );
    expect(gh.calls.createComment).toBe(1);
    expect(result.commented).toEqual(['Known friction']);
  });

  it('retro-transcript-mining.SM1.AC3.non_novel_recurrence_adds_no_comment', async () => {
    const gh = new FakeGitHub();
    gh.seedIssue('Known friction', { sessions: ['old'], manifestations: ['m1'] });
    const result = await triage(gh, [enc('Known friction', 'm1')], ctx({ sessionId: 'sess-new' }));
    // count increases (ledger updated) but NO new shape comment
    expect(gh.calls.updateComment).toBe(1);
    expect(gh.calls.createComment).toBe(0);
    expect(result.commented).toEqual([]);
  });
});

describe('triage resilience (C3)', () => {
  it('one failing issue does not sink the rest of the batch', async () => {
    const gh = new FakeGitHub();
    gh.seedIssue('Boom'); // existing → hits listComments (which we make throw)
    gh.failListComments = true;
    const result = await triage(gh, [enc('Boom'), enc('Fresh')], ctx());
    expect(result.failed).toContain('Boom');
    expect(result.created).toContain('Fresh');
  });
});
