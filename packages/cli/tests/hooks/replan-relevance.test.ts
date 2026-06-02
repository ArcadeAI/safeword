/**
 * Unit tests for the replan relevance filter (ticket 153, design B).
 * Pure function — no I/O. Relevance = changed paths that the ticket references
 * (exact or under a referenced directory), minus a high-churn manifest denylist.
 */

import { describe, expect, it } from 'vitest';

import { relevantChangedPaths } from '../../templates/hooks/lib/replan-relevance.js';

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
