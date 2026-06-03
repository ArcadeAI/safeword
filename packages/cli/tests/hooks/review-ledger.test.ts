/**
 * Unit tests for the two-tier review-enforcement decision core (ticket NMSD94).
 * Pure functions over the review-stamp ledger — no I/O. The PreToolUse / phase
 * gates wire these to the real skill-invocation-log.
 */

import { describe, expect, it } from 'vitest';

import {
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
