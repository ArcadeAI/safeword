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

describe('reviewer capability comparison', () => {
  it('admits only a qualified current exact ordered pair', () => {
    expect(
      compareReviewerCapability('vendor-a/author-1', 'vendor-b/reviewer-2', current, [qualified]),
    ).toBe('not_weaker');
    expect(
      compareReviewerCapability('vendor-b/reviewer-2', 'vendor-a/author-1', current, [qualified]),
    ).toBe('unknown');
    expect(
      compareReviewerCapability('vendor-a/author-1', 'vendor-b/reviewer-3', current, [qualified]),
    ).toBe('unknown');
  });

  it('does not inherit stale or unqualified evidence', () => {
    expect(
      compareReviewerCapability('vendor-a/author-1', 'vendor-b/reviewer-2', current, [
        { ...qualified, corpus_digest: 'old-corpus' },
      ]),
    ).toBe('unknown');
    expect(
      compareReviewerCapability('vendor-a/author-1', 'vendor-b/reviewer-2', current, [
        { ...qualified, qualification: 'unqualified' },
      ]),
    ).toBe('unknown');
  });

  it('preserves a qualified weaker result and rejects conflicting records', () => {
    expect(
      compareReviewerCapability('vendor-a/author-1', 'vendor-b/reviewer-2', current, [
        { ...qualified, direction: 'weaker' },
      ]),
    ).toBe('weaker');
    expect(
      compareReviewerCapability('vendor-a/author-1', 'vendor-b/reviewer-2', current, [
        qualified,
        { ...qualified, direction: 'weaker' },
      ]),
    ).toBe('unknown');
  });

  it('never uses within-provider ordering as cross-provider evidence', () => {
    expect(
      compareReviewerCapability('vendor-a/author-1', 'vendor-b/reviewer-2', current, [
        { ...qualified, qualification: 'provider-order' },
      ]),
    ).toBe('unknown');
    expect(
      compareReviewerCapability('vendor-a/author-1', 'vendor-a/reviewer-2', current, [
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
