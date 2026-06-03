/**
 * Unit tests for the two-tier review-enforcement decision core (ticket NMSD94).
 * Pure functions over the review-stamp ledger — no I/O. The PreToolUse / phase
 * gates wire these to the real skill-invocation-log.
 */

import { describe, expect, it } from 'vitest';

import {
  gatePhaseAdvance,
  isReviewGateEnabled,
  parseReviewStamps,
  reviewGateForNextAsset,
  type ReviewStamp,
} from '../../templates/hooks/lib/review-ledger.js';

describe('reviewGateForNextAsset (DEV1.AC1 — per-asset stamp gates the next asset)', () => {
  it('unstamped_prior_blocks_next: denies, naming the unreviewed prior asset', () => {
    const verdict = reviewGateForNextAsset('jtbd', []);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('jtbd');
  });

  it('stamped_prior_allows_next: a real review stamp for the prior asset allows', () => {
    const stamps: ReviewStamp[] = [{ assetId: 'jtbd' }];
    expect(reviewGateForNextAsset('jtbd', stamps)).toEqual({ ok: true });
  });

  it('skip_stamp_allows_next: a non-empty skip stamp for the prior asset allows', () => {
    const stamps: ReviewStamp[] = [{ assetId: 'jtbd', skipReason: 'trivial — boilerplate' }];
    expect(reviewGateForNextAsset('jtbd', stamps)).toEqual({ ok: true });
  });

  it('first_asset_not_gated: no prior asset (undefined) allows', () => {
    expect(reviewGateForNextAsset(undefined, [])).toEqual({ ok: true });
  });

  it('stamp_for_other_asset_does_not_allow: a stamp keyed to a different asset denies', () => {
    const stamps: ReviewStamp[] = [{ assetId: 'acs' }];
    expect(reviewGateForNextAsset('jtbd', stamps).ok).toBe(false);
  });

  it('empty_skip_reason_rejected (SM1.AC2): an empty skip reason does not satisfy the gate', () => {
    const stamps: ReviewStamp[] = [{ assetId: 'jtbd', skipReason: '   ' }];
    expect(reviewGateForNextAsset('jtbd', stamps).ok).toBe(false);
  });
});

describe('gatePhaseAdvance (DEV2.AC1 — phase advance needs an independent review stamp)', () => {
  it('no_phase_stamp_blocks_advance: no stamp for the phase denies, naming the phase', () => {
    const verdict = gatePhaseAdvance('define-behavior', []);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('define-behavior');
  });

  it('phase_stamp_allows_advance: a review stamp for the phase allows', () => {
    const stamps: ReviewStamp[] = [{ assetId: 'define-behavior' }];
    expect(gatePhaseAdvance('define-behavior', stamps)).toEqual({ ok: true });
  });

  it('phase_skip_allows_advance: a non-empty skip stamp for the phase allows', () => {
    const stamps: ReviewStamp[] = [{ assetId: 'define-behavior', skipReason: 'docs-only phase' }];
    expect(gatePhaseAdvance('define-behavior', stamps)).toEqual({ ok: true });
  });
});

describe('parseReviewStamps (read stamps from the skill-invocation-log)', () => {
  // Log lines are `<timestamp> <session> <entry>`; review entries are
  // `review:<artifactId>` or `review:<artifactId> skip:<reason>`.
  it('parses a real-review stamp', () => {
    const log = '2026-06-03T00:00:00Z sess-1 review:spec';
    expect(parseReviewStamps(log)).toEqual([{ assetId: 'spec' }]);
  });

  it('parses a skip stamp with its reason', () => {
    const log = '2026-06-03T00:00:00Z sess-1 review:scope skip:docs-only change';
    expect(parseReviewStamps(log)).toEqual([{ assetId: 'scope', skipReason: 'docs-only change' }]);
  });

  it('ignores non-review log lines (verify/audit invocations)', () => {
    const log = ['2026-06-03T00:00:00Z sess-1 verify', '2026-06-03T00:00:01Z sess-1 audit'].join(
      '\n',
    );
    expect(parseReviewStamps(log)).toEqual([]);
  });

  it('collects multiple stamps in order', () => {
    const log = [
      '2026-06-03T00:00:00Z sess-1 review:spec',
      '2026-06-03T00:00:01Z sess-1 review:scope',
    ].join('\n');
    expect(parseReviewStamps(log)).toEqual([{ assetId: 'spec' }, { assetId: 'scope' }]);
  });

  it('returns empty for empty input', () => {
    expect(parseReviewStamps('')).toEqual([]);
  });
});

describe('isReviewGateEnabled (default-off rollout guard)', () => {
  it('defaults to off when there is no config', () => {
    expect(isReviewGateEnabled()).toBe(false);
  });

  it('defaults to off when the flag is absent', () => {
    expect(isReviewGateEnabled('{}')).toBe(false);
  });

  it('is on only when reviewGate is explicitly true', () => {
    expect(isReviewGateEnabled('{"reviewGate": true}')).toBe(true);
  });

  it('is off when reviewGate is false', () => {
    expect(isReviewGateEnabled('{"reviewGate": false}')).toBe(false);
  });

  it('is off on malformed config (fail-safe)', () => {
    expect(isReviewGateEnabled('not json {')).toBe(false);
  });
});
