/**
 * Unit tests for the replan relevance filter (ticket 153, design B).
 * Pure function — no I/O. Relevance = changed paths that the ticket references
 * (exact or under a referenced directory), minus a high-churn manifest denylist.
 */

import { describe, expect, it } from 'vitest';

import {
  type BlockerTarget,
  decideReplan,
  detectMovedBlockers,
  extractReferencedPaths,
  formatBlockerMovedHeadsUp,
  formatReplanHeadsUp,
  parseGitLogNameOnly,
  relevantChangedPaths,
  shouldSurfaceReplan,
} from '../../templates/hooks/lib/replan-relevance.js';

describe('relevantChangedPaths', () => {
  it('keeps a changed path the ticket references exactly', () => {
    expect(
      relevantChangedPaths(['packages/cli/src/foo.ts'], ['packages/cli/src/foo.ts', 'README.md']),
    ).toEqual(['packages/cli/src/foo.ts']);
  });

  it('keeps a changed path under a referenced directory', () => {
    expect(relevantChangedPaths(['packages/cli/src/'], ['packages/cli/src/nested/bar.ts'])).toEqual(
      ['packages/cli/src/nested/bar.ts'],
    );
  });

  it('returns empty when no changed path is referenced', () => {
    expect(relevantChangedPaths(['packages/cli/src/foo.ts'], ['docs/bar.md'])).toEqual([]);
  });

  it('excludes high-churn denylisted manifests even if referenced and changed', () => {
    expect(relevantChangedPaths(['package.json'], ['package.json', 'bun.lock'])).toEqual([]);
  });

  it('returns empty when the ticket references no paths (no signal → silent)', () => {
    expect(relevantChangedPaths([], ['packages/cli/src/foo.ts'])).toEqual([]);
  });
});

describe('shouldSurfaceReplan', () => {
  const references = ['packages/cli/src/'];

  it('does not surface when there are no commits', () => {
    expect(shouldSurfaceReplan([], references)).toEqual({ surface: false, relevantCommitCount: 0 });
  });

  it('does not surface when no commit touches a referenced path', () => {
    const commits = [{ changedPaths: ['docs/a.md'] }, { changedPaths: ['README.md'] }];
    expect(shouldSurfaceReplan(commits, references)).toEqual({
      surface: false,
      relevantCommitCount: 0,
    });
  });

  it('surfaces and counts only the commits with a relevant changed path', () => {
    const commits = [
      { changedPaths: ['packages/cli/src/foo.ts'] },
      { changedPaths: ['docs/a.md'] },
      { changedPaths: ['packages/cli/src/bar.ts', 'README.md'] },
    ];
    expect(shouldSurfaceReplan(commits, references)).toEqual({
      surface: true,
      relevantCommitCount: 2,
    });
  });

  it('does not count a commit touching only denylisted manifests', () => {
    const commits = [{ changedPaths: ['package.json', 'bun.lock'] }];
    expect(shouldSurfaceReplan(commits, ['package.json'])).toEqual({
      surface: false,
      relevantCommitCount: 0,
    });
  });
});

describe('extractReferencedPaths', () => {
  it('extracts a path from a markdown link target', () => {
    expect(extractReferencedPaths('see [jtbd](packages/cli/src/foo.ts) here')).toEqual([
      'packages/cli/src/foo.ts',
    ]);
  });

  it('extracts a dotfile directory with a trailing slash', () => {
    expect(extractReferencedPaths('the `.safeword/hooks/` dir')).toEqual(['.safeword/hooks/']);
  });

  it('ignores URLs', () => {
    expect(extractReferencedPaths('visit https://example.com/page for docs')).toEqual([]);
  });

  it('dedupes repeated paths', () => {
    expect(extractReferencedPaths('packages/cli/a.ts and again packages/cli/a.ts')).toEqual([
      'packages/cli/a.ts',
    ]);
  });

  it('returns empty for prose with no paths', () => {
    expect(extractReferencedPaths('a sentence with no file paths at all')).toEqual([]);
  });
});

describe('parseGitLogNameOnly', () => {
  // Output of `git log --name-only --pretty=format:%x1f%H` — each commit block
  // is prefixed by a unit separator (0x1f); first line is the sha, rest are paths.
  const SEP = String.fromCodePoint(0x1f);

  it('parses a single commit into its changed paths (sha dropped)', () => {
    const raw = `${SEP}abc123\npackages/cli/src/foo.ts\nREADME.md`;
    expect(parseGitLogNameOnly(raw)).toEqual([
      { changedPaths: ['packages/cli/src/foo.ts', 'README.md'] },
    ]);
  });

  it('partitions changed paths across multiple commits', () => {
    const raw = `${SEP}abc\npackages/a.ts\n${SEP}def\npackages/b.ts\ndocs/c.md`;
    expect(parseGitLogNameOnly(raw)).toEqual([
      { changedPaths: ['packages/a.ts'] },
      { changedPaths: ['packages/b.ts', 'docs/c.md'] },
    ]);
  });

  it('returns an empty commit (no paths) for a commit that changed no files', () => {
    expect(parseGitLogNameOnly(`${SEP}abc123`)).toEqual([{ changedPaths: [] }]);
  });

  it('returns empty for empty git output', () => {
    expect(parseGitLogNameOnly('')).toEqual([]);
  });
});

