/**
 * Unit tests for the review-firing policy (ticket SXSCJQ). Pure decision logic
 * shared by the PostToolUse per-phase review and the Stop backstop:
 *
 *  - shouldReviewPhase — enter-semantics dedup across the two triggers
 *    (S2.1–2.2, S3.3).
 */

import { describe, expect, it } from 'vitest';

import { shouldReviewPhase } from '../../templates/hooks/lib/review-trigger.js';

describe('shouldReviewPhase — enter-semantics dedup (S2.1–2.2, S3.3)', () => {
  it('fires when the current phase differs from the last reviewed phase (S2.1)', () => {
    expect(shouldReviewPhase('scenario-gate', 'define-behavior')).toBe(true);
  });

  it('does not fire when the current phase was already reviewed (S2.2, S3.3)', () => {
    expect(shouldReviewPhase('verify', 'verify')).toBe(false);
  });

  it('fires on the first phase seen this session (no marker yet)', () => {
    expect(shouldReviewPhase('implement')).toBe(true);
  });

  it('does not fire on verify entry because verification should run automatically', () => {
    expect(shouldReviewPhase('verify', 'implement')).toBe(false);
    expect(shouldReviewPhase('verify')).toBe(false);
  });

  it('does not fire when there is no current phase', () => {
    expect(shouldReviewPhase(undefined, 'implement')).toBe(false);
  });
});
