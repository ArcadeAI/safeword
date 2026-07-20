import { describe, expect, it } from 'vitest';

import { crossVendorClaim, selectReviewVendor, type Vendor } from '../../src/pr-review/vendor.js';

describe('autonomous-pr-review.TB1.R11 — the reviewer runs on a different vendor (36EEMY slice 6)', () => {
  it('autonomous-pr-review.TB1.R11.an_undetectable_author_defaults_to_reviewing_with_codex', () => {
    // Author detection is X1Z5MG and not built. The default assumes Claude,
    // which fails TOWARD cross-vendor — the safe direction when uncertain.
    expect(selectReviewVendor(undefined)).toBe('codex');
  });

  it('autonomous-pr-review.TB1.R11.an_author_from_the_reviewing_vendor_flips_the_reviewer', () => {
    expect(selectReviewVendor('codex')).toBe('claude');
    // ...and the ordinary direction still holds.
    expect(selectReviewVendor('claude')).toBe('codex');
  });

  const pairings = [
    { author: 'claude', reviewer: 'claude', claim: false },
    { author: 'claude', reviewer: 'codex', claim: true },
    { author: 'codex', reviewer: 'codex', claim: false },
    { author: 'codex', reviewer: 'claude', claim: true },
  ] as const;

  it.each(pairings)(
    'autonomous-pr-review.TB1.R11.the_cross_vendor_declaration_tracks_the_actual_pairing [$author authored, $reviewer reviewed]',
    ({ author, reviewer, claim }) => {
      // The load-bearing clause: a same-vendor review that BELIEVES it is
      // cross-vendor launders correlated blind spots as independent
      // verification, which is worse than a same-vendor review that admits it.
      expect(crossVendorClaim(author, reviewer)).toBe(claim);
    },
  );

  it('the claim is derived from the pairing, never asserted by the model', () => {
    // A configured same-vendor pairing must still declare false, even though
    // selectReviewVendor would never have chosen it. The claim describes what
    // actually happened, not what the policy intended.
    const configuredSameVendor: Vendor = 'claude';
    expect(crossVendorClaim('claude', configuredSameVendor)).toBe(false);
  });
});