describe('decideReplan', () => {
  const base = {
    headSha: 'head1',
    promptedHead: undefined as string | undefined,
    referencedPaths: ['packages/cli/src/'],
    commits: [{ changedPaths: ['packages/cli/src/foo.ts'] }],
  };

  it('never surfaces for an epic ticket', () => {
    expect(decideReplan({ ...base, ticketType: 'epic' })).toEqual({
      surface: false,
      relevantCommitCount: 0,
    });
  });

  it('does not re-fire when HEAD has not advanced past the prompted HEAD', () => {
    expect(decideReplan({ ...base, ticketType: 'task', promptedHead: 'head1' })).toEqual({
      surface: false,
      relevantCommitCount: 0,
    });
  });

  it('re-fires when a new relevant commit has advanced HEAD past the prompted HEAD', () => {
    expect(
      decideReplan({ ...base, ticketType: 'task', headSha: 'head2', promptedHead: 'head1' }),
    ).toEqual({ surface: true, relevantCommitCount: 1 });
  });

  it('surfaces on first sight of a relevant commit (no prompted HEAD yet)', () => {
    expect(decideReplan({ ...base, ticketType: 'task' })).toEqual({
      surface: true,
      relevantCommitCount: 1,
    });
  });
});

describe('formatReplanHeadsUp', () => {
  it('names the count and offers a one-step opt-in', () => {
    const line = formatReplanHeadsUp(3);
    expect(line).toContain('3 commits');
    expect(line.toLowerCase()).toContain('check the plan');
  });

  it('uses the singular noun for a single commit', () => {
    expect(formatReplanHeadsUp(1)).toContain('1 commit ');
  });

  it('offers /figure-it-out to re-decide the approach when scope may be stale (97BZ9S)', () => {
    expect(formatReplanHeadsUp(3)).toContain('/figure-it-out');
  });
});

describe('detectMovedBlockers (E11N48)', () => {
  const target = (over: Partial<BlockerTarget> = {}): BlockerTarget => ({
    id: 'AKZJXC',
    slug: 'ticket-relations',
    status: 'done',
    ticketPath: '.safeword-project/tickets/AKZJXC-ticket-relations/ticket.md',
    ...over,
  });
  const commitTouching = (path: string) => ({ changedPaths: [path, 'README.md'] });

  it('fires when a terminal blocker ticket.md is in the window', () => {
    expect(detectMovedBlockers([target()], [commitTouching(target().ticketPath)])).toEqual([
      { id: 'AKZJXC', slug: 'ticket-relations', status: 'done' },
    ]);
  });

  it('treats superseded / cancelled / wontfix as terminal', () => {
    for (const status of ['superseded', 'cancelled', 'wontfix']) {
      expect(
        detectMovedBlockers([target({ status })], [commitTouching(target().ticketPath)]),
      ).toHaveLength(1);
    }
  });

  it('stays silent when the blocker is not terminal', () => {
    expect(
      detectMovedBlockers(
        [target({ status: 'in_progress' })],
        [commitTouching(target().ticketPath)],
      ),
    ).toEqual([]);
  });

  it('stays silent when the terminal blocker ticket.md is not in the window', () => {
    expect(detectMovedBlockers([target()], [commitTouching('packages/cli/src/other.ts')])).toEqual(
      [],
    );
  });

  it('returns only the moved targets from a mix', () => {
    const moved = target({
      id: 'AAA111',
      slug: 'done-dep',
      ticketPath: '.safeword-project/tickets/AAA111-done-dep/ticket.md',
    });
    const notMoved = target({
      id: 'BBB222',
      slug: 'active-dep',
      status: 'open',
      ticketPath: '.safeword-project/tickets/BBB222-active-dep/ticket.md',
    });
    expect(detectMovedBlockers([moved, notMoved], [commitTouching(moved.ticketPath)])).toEqual([
      { id: 'AAA111', slug: 'done-dep', status: 'done' },
    ]);
  });
});

describe('formatBlockerMovedHeadsUp (E11N48)', () => {
  it('names a single blocker slug-first with the check-the-plan opt-in', () => {
    const line = formatBlockerMovedHeadsUp([
      { id: 'AKZJXC', slug: 'ticket-relations', status: 'done' },
    ]);
    expect(line).toContain('ticket-relations (AKZJXC)');
    expect(line.toLowerCase()).toContain('check the plan');
    expect(line).toContain('A blocker');
  });

  it('uses plural phrasing for multiple blockers', () => {
    const line = formatBlockerMovedHeadsUp([
      { id: 'AKZJXC', slug: 'ticket-relations', status: 'done' },
      { id: 'AAA111', slug: 'done-dep', status: 'superseded' },
    ]);
    expect(line).toContain('Blockers');
    expect(line).toContain('ticket-relations (AKZJXC)');
    expect(line).toContain('done-dep (AAA111)');
  });

  it('offers /figure-it-out to re-decide the approach when scope may be stale (97BZ9S)', () => {
    const line = formatBlockerMovedHeadsUp([
      { id: 'AKZJXC', slug: 'ticket-relations', status: 'done' },
    ]);
    expect(line).toContain('/figure-it-out');
  });
});
