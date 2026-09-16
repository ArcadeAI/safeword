import { createHash } from 'node:crypto';

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
  readonly ablationId: string;
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

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function sameSet(actual: readonly string[], expected: readonly string[]): boolean {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return (
    actualSet.size === expectedSet.size && [...actualSet].every(value => expectedSet.has(value))
  );
}

function responsePasses(response: EvaluationResponse, rubric: EvaluationRubric): boolean {
  return (
    sameSet(response.decisionIds, rubric.expectedDecisionIds) &&
    sameSet(response.proofFactIds, rubric.expectedProofFactIds) &&
    rubric.forbiddenDecisionIds.every(id => !response.decisionIds.includes(id)) &&
    rubric.forbiddenProofFactIds.every(id => !response.proofFactIds.includes(id))
  );
}

function deriveNamedAblation(canonicalGuide: string, ablationId: string): string | undefined {
  const start = `<!-- data-architecture-ablation:${ablationId}:start -->`;
  const end = `<!-- data-architecture-ablation:${ablationId}:end -->`;
  const startIndex = canonicalGuide.indexOf(start);
  const endIndex = canonicalGuide.indexOf(end);
  if (
    startIndex === -1 ||
    endIndex < startIndex + start.length ||
    startIndex !== canonicalGuide.lastIndexOf(start) ||
    endIndex !== canonicalGuide.lastIndexOf(end)
  )
    return undefined;
  return `${canonicalGuide.slice(0, startIndex + start.length)}\n${canonicalGuide.slice(endIndex)}`;
}

function sameConfig(left: AblationRecord, right: AblationRecord): boolean {
  return (
    left.modelVersion === right.modelVersion &&
    JSON.stringify(left.decodingConfiguration) === JSON.stringify(right.decodingConfiguration) &&
    left.responseFormat === right.responseFormat &&
    left.rubricLoader === right.rubricLoader
  );
}

function ablationDiagnostics(input: AblationPairInput): string[] {
  const derivedAblation = deriveNamedAblation(input.canonicalGuide, input.ablationId);
  if (derivedAblation === undefined) {
    return [`Canonical guide does not define one ${input.ablationId} transform.`];
  }
  return derivedAblation === input.storedAblatedGuide
    ? []
    : [`Stored ablated guide does not match the ${input.ablationId} transform.`];
}

function bindingDiagnostics(input: AblationPairInput): string[] {
  const diagnostics: string[] = [];
  if (input.fullGuideRecord.guideSha256 !== sha256(input.canonicalGuide))
    diagnostics.push('Full-guide hash does not match the canonical guide.');
  if (input.ablatedGuideRecord.guideSha256 !== sha256(input.storedAblatedGuide))
    diagnostics.push('Ablated-guide hash does not match the stored ablation.');

  const rubricSha256 = sha256(JSON.stringify(input.rubric));
  if (
    input.fullGuideRecord.caseRubricSha256 !== rubricSha256 ||
    input.ablatedGuideRecord.caseRubricSha256 !== rubricSha256
  )
    diagnostics.push('Ablation records do not match the current case rubric.');
  if (!sameConfig(input.fullGuideRecord, input.ablatedGuideRecord))
    diagnostics.push('Ablation records do not share one evaluation configuration.');
  return diagnostics;
}

function preservedLabelDiagnostics(input: AblationPairInput): string[] {
  return input.preservedDecisionIds.flatMap(decisionId => {
    const label = `[${decisionId}]`;
    return input.canonicalGuide.includes(label) && input.storedAblatedGuide.includes(label)
      ? []
      : [`Ablation does not preserve decision label ${decisionId}.`];
  });
}

function responseDiagnostics(input: AblationPairInput): string[] {
  return [
    ...(responsePasses(input.fullGuideRecord.response, input.rubric)
      ? []
      : ['Full-guide response does not satisfy the evaluation rubric.']),
    ...(responsePasses(input.ablatedGuideRecord.response, input.rubric)
      ? ['Ablated response still satisfies the evaluation rubric.']
      : []),
  ];
}

export function verifyAblationPair(input: AblationPairInput): VerificationResult {
  const diagnostics = [
    ...ablationDiagnostics(input),
    ...bindingDiagnostics(input),
    ...preservedLabelDiagnostics(input),
    ...responseDiagnostics(input),
  ];
  return { accepted: diagnostics.length === 0, diagnostics };
}
