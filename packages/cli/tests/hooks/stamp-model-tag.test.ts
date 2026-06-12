/**
 * Unit tests for the stamp model tag (ticket MR5M3A) — round-trip of the
 * orchestrator-recorded reviewer model through formatReviewStamp /
 * parseReviewStamps, with backward compatibility for pre-MR5M3A stamps.
 */

import { describe, expect, it } from 'vitest';

import { formatReviewStamp, parseReviewStamps } from '../../templates/hooks/lib/review-ledger.js';

describe('formatReviewStamp — model tag', () => {
  it('renders a model tag when given one', () => {
    expect(formatReviewStamp('T1:impl-plan@abc', undefined, 'claude-opus-4-8')).toBe(
      'review:T1:impl-plan@abc model:claude-opus-4-8',
    );
  });

  it('renders model before skip when both are present', () => {
    expect(formatReviewStamp('T1:impl-plan@abc', 'no reviewer available', 'claude-opus-4-8')).toBe(
      'review:T1:impl-plan@abc model:claude-opus-4-8 skip:no reviewer available',
    );
  });

  it('omits the model segment when no model is given (backward compatible)', () => {
    expect(formatReviewStamp('T1:spec@abc')).toBe('review:T1:spec@abc');
  });
});

describe('parseReviewStamps — model tag', () => {
  it('extracts the model from a stamped line', () => {
    const [stamp] = parseReviewStamps(
      '2026-06-12T00:00:00Z sess review:T1:impl-plan@abc model:claude-opus-4-8',
    );
    expect(stamp?.scope).toBe('T1:impl-plan@abc');
    expect(stamp?.model).toBe('claude-opus-4-8');
  });

  it('extracts model and skip together', () => {
    const [stamp] = parseReviewStamps(
      'ts sess review:T1:impl-plan@abc model:claude-opus-4-8 skip:why',
    );
    expect(stamp?.model).toBe('claude-opus-4-8');
    expect(stamp?.skipReason).toBe('why');
  });

  it('leaves model undefined on a pre-MR5M3A stamp (backward compatible)', () => {
    const [stamp] = parseReviewStamps('ts sess review:T1:spec@abc');
    expect(stamp?.scope).toBe('T1:spec@abc');
    expect(stamp?.model).toBeUndefined();
  });
});
