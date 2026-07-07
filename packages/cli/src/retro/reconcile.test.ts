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
    // Faithful to GitHub: labels applied via addLabels appear on later listings.
    return Promise.resolve(
      this.issues.map(issue => ({
        ...issue,
        labels: [...issue.labels, ...(this.labels.get(issue.number) ?? [])],
      })),
    );
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

  it('flags a version-provenance issue whose surface changed after the release-tag date', async () => {
    const issue: ReconcileIssue = {
      number: 3,
      title: 'customer friction',
      body: issueBody('packages/cli/src/retro/egress.ts'),
      labels: ['retro'],
    };
    const tracker = new FakeTracker(
      [issue],
      new Map([
        [3, ledgerComment({ install: { version: '0.50.0', at: '2026-07-07T09:00:00.000Z' } })],
      ]),
      (_path, sinceIso) => sinceIso === '2026-06-01T00:00:00.000Z',
      new Map([['v0.50.0', '2026-06-01T00:00:00.000Z']]),
    );

    const result = await reconcile(tracker);

    expect(result.flagged).toEqual([3]);
    expect(tracker.labels.get(3)).toContain(RECONCILE_LABEL);
  });

  it('leaves an issue unmarked when its surface is untouched since the newest code state', async () => {
    const issue: ReconcileIssue = {
      number: 4,
      title: 'still broken',
      body: issueBody('packages/cli/src/retro/pipeline.ts'),
      labels: ['retro'],
    };
    const tracker = new FakeTracker(
      [issue],
      new Map([
        [4, ledgerComment({ dogfood: { sha: 'abc1234', at: '2026-07-01T00:00:00.000Z' } })],
      ]),
      () => false,
    );

    const result = await reconcile(tracker);

    expect(result.flagged).toEqual([]);
    expect(tracker.labels.get(4)).toBeUndefined();
    expect(tracker.comments.get(4)).toBeUndefined();
  });
});

describe('reconcile — flag-only, idempotent, bounded eligibility (SM2.R2-R5)', () => {
  it('flagging adds exactly one comment and one label and the issue stays open', async () => {
    const issue: ReconcileIssue = {
      number: 5,
      title: 'flag me',
      body: issueBody('packages/cli/src/retro/pipeline.ts'),
      labels: ['retro'],
    };
    const tracker = new FakeTracker(
      [issue],
      new Map([
        [5, ledgerComment({ dogfood: { sha: 'abc1234', at: '2026-07-01T00:00:00.000Z' } })],
      ]),
      () => true,
    );

    const result = await reconcile(tracker);

    // The tracker seam has no close operation at all — reconcile CANNOT close;
    // the flag is exactly one marker comment plus one label.
    expect(result.flagged).toEqual([5]);
    expect(tracker.comments.get(5)).toHaveLength(1);
    expect(tracker.labels.get(5)).toEqual([RECONCILE_LABEL]);
  });

  it('a re-run against unchanged state adds no duplicate flags', async () => {
    const issue: ReconcileIssue = {
      number: 6,
      title: 'already flagged',
      body: issueBody('packages/cli/src/retro/pipeline.ts'),
      labels: ['retro'],
    };
    const tracker = new FakeTracker(
      [issue],
      new Map([
        [6, ledgerComment({ dogfood: { sha: 'abc1234', at: '2026-07-01T00:00:00.000Z' } })],
      ]),
      () => true,
    );

    await reconcile(tracker);
    const second = await reconcile(tracker);

    expect(second.flagged).toEqual([]);
    expect(tracker.comments.get(6)).toHaveLength(1);
    expect(tracker.labels.get(6)).toEqual([RECONCILE_LABEL]);
  });
});

describe('reconcile — unreconcilable issues are left untouched (SM2.R4-R5)', () => {
  const untouchedExpectations = (tracker: FakeTracker, issueNumber: number) => {
    expect(tracker.comments.get(issueNumber)).toBeUndefined();
    expect(tracker.labels.get(issueNumber)).toBeUndefined();
  };

  it('skips an issue without recorded provenance', async () => {
    const issue: ReconcileIssue = {
      number: 11,
      title: 'pre-provenance',
      body: issueBody('packages/cli/src/retro/pipeline.ts'),
      labels: ['retro'],
    };
    const tracker = new FakeTracker([issue], new Map([[11, ledgerComment({})]]), () => true);

    const result = await reconcile(tracker);

    expect(result.skipped).toEqual([11]);
    untouchedExpectations(tracker, 11);
  });

  it('skips a process-surfaced issue', async () => {
    const issue: ReconcileIssue = {
      number: 12,
      title: 'process friction',
      body: issueBody('process/tdd-loop'),
      labels: ['retro'],
    };
    const tracker = new FakeTracker(
      [issue],
      new Map([
        [12, ledgerComment({ dogfood: { sha: 'abc1234', at: '2026-07-01T00:00:00.000Z' } })],
      ]),
      () => true,
    );

    const result = await reconcile(tracker);

    expect(result.skipped).toEqual([12]);
    untouchedExpectations(tracker, 12);
  });

  it('skips a version whose release-tag date cannot be resolved', async () => {
    const issue: ReconcileIssue = {
      number: 13,
      title: 'dev-build version',
      body: issueBody('packages/cli/src/retro/pipeline.ts'),
      labels: ['retro'],
    };
    const tracker = new FakeTracker(
      [issue],
      new Map([
        [13, ledgerComment({ install: { version: '0.0.0-dev', at: '2026-07-01T00:00:00.000Z' } })],
      ]),
      () => true,
      new Map(),
    );

    const result = await reconcile(tracker);

    expect(result.skipped).toEqual([13]);
    untouchedExpectations(tracker, 13);
  });

  it('requests only open, retro-labeled issues from the tracker', async () => {
    const tracker = new FakeTracker([], new Map(), () => true);

    await reconcile(tracker);

    expect(tracker.listQueries).toEqual([{ state: 'open', labels: ['retro'] }]);
  });
});

