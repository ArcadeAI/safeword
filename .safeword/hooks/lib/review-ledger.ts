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

/** Whether the ledger holds a satisfying review stamp for `id` (an asset or a phase). */
function hasSatisfyingStamp(id: string, stamps: readonly ReviewStamp[]): boolean {
  return stamps.some(stamp => stamp.assetId === id && isSatisfyingStamp(stamp));
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
  if (hasSatisfyingStamp(priorAssetId, stamps)) return { ok: true };
  return {
    ok: false,
    reason: `"${priorAssetId}" has not been reviewed — review it (or log a skip with a reason) before authoring the next asset`,
  };
}

/**
 * Phase-exit gate (DEV2.AC1): advancing past a phase is allowed only when an
 * independent review stamp for that phase exists. Unlike the per-asset gate
 * there is no "first" exemption — every phase exit needs a stamp.
 */
export function gatePhaseAdvance(phase: string, stamps: readonly ReviewStamp[]): GateVerdict {
  if (hasSatisfyingStamp(phase, stamps)) return { ok: true };
  return {
    ok: false,
    reason: `phase "${phase}" has no independent review stamp — run the phase-exit review (or log a skip with a reason) before advancing`,
  };
}

/**
 * A review entry in the skill-invocation-log: `review:<artifactId>` for a real
 * review, or `review:<artifactId> skip:<reason>` for a logged skip. The line is
 * `<timestamp> <session> <entry>`, so the review token is matched at line end.
 */
const REVIEW_LINE = /(?:^|\s)review:(\S+)(?:\s+skip:(.+))?$/;

/**
 * Rollout guard: the review gate is OFF unless `.safeword/config.json` sets
 * `reviewGate: true`. Default-off so this self-applying blocking gate can ship
 * inert (no bricking the dogfood or customers) and be enabled deliberately once
 * the stamp-earning step is in place. Fail-safe to off on missing/malformed config.
 */
export function isReviewGateEnabled(rawConfig?: string): boolean {
  if (rawConfig === undefined) return false;
  try {
    const config: unknown = JSON.parse(rawConfig);
    return (
      typeof config === 'object' &&
      config !== null &&
      (config as Record<string, unknown>).reviewGate === true
    );
  } catch {
    return false;
  }
}

/** Read review stamps from skill-invocation-log content (non-review lines ignored). */
export function parseReviewStamps(logContent: string): ReviewStamp[] {
  const stamps: ReviewStamp[] = [];
  for (const line of logContent.split('\n')) {
    const match = REVIEW_LINE.exec(line);
    if (match?.[1] === undefined) continue;
    const skipReason = match[2];
    stamps.push(
      skipReason === undefined ? { assetId: match[1] } : { assetId: match[1], skipReason },
    );
  }
  return stamps;
}
