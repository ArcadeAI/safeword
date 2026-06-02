/**
 * Unit tests for the replan relevance filter (ticket 153, design B).
 * Pure function — no I/O. Relevance = changed paths that the ticket references
 * (exact or under a referenced directory), minus a high-churn manifest denylist.
 */

import { describe, expect, it } from 'vitest';

import {
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
