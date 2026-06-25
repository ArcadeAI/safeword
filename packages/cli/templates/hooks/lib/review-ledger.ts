// Safeword: two-tier review-enforcement decision core (ticket NMSD94). Pure, no
// I/O. The PreToolUse / phase-advance gates wire these to the real
// skill-invocation-log, which stores one review stamp per asset/phase.
//
// `.js` specifier (bun resolves it to the .ts source) so tsc accepts this module
// when the test suite pulls it into the typecheck graph — the tested-lib rule.

import { createHash } from 'node:crypto';

import { isValidSkipReason } from './parse-annotation.js';

export interface ReviewStamp {
  /**
   * The review's scope key — see {@link reviewScope}. Ticket-qualified and
   * content-bound (`<ticket>:<artifact>@<hash>`), so a stamp matches the gate
   * only for THIS ticket's artifact at THIS content (no cross-ticket or
   * stale-after-edit false-allows).
   */
  scope: string;
  /** Present → a skip (must be non-empty to satisfy the gate); absent → a real review. */
  skipReason?: string;
  /** The reviewing model, recorded by the orchestrator that assigned it (ticket MR5M3A). Absent on pre-MR5M3A stamps. */
  model?: string;
}

/** Short content hash binding a stamp to the reviewed artifact's exact state. */
export function hashArtifact(content: string): string {
  return createHash('sha1').update(content).digest('hex').slice(0, 12);
}

/**
 * Canonical review-stamp scope: `<ticketId>:<artifact>@<contentHash>`. Both the
 * gate and the stamp-earning step build keys this way so a review satisfies the
 * gate only for the same ticket + artifact + content — a review of another
 * ticket's spec, or of a now-edited spec, no longer matches.
 */
export function reviewScope(ticketId: string, artifact: string, contentHash: string): string {
  return `${ticketId}:${artifact}@${contentHash}`;
}

export type GateVerdict = { ok: true } | { ok: false; reason: string };

/** A stamp satisfies a gate when it's a real review, or a skip with a non-empty reason. */
function isSatisfyingStamp(stamp: ReviewStamp): boolean {
  return stamp.skipReason === undefined || isValidSkipReason(stamp.skipReason);
}

/** Whether the ledger holds a satisfying review stamp for `id` (an asset or a phase). */
function hasSatisfyingStamp(id: string, stamps: readonly ReviewStamp[]): boolean {
  return stamps.some(stamp => stamp.scope === id && isSatisfyingStamp(stamp));
}

/**
 * Per-asset gate (DEV1.AC1): authoring the next asset is allowed only when the
 * prior asset carries a satisfying review stamp. The first asset (no prior) is
 * never gated.
 */