describe('reconcile — per-issue failure isolation (SM2.R7)', () => {
  it('a failing surface-commits query isolates to its issue', async () => {
    const body = issueBody('packages/cli/src/retro/pipeline.ts');
    const ledgers = new Map([
      [21, ledgerComment({ dogfood: { sha: 'abc1234', at: '2026-07-01T00:00:00.000Z' } })],
      [22, ledgerComment({ dogfood: { sha: 'def5678', at: '2026-07-01T00:00:00.000Z' } })],
    ]);
    class FlakyTracker extends FakeTracker {
      private failFirst = true;

      override surfaceTouchedSince(path: string, sinceIso: string): Promise<boolean> {
        if (this.failFirst) {
          this.failFirst = false;
          return Promise.reject(new Error('502'));
        }
        return super.surfaceTouchedSince(path, sinceIso);
      }
    }
    const tracker = new FlakyTracker(
      [
        { number: 21, title: 'first', body, labels: ['retro'] },
        { number: 22, title: 'second', body, labels: ['retro'] },
      ],
      ledgers,
      () => true,
    );

    const result = await reconcile(tracker);

    expect(result.failed).toEqual([21]);
    expect(result.flagged).toEqual([22]);
    expect(tracker.comments.get(21)).toBeUndefined();
    expect(tracker.labels.get(22)).toEqual([RECONCILE_LABEL]);
  });
});

describe('reconcile — per-run operation bound (SM2.R6)', () => {
  it('flags at most the bound, each flag complete, remainder left for a later run', async () => {
    const body = issueBody('packages/cli/src/retro/pipeline.ts');
    const ledgers = new Map(
      [31, 32, 33].map(n => [
        n,
        ledgerComment({ dogfood: { sha: 'abc1234', at: '2026-07-01T00:00:00.000Z' } }),
      ]),
    );
    const tracker = new FakeTracker(
      [
        { number: 31, title: 'a', body, labels: ['retro'] },
        { number: 32, title: 'b', body, labels: ['retro'] },
        { number: 33, title: 'c', body, labels: ['retro'] },
      ],
      ledgers,
      () => true,
    );

    const result = await reconcile(tracker, { maxFlags: 2 });

    expect(result.flagged).toEqual([31, 32]);
    for (const flagged of result.flagged) {
      expect(tracker.comments.get(flagged)).toHaveLength(1);
      expect(tracker.labels.get(flagged)).toEqual([RECONCILE_LABEL]);
    }
    expect(tracker.comments.get(33)).toBeUndefined();
    expect(tracker.labels.get(33)).toBeUndefined();
  });
});

describe('reconcile — half-flag repair (quality review 2026-07-07)', () => {
  const body = issueBody('packages/cli/src/retro/pipeline.ts');
  const ledger = ledgerComment({ dogfood: { sha: 'abc1234', at: '2026-07-01T00:00:00.000Z' } });

  it('completes a marker-without-label half-flag by applying only the label', async () => {
    const tracker = new FakeTracker(
      [{ number: 51, title: 'half', body, labels: ['retro'] }],
      new Map([[51, ledger]]),
      () => false,
    );
    // A prior run posted the marker comment but died before the label.
    await tracker.createComment(51, '<!-- retro-reconcile -->\nhalf-applied');

    const result = await reconcile(tracker);

    expect(result.flagged).toEqual([51]);
    expect(tracker.labels.get(51)).toEqual([RECONCILE_LABEL]);
    // No second marker comment: the pre-seeded one plus zero new.
    const markers = (tracker.comments.get(51) ?? []).filter(c => c.includes(RECONCILE_MARKER));
    expect(markers).toHaveLength(1);
  });

  it('completes a label-without-marker half-flag by posting only the comment', async () => {
    const tracker = new FakeTracker(
      [{ number: 52, title: 'half', body, labels: ['retro', RECONCILE_LABEL] }],
      new Map([[52, ledger]]),
      () => false,
    );

    const result = await reconcile(tracker);

    expect(result.flagged).toEqual([52]);
    const markers = (tracker.comments.get(52) ?? []).filter(c => c.includes(RECONCILE_MARKER));
    expect(markers).toHaveLength(1);
    expect(tracker.labels.get(52)).toBeUndefined(); // no duplicate label add
  });

  it('skips a fully flagged issue (marker and label both present)', async () => {
    const tracker = new FakeTracker(
      [{ number: 53, title: 'done', body, labels: ['retro', RECONCILE_LABEL] }],
      new Map([[53, ledger]]),
      () => true,
    );
    await tracker.createComment(53, '<!-- retro-reconcile -->\nalready flagged');

    const result = await reconcile(tracker);

    expect(result.flagged).toEqual([]);
    expect(result.skipped).toEqual([53]);
  });
});
