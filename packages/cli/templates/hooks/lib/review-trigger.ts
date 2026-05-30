/**
 * Review-firing policy (ticket SXSCJQ). Pure decision logic shared by the
 * PostToolUse per-step/per-phase review and the Stop backstop.
 *
 * STUB — pending implementation (RED).
 */

import type { CheckboxTransition } from './checkbox-transitions.ts';

export function selectMostAdvancedStep(transitions: CheckboxTransition[]): string | null {
  void transitions;
  return null;
}

export function shouldReviewPhase(
  currentPhase: string | undefined,
  lastReviewedPhase: string | undefined,
): boolean {
  void currentPhase;
  void lastReviewedPhase;
  return false;
}

export function shouldReviewStep(
  currentStep: string | null,
  lastReviewedStep: string | undefined,
): boolean {
  void currentStep;
  void lastReviewedStep;
  return false;
}
