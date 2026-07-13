import { describe, expect, it } from 'vitest';

import { type RetroDraft, signatureMarker } from './draft.js';
import { shortHash } from './hash.js';
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

  seedIssue(
    title: string,
    ledger?: { sessions: string[]; manifestations: string[] },
    signature = `retro:${title}`,
  ): StoredIssue {
    // Embed the signature marker in the body so searchBySignature finds it, exactly
    // as a real retro-filed issue carries it (buildDraft → signatureMarker).
    const issue: StoredIssue = {
      number: this.nextIssue++,
      title,
      body: signatureMarker(signature),
      labels: [],
    };
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

  searchBySignature(signature: string): Promise<IssueReference[]> {
    // Match on the signature embedded in the body (as the real REST transport does
    // via in:body + exact-filter), NOT the title.
    return Promise.resolve(
      this.issues
        .filter(i => i.body.includes(signature))
        .map(i => ({ number: i.number, title: i.title })),
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

const draft = (title: string, signature = `retro:${title}`): RetroDraft => {
  const body = `body for ${title}\n${signatureMarker(signature)}`;
  return {
    signature,
    title,
    body,
    bodyDigest: shortHash(body),
    labels: ['self-report', 'retro', 'rough-edge'],
  };
};

const enc = (title: string, manifestation = 'm1', signature?: string): Encounter => ({
  draft: draft(title, signature),
  manifestation,
});
const ctx = (over: Partial<{ sessionId: string; harness: string; maxNewIssues: number }> = {}) => ({
  sessionId: 'sess-a',
  harness: 'claude',
  ...over,
});

describe('triage — session-id egress token (FG6V57)', () => {
  // The rule (substitute-not-strip, [\w.-], cap 80) is pinned byte-identical
  // with retro-draft-spool.ts and self-report.ts by a parity contract.
  it('caps and substitutes a hostile session id before it reaches the public ledger', async () => {
    const gh = new FakeGitHub();
    const seeded = gh.seedIssue('Known friction', { sessions: ['old'], manifestations: ['m1'] });
    const hostile = `evil session@${'x'.repeat(100)}`;

    await triage(gh, [enc('Known friction')], ctx({ sessionId: hostile }));

    const ledger = gh.ledgerOf(seeded.number) ?? '';
    const expected = `evil_session_${'x'.repeat(100)}`.slice(0, 80);
    expect(ledger).toContain(expected);
    expect(ledger).not.toContain('evil session@');
    expect(ledger).not.toContain('x'.repeat(81));
  });
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

describe('triage — dedupe by content signature, not title (ZFGWS1 SM2.AC1)', () => {
  it('retro-recall.SM2.AC1.repeat_signature_under_a_different_title_opens_no_second_issue', async () => {
    const gh = new FakeGitHub();
    // An issue already filed for signature S under one (model-generated) title.
    gh.seedIssue(
      'Coverage gate omits the file',
      { sessions: ['old'], manifestations: ['m1'] },
      'retro:abc123def456',
    );
    // A re-fire surfaces the SAME signature under a DIFFERENT title.
    const result = await triage(
      gh,
      [enc('Gate message is missing the filename', 'm1', 'retro:abc123def456')],
      ctx({ sessionId: 'sess-new' }),
    );
    expect(gh.calls.createIssue).toBe(0);
    expect(result.created).toEqual([]);
  });

  it('retro-recall.SM2.AC1.a_genuinely_new_signature_opens_a_new_issue', async () => {
    const gh = new FakeGitHub();
    gh.seedIssue(
      'Some other friction',
      { sessions: ['old'], manifestations: ['m1'] },
      'retro:111111111111',
    );
    const result = await triage(gh, [enc('Brand new friction', 'm1', 'retro:222222222222')], ctx());
    expect(gh.calls.createIssue).toBe(1);
    expect(result.created).toEqual(['Brand new friction']);
  });

  it('retro-recall.SM2.AC1.a_fuzzy_search_near_miss_is_rejected_by_the_exact_filter', async () => {
    const gh = new FakeGitHub();
    // The body carries a DIFFERENT signature; the FakeGitHub (like the REST
    // exact-filter) only matches the exact signature, so this is not a match.
    gh.seedIssue('Near miss', { sessions: ['old'], manifestations: ['m1'] }, 'retro:aaaaaaaaaaaa');
    const result = await triage(gh, [enc('New finding', 'm1', 'retro:bbbbbbbbbbbb')], ctx());
    expect(gh.calls.createIssue).toBe(1);
    expect(result.created).toEqual(['New finding']);
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
