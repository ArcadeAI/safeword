export interface EvaluationRubric {
  readonly expectedDecisionIds: readonly string[];
  readonly forbiddenDecisionIds: readonly string[];
  readonly expectedProofFactIds: readonly string[];
  readonly forbiddenProofFactIds: readonly string[];
}

export interface EvaluationResponse {
  readonly decisionIds: readonly string[];
  readonly proofFactIds: readonly string[];
}

export interface AblationRecord {
  readonly guideSha256: string;
  readonly caseRubricSha256: string;
  readonly modelVersion: string;
  readonly decodingConfiguration: Readonly<Record<string, string | number | boolean>>;
  readonly responseFormat: string;
  readonly rubricLoader: string;
  readonly response: EvaluationResponse;
}

export interface AblationPairInput {
  readonly canonicalGuide: string;
  readonly storedAblatedGuide: string;
  readonly preservedDecisionIds: readonly string[];
  readonly rubric: EvaluationRubric;
  readonly fullGuideRecord: AblationRecord;
  readonly ablatedGuideRecord: AblationRecord;
}

export interface VerificationResult {
  readonly accepted: boolean;
  readonly diagnostics: readonly string[];
}

export function verifyAblationPair(_input: AblationPairInput): VerificationResult {
  throw new Error('Guide-ablation verification is not implemented.');
}
