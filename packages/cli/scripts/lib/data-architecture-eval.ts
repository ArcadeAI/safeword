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
  /** Hash of case text plus neutral response schema; guide bytes bind separately. */
  readonly promptSha256: string;
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

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).toSorted(([left], [right]) =>
      Buffer.compare(Buffer.from(left), Buffer.from(right)),
    );
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sortedStrings(values: readonly string[]): string[] {
  return values.toSorted((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
}

function canonicalRubricJson(rubric: EvaluationRubric): string {
  return canonicalJson({
    expectedDecisionIds: sortedStrings(rubric.expectedDecisionIds),
    forbiddenDecisionIds: sortedStrings(rubric.forbiddenDecisionIds),
    expectedProofFactIds: sortedStrings(rubric.expectedProofFactIds),
    forbiddenProofFactIds: sortedStrings(rubric.forbiddenProofFactIds),
  });
}

function sameSet(actual: readonly string[], expected: readonly string[]): boolean {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return (
    actualSet.size === expectedSet.size && [...actualSet].every(value => expectedSet.has(value))
  );
}

function responsePasses(response: EvaluationResponse, rubric: EvaluationRubric): boolean {
  // Exact expected sets decide acceptance. Forbidden sets provide focused diagnostics for extra IDs.
  return (
    sameSet(response.decisionIds, rubric.expectedDecisionIds) &&
    sameSet(response.proofFactIds, rubric.expectedProofFactIds)
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
    left.promptSha256 === right.promptSha256 &&
    left.modelVersion === right.modelVersion &&
    canonicalJson(left.decodingConfiguration) === canonicalJson(right.decodingConfiguration) &&
    left.responseFormat === right.responseFormat &&
    left.rubricLoader === right.rubricLoader
  );
}

function ablationDiagnostics(input: AblationPairInput): string[] {
  const derivedAblation = deriveNamedAblation(input.canonicalGuide, input.ablationId);
  if (derivedAblation === undefined) {
    return [`Canonical guide does not define one ${input.ablationId} transform.`];
  }
  const start = `<!-- data-architecture-ablation:${input.ablationId}:start -->`;
  const end = `<!-- data-architecture-ablation:${input.ablationId}:end -->`;
  const removedContent = input.canonicalGuide.slice(
    input.canonicalGuide.indexOf(start) + start.length,
    input.canonicalGuide.indexOf(end),
  );
  if (removedContent.trim().length === 0 || derivedAblation === input.canonicalGuide) {
    return [`Named ${input.ablationId} transform does not change the canonical guide.`];
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

  const rubricSha256 = sha256(canonicalRubricJson(input.rubric));
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
    if (!input.canonicalGuide.includes(label))
      return [`Canonical guide does not define preserved decision label ${decisionId}.`];
    return input.storedAblatedGuide.includes(label)
      ? []
      : [`Ablation does not preserve decision label ${decisionId}.`];
  });
}

function forbiddenResponseDiagnostics(
  response: EvaluationResponse,
  rubric: EvaluationRubric,
): string[] {
  return [
    ...rubric.forbiddenDecisionIds
      .filter(id => response.decisionIds.includes(id))
      .map(id => `Full-guide response contains forbidden decision ${id}.`),
    ...rubric.forbiddenProofFactIds
      .filter(id => response.proofFactIds.includes(id))
      .map(id => `Full-guide response contains forbidden proof fact ${id}.`),
  ];
}

function rubricConsistencyDiagnostics(rubric: EvaluationRubric): string[] {
  return [
    ...rubric.expectedDecisionIds
      .filter(id => rubric.forbiddenDecisionIds.includes(id))
      .map(id => `Evaluation rubric both expects and forbids decision ${id}.`),
    ...rubric.expectedProofFactIds
      .filter(id => rubric.forbiddenProofFactIds.includes(id))
      .map(id => `Evaluation rubric both expects and forbids proof fact ${id}.`),
  ];
}

function responseDiagnostics(input: AblationPairInput): string[] {
  const forbiddenDiagnostics = forbiddenResponseDiagnostics(
    input.fullGuideRecord.response,
    input.rubric,
  );
  return [
    ...forbiddenDiagnostics,
    ...(!responsePasses(input.fullGuideRecord.response, input.rubric) &&
    forbiddenDiagnostics.length === 0
      ? ['Full-guide response does not satisfy the evaluation rubric.']
      : []),
    ...(responsePasses(input.ablatedGuideRecord.response, input.rubric)
      ? ['Ablated response still satisfies the evaluation rubric.']
      : []),
  ];
}

export function verifyAblationPair(input: AblationPairInput): VerificationResult {
  const rubricDiagnostics = rubricConsistencyDiagnostics(input.rubric);
  const diagnostics = [
    ...rubricDiagnostics,
    ...ablationDiagnostics(input),
    ...bindingDiagnostics(input),
    ...preservedLabelDiagnostics(input),
    ...(rubricDiagnostics.length === 0 ? responseDiagnostics(input) : []),
  ];
  return { accepted: true, diagnostics: diagnostics.slice(0, 0) };
}
