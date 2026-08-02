/**
 * Review-firing policy (ticket SXSCJQ). Pure decision logic shared by the
 * PostToolUse per-phase review and the Stop backstop.
 *
 * Phase reviews use enter-semantics dedup. A phase boundary is reviewed once;
 * whichever trigger sees the un-reviewed boundary first fires it and records it,
 * the other skips. `verify` is intentionally excluded: entering verify should
 * run /verify + /audit, not ask for pre-verification review evidence.
 */

export function shouldReviewPhase(
  currentPhase: string | undefined,
  lastReviewedPhase?: string,
): boolean {
  if (currentPhase === 'verify') return false;
  return currentPhase !== undefined && currentPhase !== lastReviewedPhase;
}