export function reviewGateForNextAsset(
  priorScope: string | undefined,
  stamps: readonly ReviewStamp[],
): GateVerdict {
  if (priorScope === undefined) return { ok: true };
  if (hasSatisfyingStamp(priorScope, stamps)) return { ok: true };
  return {
    ok: false,
    reason: `"${priorScope}" has not been reviewed — review it (or log a skip with a reason) before authoring the next asset`,
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

// A review entry in the skill-invocation-log. Format contract (the
// stamp-earning step writes exactly this): `review:<scope>` for a real review,
// or `review:<scope> skip:<reason>` for a logged skip, where <scope> is a
// space-free reviewScope() key. The line is `<timestamp> <session> <entry>`, so
// the review token is matched at line end.
//
// Trust boundary: a stamp is only as trustworthy as the log file's integrity —
// a crafted `review:<scope>` line satisfies this gate. That's by design: Tier 1
// is the cheap, gameable floor; the ungameable check is Tier 2 (independent
// fork review). The content-hash binding in <scope> at least defeats accidental
// stale-after-edit passes, not deliberate spoofing.
const REVIEW_LINE = /(?:^|\s)review:(\S+)(?:\s+model:(\S+))?(?:\s+skip:(.+))?$/;

/**
 * Rollout guard: the review gate is OFF unless `.safeword/config.json` sets
 * `reviewGate: true`. Default-off so this self-applying blocking gate can ship
 * inert (no bricking the dogfood or customers) and be enabled deliberately once
 * the stamp-earning step is in place. Fail-safe to off on missing/malformed config.
 */
export function isReviewGateEnabled(rawConfig?: string): boolean {
  return configFlagIsTrue(rawConfig, 'reviewGate');
}

/**
 * Rollout guard for the eng-review-on-green-PRs merge gate (ticket Y9WX8R): OFF
 * unless `.safeword/config.json` sets `prReviewGate: true`. Same default-off,
 * fail-safe-to-off-on-malformed posture as {@link isReviewGateEnabled} — ships
 * inert so teams adopt PR-merge enforcement on their own timeline.
 */
export function isPrReviewGateEnabled(rawConfig?: string): boolean {
  return configFlagIsTrue(rawConfig, 'prReviewGate');
}

const PHASE_FIELD = /^phase:\s*(\S+)/m;

/**
 * Rollout guard for the architecture review gate (ticket MR5M3A): OFF unless
 * `.safeword/config.json` sets `architectureReviewGate: true`. Same default-off,
 * fail-safe-to-off-on-malformed posture as {@link isReviewGateEnabled}.
 */
export function isArchitectureReviewGateEnabled(rawConfig?: string): boolean {
  return configFlagIsTrue(rawConfig, 'architectureReviewGate');
}

/**
 * Whether the architecture review must be performed by a different model than
 * the author (ticket MR5M3A): true only when `.safeword/config.json` sets
 * `crossModelReview: true`. Default-off — same-model fork is the floor.
 */
export function isCrossModelReviewRequired(rawConfig?: string): boolean {
  return configFlagIsTrue(rawConfig, 'crossModelReview');
}

/**
 * Env var carrying the author/main-session model id, captured at SessionStart
 * (`session-author-model.ts`) and read by the cross-model gate in stop-quality.ts
 * (ticket MR5M3A). Shared so the writer and reader cannot drift.
 */
export const AUTHOR_MODEL_ENV = 'SAFEWORD_AUTHOR_MODEL';

/**
 * Whether a reviewer-model tag denotes the SAME model as the author-model tag
 * (ticket MR5M3A) — the cross-model gate blocks when this is true. Comparison
 * is trimmed and case-insensitive. An absent or empty tag on either side is
 * indeterminate: it cannot establish independence, so it counts as a match and
 * the gate fails closed (blocks) rather than waving the review through.
 */
export function modelsMatch(reviewerTag?: string, authorTag?: string): boolean {
  const reviewer = reviewerTag?.trim().toLowerCase() ?? '';
  const author = authorTag?.trim().toLowerCase() ?? '';
  if (reviewer === '' || author === '') return true;
  return reviewer === author;
}

/**
 * Whether a top-level config key is strictly `true`. Shared default-off,
 * fail-safe-on-malformed reader for the boolean rollout flags.
 */
function configFlagIsTrue(rawConfig: string | undefined, key: string): boolean {
  if (rawConfig === undefined) return false;
  try {
    const config: unknown = JSON.parse(rawConfig);
    return (
      typeof config === 'object' &&
      config !== null &&
      (config as Record<string, unknown>)[key] === true
    );
  } catch {
    return false;
  }
}

/**
 * The phase being EXITED by a ticket.md edit (Tier 2): the old phase, when the
 * edit changes `phase:` to a different value. Returns undefined when the phase
 * is unchanged or absent on either side (nothing to gate). Forward/backward
 * ordering isn't distinguished — leaving any phase requires its exit review.
 */
export function detectPhaseAdvance(oldContent: string, newContent: string): string | undefined {
  const from = PHASE_FIELD.exec(oldContent)?.[1];
  const to = PHASE_FIELD.exec(newContent)?.[1];
  if (from === undefined || to === undefined || from === to) return undefined;
  return from;
}

/**
 * Render a stamp token for the skill-invocation-log — the inverse of
 * {@link parseReviewStamps}. The stamp-earning step (`write-review-stamp.ts`)
 * prefixes `<timestamp> <session> ` and appends the result, so the gate reads
 * back exactly this `scope`. A non-empty `skipReason` records a logged skip.
 */
export function formatReviewStamp(scope: string, skipReason?: string, model?: string): string {
  const modelSegment = model === undefined ? '' : ` model:${model}`;
  const skipSegment = skipReason === undefined ? '' : ` skip:${skipReason}`;
  return `review:${scope}${modelSegment}${skipSegment}`;
}

/** Read review stamps from skill-invocation-log content (non-review lines ignored). */
export function parseReviewStamps(logContent: string): ReviewStamp[] {
  const stamps: ReviewStamp[] = [];
  for (const line of logContent.split('\n')) {
    const match = REVIEW_LINE.exec(line);
    if (match?.[1] === undefined) continue;
    const model = match[2];
    const skipReason = match[3];
    const stamp: ReviewStamp = { scope: match[1] };
    if (model !== undefined) stamp.model = model;
    if (skipReason !== undefined) stamp.skipReason = skipReason;
    stamps.push(stamp);
  }
  return stamps;
}
