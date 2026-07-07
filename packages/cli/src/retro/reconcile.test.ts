import { describe, expect, it } from 'vitest';

import { emptyLedger, renderLedger } from './ledger.js';
import {
  reconcile,
  RECONCILE_LABEL,
  RECONCILE_MARKER,
  type ReconcileIssue,
  type ReconcileTracker,
} from './reconcile.js';
import type { IssueComment } from './triage.js';

const issueBody = (surface: string) =>
  [
    '**Category:** bug',
    `**Safeword surface:** \`${surface}\``,
    '',
    '**What happened**',
    '',
    'x',
  ].join('\n');

const ledgerComment = (provenance: {
  dogfood?: { sha: string; at: string };
  install?: { version: string; at: string };
}): string => renderLedger({ ...emptyLedger(), total: 1, sessions: ['s1'], provenance });

/** In-memory tracker — only the GitHub boundary is faked. */
class FakeTracker implements ReconcileTracker {
  readonly listQueries: { state: string; labels: string[] }[] = [];
  readonly comments = new Map<number, string[]>();
  readonly labels = new Map<number, string[]>();

  constructor(
    private readonly issues: ReconcileIssue[],
    private readonly ledgers: Map<number, string>,
    private readonly touched: (path: string, sinceIso: string) => boolean,
    private readonly tagDates: Map<string, string> = new Map(),
  ) {}

  listIssues(query: { state: string; labels: string[] }): Promise<ReconcileIssue[]> {
    this.listQueries.push(query);
    return Promise.resolve(this.issues);
  }

  listComments(issueNumber: number): Promise<IssueComment[]> {
    const bodies = [
      this.ledgers.get(issueNumber),
      ...(this.comments.get(issueNumber) ?? []),
    ].filter((body): body is string => body !== undefined);
    return Promise.resolve(bodies.map((body, index) => ({ id: index + 1, body })));
  }

  createComment(issueNumber: number, body: string): Promise<IssueComment> {
    const existing = this.comments.get(issueNumber) ?? [];
    this.comments.set(issueNumber, [...existing, body]);
    return Promise.resolve({ id: 99, body });
  }

  addLabels(issueNumber: number, labels: string[]): Promise<void> {
    const existing = this.labels.get(issueNumber) ?? [];
    this.labels.set(issueNumber, [...existing, ...labels]);
    return Promise.resolve();
  }

  resolveTagDate(tag: string): Promise<string | undefined> {
    return Promise.resolve(this.tagDates.get(tag));
  }

  surfaceTouchedSince(path: string, sinceIso: string): Promise<boolean> {
    return Promise.resolve(this.touched(path, sinceIso));
  }
}

describe('reconcile — flags surface-touched-after-code-state (SM2.R1)', () => {
  it('flags a dogfood-provenance issue whose surface changed after the capture time', async () => {
    const issue: ReconcileIssue = {
      number: 7,
      title: 'gate omits file',
      body: issueBody('packages/cli/src/retro/pipeline.ts'),
      labels: ['retro'],
    };
    const tracker = new FakeTracker(
      [issue],
      new Map([
        [7, ledgerComment({ dogfood: { sha: 'abc1234', at: '2026-07-01T00:00:00.000Z' } })],
      ]),
      (path, sinceIso) =>
        path === 'packages/cli/src/retro/pipeline.ts' && sinceIso === '2026-07-01T00:00:00.000Z',
    );

    const result = await reconcile(tracker);

    expect(result.flagged).toEqual([7]);
    expect(tracker.labels.get(7)).toContain(RECONCILE_LABEL);
    const flagComment = (tracker.comments.get(7) ?? []).find(c => c.includes(RECONCILE_MARKER));
    expect(flagComment).toBeDefined();
  });

  it('keys a mixed ledger on the newest code state, not the newest wall clock', async () => {
    // Encounter order: dogfood sha first (code state 2026-07-05), then a
    // later-in-time encounter from an older installed version (v0.50.0,
    // tag date 2026-06-01). Newest CODE STATE is the dogfood capture time.
    const { recordEncounter } = await import('./ledger.js');
    const first = recordEncounter(emptyLedger(), {
      sessionId: 's1',
      harness: 'claude',
      manifestation: 'm1',
      provenance: { sha: 'abc1234', at: '2026-07-05T00:00:00.000Z' },
    });
    const second = recordEncounter(first.state, {
      sessionId: 's2',
      harness: 'claude',
      manifestation: 'm1',
      provenance: { version: '0.50.0', at: '2026-07-07T00:00:00.000Z' },
    });

    const issue: ReconcileIssue = {
      number: 9,
      title: 'mixed encounters',
      body: issueBody('packages/cli/src/retro/egress.ts'),
      labels: ['retro'],
    };
    const tracker = new FakeTracker(
      [issue],
      new Map([[9, renderLedger(second.state)]]),
      // Commits exist after the old release's tag date, but none after the
      // dogfood capture time.
      (_path, sinceIso) => sinceIso < '2026-07-05T00:00:00.000Z',
      new Map([['v0.50.0', '2026-06-01T00:00:00.000Z']]),
    );

    const result = await reconcile(tracker);

    expect(result.flagged).toEqual([]);
    expect(tracker.labels.get(9)).toBeUndefined();
  });
});
