// Safeword: two-tier review-enforcement decision core (ticket NMSD94). Pure, no
// I/O. The PreToolUse / phase-advance gates wire these to the real
// skill-invocation-log, which stores one review stamp per asset/phase.
//
// `.js` specifier (bun resolves it to the .ts source) so tsc accepts this module
// when the test suite pulls it into the typecheck graph — the tested-lib rule.

import { isValidSkipReason } from './parse-annotation.js';

export interface ReviewStamp {
  /** The asset (or phase) the review covers. */
  assetId: string;
  /** Present → a skip (must be non-empty to satisfy the gate); absent → a real review. */
  skipReason?: string;
}

export type GateVerdict = { ok: true } | { ok: false; reason: string };

/** A stamp satisfies a gate when it's a real review, or a skip with a non-empty reason. */
function isSatisfyingStamp(stamp: ReviewStamp): boolean {
  return stamp.skipReason === undefined || isValidSkipReason(stamp.skipReason);
}

/**
 * Per-asset gate (DEV1.AC1): authoring the next asset is allowed only when the
 * prior asset carries a satisfying review stamp. The first asset (no prior) is
 * never gated.
 */
export function reviewGateForNextAsset(
  priorAssetId: string | undefined,
  stamps: readonly ReviewStamp[],
): GateVerdict {
  if (priorAssetId === undefined) return { ok: true };
  if (stamps.some(stamp => stamp.assetId === priorAssetId && isSatisfyingStamp(stamp))) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: `"${priorAssetId}" has not been reviewed — review it (or log a skip with a reason) before authoring the next asset`,
  };
}
