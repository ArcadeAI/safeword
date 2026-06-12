/**
 * Unit tests for the architecture-review config flags (ticket MR5M3A) — the
 * default-off rollout guard. Mirrors isReviewGateEnabled's posture: on only
 * when explicitly set true, fail-safe to off on absent/malformed config.
 * Proves test-definitions Rule "Default-off" at the flag level.
 */

import { describe, expect, it } from 'vitest';

import {
  isArchitectureReviewGateEnabled,
  isCrossModelReviewRequired,
} from '../../templates/hooks/lib/review-ledger.js';

describe('isArchitectureReviewGateEnabled — default-off rollout guard', () => {
  it('is on when architectureReviewGate is explicitly true', () => {
    expect(isArchitectureReviewGateEnabled('{"architectureReviewGate": true}')).toBe(true);
  });

  it('is off when explicitly disabled (gate_disabled)', () => {
    expect(isArchitectureReviewGateEnabled('{"architectureReviewGate": false}')).toBe(false);
  });

  it('is off when the key is absent (gate_config_absent_treated_as_disabled)', () => {
    expect(isArchitectureReviewGateEnabled('{"installedPacks": ["typescript"]}')).toBe(false);
  });

  it('is off when config is undefined', () => {
    expect(isArchitectureReviewGateEnabled()).toBe(false);
  });

  it('is off when config is malformed JSON (gate_config_malformed_treated_as_disabled)', () => {
    expect(isArchitectureReviewGateEnabled('{not valid json')).toBe(false);
  });

  it('is off when the value is a truthy non-boolean (strict === true)', () => {
    expect(isArchitectureReviewGateEnabled('{"architectureReviewGate": "true"}')).toBe(false);
  });
});

describe('isCrossModelReviewRequired — opt-in ceiling-raiser', () => {
  it('is required only when crossModelReview is explicitly true', () => {
    expect(isCrossModelReviewRequired('{"crossModelReview": true}')).toBe(true);
  });

  it('is off when the key is absent (same-model fork is the floor)', () => {
    expect(isCrossModelReviewRequired('{"architectureReviewGate": true}')).toBe(false);
  });

  it('is off when config is malformed JSON', () => {
    expect(isCrossModelReviewRequired('{not valid json')).toBe(false);
  });
});
