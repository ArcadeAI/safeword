import { extractRubricBlock } from './extract-rubric-block.js';

export const DELIVERY_COMPATIBILITY_RUBRIC_START =
  '<!-- SAFEWORD:DELIVERY_COMPATIBILITY_RUBRIC_START -->';
export const DELIVERY_COMPATIBILITY_RUBRIC_END =
  '<!-- SAFEWORD:DELIVERY_COMPATIBILITY_RUBRIC_END -->';

/** Extract the reviewer-safe compatibility block from Execution Planning. */
export function extractDeliveryCompatibilityReviewRubric(reference: string): string {
  return extractRubricBlock(
    reference,
    DELIVERY_COMPATIBILITY_RUBRIC_START,
    DELIVERY_COMPATIBILITY_RUBRIC_END,
    {
      missingPair: 'PLAN_EXECUTION.md must contain exactly one compatibility rubric marker pair',
      outOfOrder: 'PLAN_EXECUTION.md compatibility rubric markers are out of order',
      empty: 'PLAN_EXECUTION.md compatibility rubric is empty',
    },
  );
}
