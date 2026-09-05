// Safeword: the review-receipt decision core (ticket PB1GMZ). Pure, no I/O —
// write-review-stamp.ts collects the receipt by asking the CLI about the review
// and calls this to decide whether the stamp may be written.
//
// A stamp is a claim. `independence: cross-agent` claims a second agent
// reviewed this work; the agent making that claim is the one the review exists
// to check, so the claim needs a witness the agent did not write. The
// coordinator already keeps one: an integrity-signed job record whose status
// command revalidates the reviewed sources and reports `stale` when they moved.
// This core requires that witness for stamps that claim a coordinator verdict,
// and stays out of the way of stamps that claim nothing (self-review, skips).
//
// `.js` specifier (bun resolves it to the .ts source) so tsc accepts this module
// when the test suite pulls it into the typecheck graph — the tested-lib rule.

import type { GateVerdict } from './review-ledger.js';

/** What a stamp asserts, from the flags write-review-stamp.ts was given. */
export interface StampClaim {
  /** Present when the stamp reports a coordinator-assessed independence level. */
  readonly independence?: string;
  /** A deliberate, logged skip asserts no review happened at all. */
  readonly skip?: boolean;
  /** Artifact stamps name the reviewed file (`impl-plan` → `impl-plan.md`). */
  readonly artifact?: string;
  /** Phase stamps name the exited phase, which matches the review kind. */
  readonly phase?: string;
  /**
   * The ticket the stamp is being written for. Every stamp is ticket-scoped, so
   * the cited review has to have covered THIS ticket: without it, a fresh
   * approval for ticket A witnesses the same artifact name or phase on ticket B.
   */
  readonly ticketFolder: string;
  /** Author runtime the stamp reports, when it reports one. */
  readonly authorAgent?: string;
  /** Actual reviewer runtime the stamp reports, when it reports one. */
  readonly reviewerAgent?: string;
}

/** The fields `review status <id> --json` reports about a review. */
export interface ReviewReceipt {
  readonly reviewId?: string;
  readonly status?: string;
  readonly kind?: string;
  readonly targets?: readonly string[];
  readonly independence?: string;
  readonly authorAgent?: string;
  readonly actualReviewer?: string;
}

/** Levels that assert a coordinator ran and returned a verdict. */
const COORDINATOR_CLAIMS = new Set(['cross-agent', 'degraded']);

/** Whether a reviewed path sits inside the ticket being stamped. */
function withinTicket(target: string, ticketFolder: string): boolean {
  return target.split('/').includes(ticketFolder);
}

function coversArtifact(
  targets: readonly string[],
  ticketFolder: string,
  artifact: string,
): boolean {
  return targets.some(
    target => withinTicket(target, ticketFolder) && target.split('/').at(-1) === `${artifact}.md`,
  );
}

/**
 * Whether a stamp may be written. Rejections name what to do next, because the
 * agent reading them is mid-workflow and the alternative to a clear instruction
 * is a plausible-looking workaround.
 */
export function receiptGateVerdict(claim: StampClaim, receipt?: ReviewReceipt): GateVerdict {
  if (claim.skip === true) return { ok: true };
  if (claim.independence === undefined || !COORDINATOR_CLAIMS.has(claim.independence))
    return { ok: true };

  if (receipt?.reviewId === undefined)
    return {
      ok: false,
      reason:
        `a stamp claiming "independence: ${claim.independence}" must cite the review that produced it — ` +
        'pass --review-id <review_id from the coordinator result>',
    };

  if (receipt.status !== 'approved')
    return {
      ok: false,
      reason:
        receipt.status === 'stale'
          ? `review ${receipt.reviewId} is stale — its sources changed after the review; rerun it against the current sources`
          : `review ${receipt.reviewId} did not approve (status: ${receipt.status ?? 'unknown'})`,
    };

  // A stamp reports the coordinator's provenance verdict; the receipt is where
  // that verdict actually lives. Compared here, a degraded same-agent review
  // cannot be written up as cross-agent. Absent fields fail closed: an
  // unwitnessed claim is exactly what this gate exists to refuse.
  if (receipt.independence !== claim.independence)
    return {
      ok: false,
      reason: `review ${receipt.reviewId} recorded "independence: ${receipt.independence ?? 'none recorded'}", not the "${claim.independence}" the stamp claims`,
    };

  const provenance = [
    ['author', claim.authorAgent, receipt.authorAgent],
    ['reviewer', claim.reviewerAgent, receipt.actualReviewer],
  ] as const;
  for (const [field, claimed, recorded] of provenance) {
    if (claimed !== undefined && recorded !== claimed)
      return {
        ok: false,
        reason: `review ${receipt.reviewId} recorded "${field}: ${recorded ?? 'none recorded'}", not the "${claimed}" the stamp claims`,
      };
  }

  const targets = receipt.targets ?? [];

  if (claim.phase !== undefined) {
    if (receipt.kind !== claim.phase)
      return {
        ok: false,
        reason: `review ${receipt.reviewId} is a "${receipt.kind ?? 'unknown'}" review, not the "${claim.phase}" exit being stamped`,
      };
    if (!targets.some(target => withinTicket(target, claim.ticketFolder)))
      return {
        ok: false,
        reason: `review ${receipt.reviewId} reviewed nothing in ${claim.ticketFolder} — it covered ${targets.join(', ') || 'nothing'}`,
      };
  }

  if (claim.artifact !== undefined && !coversArtifact(targets, claim.ticketFolder, claim.artifact))
    return {
      ok: false,
      reason: `review ${receipt.reviewId} did not review ${claim.ticketFolder}/${claim.artifact}.md — it covered ${targets.join(', ') || 'nothing'}`,
    };

  return { ok: true };
}
