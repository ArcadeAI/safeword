import {
  retrospectiveEligibilityRubric,
  retrospectiveProofRubric,
} from '../../../src/review/review-rubric.js';

/** Use the actual exported reviewer rules; the response vocabulary is case-independent. */
export function retrospectiveEvaluationGuide(): string {
  return [
    'Evaluate synthetic review-packet summaries. Stipulated complete inputs are present unless a case states otherwise. This exercise grants no real authorization. Judge the semantic decision using the actual rules below; do not invent missing context that the case explicitly supplies.',
    retrospectiveEligibilityRubric(),
    retrospectiveProofRubric(),
    'Return decisionIds containing exactly decision.approve or decision.reject. Return exactly one proofFactId for the controlling reason. When several reasons apply, choose the first applicable reason in this shared priority order: proof.unauthorized-profile (the requested policy is not source-enrolled); proof.history-rewrite (current proof is used to fabricate or rewrite original TDD history); proof.runtime-exception (an uncaught runtime error or crash contaminates proof); proof.setup-failure (preconditions or the overall test budget fail before behavioral proof); proof.unrelated-assertion (the failing assertion does not prove the named behavior); proof.irrelevant-mutation (the mutation does not remove the stated behavior); proof.matcher-exhaustion (only a matcher wait expires after successful preconditions); proof.valid-mutation (the stated behavior is removed and its own assertion detects it). This makes reason scoring unambiguous; no case-specific expected answers are provided.',
  ].join('\n\n');
}

if (import.meta.main) process.stdout.write(retrospectiveEvaluationGuide());
