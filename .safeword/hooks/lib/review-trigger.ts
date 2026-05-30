/**
 * Review-firing policy (ticket SXSCJQ). Pure decision logic shared by the
 * PostToolUse per-step/per-phase review and the Stop backstop.
 *
 * - selectMostAdvancedStep: among the R/G/R checkboxes that flipped in one edit,
 *   pick which step's review to surface. When several flip together (e.g. a
 *   MultiEdit checking RED+GREEN), the most-advanced step wins — its checklist
 *   is the relevant one once the implementation already exists.
 * - shouldReviewPhase / shouldReviewStep: enter-semantics dedup. A boundary is
 *   reviewed once; whichever trigger (PostToolUse or Stop) sees the un-reviewed
 *   boundary first fires it and records it, the other skips.
 */

import type { CheckboxTransition } from './checkbox-transitions.ts';

const STEP_RANK: Record<string, number> = { red: 0, green: 1, refactor: 2 };

export function selectMostAdvancedStep(transitions: CheckboxTransition[]): string | null {
  let best: string | null = null;
  let bestRank = -1;
  for (const transition of transitions) {
    const step = transition.step.toLowerCase();
    const rank = STEP_RANK[step];
    if (rank === undefined) continue;
    if (rank > bestRank) {
      bestRank = rank;
      best = step;
    }
  }
  return best;
}

export function shouldReviewPhase(
  currentPhase: string | undefined,
  lastReviewedPhase?: string,
): boolean {
  return currentPhase !== undefined && currentPhase !== lastReviewedPhase;
}

export function shouldReviewStep(currentStep: string | null, lastReviewedStep?: string): boolean {
  return currentStep !== null && currentStep !== lastReviewedStep;
}
