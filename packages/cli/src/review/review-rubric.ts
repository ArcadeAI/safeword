import type { ReviewKind } from './contract.js';
import { EXECUTION_PLAN_REVIEW_RUBRIC } from './execution-plan-rubric.generated.js';
import { PLAN_REVIEW_RUBRIC } from './plan-rubric.generated.js';
import { QUALITY_REVIEW_RUBRIC } from './quality-rubric.generated.js';
import { EXECUTABLE_RED_REVIEW_RUBRIC } from './red-rubric.generated.js';
import { SCENARIO_REVIEW_RUBRIC } from './scenario-rubric.generated.js';

const QUALITY_REVIEW_FOCUS =
  'Check correctness, regressions, edge cases, security and trust boundaries, unnecessary complexity, claims stronger than their proof, and whether public wiring is proven through real collaborators.';

function composeReviewRubric(specialistRubric: string): string {
  return `${QUALITY_REVIEW_RUBRIC}\n\n${specialistRubric}`;
}

/** Generated from the canonical skill so review never reads project-controlled instructions. */
export function scenarioReviewRubric(): string {
  return composeReviewRubric(SCENARIO_REVIEW_RUBRIC);
}

export function qualityReviewRubric(): string {
  return composeReviewRubric(QUALITY_REVIEW_FOCUS);
}

/** Generated from the canonical planning skill so author and reviewer cannot drift. */
export function planReviewRubric(): string {
  return composeReviewRubric(PLAN_REVIEW_RUBRIC);
}

export function executionPlanReviewRubric(): string {
  return composeReviewRubric(EXECUTION_PLAN_REVIEW_RUBRIC);
}

export function reviewRubric(kind: ReviewKind): string {
  if (kind === 'scenario-gate') return scenarioReviewRubric();
  if (kind === 'plan-implementation') return planReviewRubric();
  if (kind === 'plan-execution') return executionPlanReviewRubric();
  if (kind === 'executable-red') return composeReviewRubric(EXECUTABLE_RED_REVIEW_RUBRIC);
  return qualityReviewRubric();
}
