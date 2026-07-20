// Which vendor reviews, and what independence the review may claim
// (ticket 36EEMY, Rule TB1.R11).
//
// Claude reviewing Claude shares a training lineage, an RLHF approach, and
// therefore its failure modes — the correlated blind spot the whole rule exists
// to break. A different VENDOR is the most decorrelated reviewer available.
//
// The second clause is the load-bearing one: a same-vendor review that BELIEVES
// it is cross-vendor launders correlated blind spots as independent
// verification, which is worse than a same-vendor review that admits it. So the
// claim is DERIVED from the pairing that actually ran — never asserted by the
// model about itself, and never assumed from policy.

/**
 * Deliberately declared here rather than imported from the retro hook's
 * `RetroAgent`: hooks ship into customer projects and cannot import the CLI, so
 * the dependency may only run the other way. The two are the same two values by
 * coincidence of scope, not by a shared contract.
 */
export type Vendor = 'claude' | 'codex';

const OPPOSITE: Record<Vendor, Vendor> = { claude: 'codex', codex: 'claude' };

/**
 * Pick the reviewing vendor: whichever one did not write the code.
 *
 * When the author cannot be identified we assume **Claude** and therefore review
 * with Codex. That is not a neutral guess — it fails TOWARD cross-vendor, which
 * is the safe direction while detection (X1Z5MG) is unbuilt. Guessing the other
 * way would silently produce same-vendor reviews that look independent.
 */
export function selectReviewVendor(author: Vendor | undefined): Vendor {
  return OPPOSITE[author ?? 'claude'];
}

/**
 * Whether this review may claim cross-vendor independence.
 *
 * Takes both ends and compares them, so a project configured to review with the
 * authoring vendor still declares `false`. The runner writes this onto the
 * review after the fact — a model asserting its own independence is exactly the
 * laundering R11 exists to stop.
 */
export function crossVendorClaim(author: Vendor, reviewer: Vendor): boolean {
  return author !== reviewer;
}
