import { describe, expect, it } from 'vitest';

import { compareReviewerCapability } from '../../src/review/capability-catalogue.js';

const current = {
  corpus_digest: 'corpus-1',
  rubric_digest: 'rubric-1',
  settings_digest: 'settings-1',
};

const qualified = {
  author_provider: 'vendor-a',
  reviewer_provider: 'vendor-b',
  author_model: 'vendor-a/author-1',
  reviewer_model: 'vendor-b/reviewer-2',
  direction: 'not_weaker' as const,
  qualification: 'pinned-corpus' as const,
  evidence_date: '2026-09-28',
  results_digest: 'results-1',
  ...current,
};

function compare(
  authorModel: string,
  reviewerModel: string,
  records: Parameters<typeof compareReviewerCapability>[3],
) {
  return compareReviewerCapability(
    { provider: authorModel.split('/', 1)[0] ?? '', model: authorModel },
    { provider: reviewerModel.split('/', 1)[0] ?? '', model: reviewerModel },
    current,
    records,
  );
}

describe('reviewer capability comparison', () => {
  it('binds both providers as well as their exact model IDs', () => {
    const author = { provider: 'vendor-a', model: 'vendor-a/author-1' };
    const reviewer = { provider: 'vendor-b', model: 'vendor-b/reviewer-2' };
    expect(compareReviewerCapability(author, reviewer, current, [qualified])).toBe('not_weaker');
    expect(
      compareReviewerCapability({ ...author, provider: 'vendor-c' }, reviewer, current, [
        qualified,
      ]),
    ).toBe('unknown');
    expect(
      compareReviewerCapability(author, { ...reviewer, provider: 'vendor-c' }, current, [
        qualified,
      ]),
    ).toBe('unknown');
  });
  it('admits only a qualified current exact ordered pair', () => {
    expect(compare('vendor-a/author-1', 'vendor-b/reviewer-2', [qualified])).toBe('not_weaker');
    expect(compare('vendor-b/reviewer-2', 'vendor-a/author-1', [qualified])).toBe('unknown');
    expect(compare('vendor-a/author-1', 'vendor-b/reviewer-3', [qualified])).toBe('unknown');
  });

  it('does not inherit stale or unqualified evidence', () => {
    expect(
      compare('vendor-a/author-1', 'vendor-b/reviewer-2', [
        { ...qualified, corpus_digest: 'old-corpus' },
      ]),
    ).toBe('unknown');
    expect(
      compare('vendor-a/author-1', 'vendor-b/reviewer-2', [
        { ...qualified, qualification: 'unqualified' },
      ]),
    ).toBe('unknown');
  });

  it('preserves a qualified weaker result and rejects conflicting records', () => {
    expect(
      compare('vendor-a/author-1', 'vendor-b/reviewer-2', [{ ...qualified, direction: 'weaker' }]),
    ).toBe('weaker');
    expect(
      compare('vendor-a/author-1', 'vendor-b/reviewer-2', [
        qualified,
        { ...qualified, direction: 'weaker' },
      ]),
    ).toBe('unknown');
  });

  it('never uses within-provider ordering as cross-provider evidence', () => {
    expect(
      compare('vendor-a/author-1', 'vendor-b/reviewer-2', [
        { ...qualified, qualification: 'provider-order' },
      ]),
    ).toBe('unknown');
    expect(
      compare('vendor-a/author-1', 'vendor-a/reviewer-2', [
        {
          ...qualified,
          reviewer_provider: 'vendor-a',
          reviewer_model: 'vendor-a/reviewer-2',
          qualification: 'provider-order',
        },
      ]),
    ).toBe('not_weaker');
  });
});
