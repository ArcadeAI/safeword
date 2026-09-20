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

export type EvaluationConfigValue = string | number | boolean;

export interface EvaluationCase {
  readonly id: string;
  readonly text: string;
  readonly rubric: EvaluationRubric;
}

export interface EvaluationContract {
  readonly modelVersion: string;
  readonly decodingConfiguration: Readonly<Record<string, EvaluationConfigValue>>;
  readonly responseFormat: string;
  readonly rubricLoader: string;
  readonly toolsDisabled: true;
}

export interface EvaluationRecord {
  readonly caseId: string;
  readonly guideSha256: string;
  /** Hash of the case identity and text plus its sorted rubric sets. */
  readonly caseAndRubricSha256: string;
  readonly prompt: string;
  /** Hash of the complete cold-start prompt, including the guide bytes. */
  readonly coldStartPromptSha256: string;
  readonly modelVersion: string;
  readonly decodingConfiguration: Readonly<Record<string, EvaluationConfigValue>>;
  readonly responseFormat: string;
  readonly rubricLoader: string;
  readonly response: EvaluationResponse;
}

export interface EvaluationRecordInput {
  readonly canonicalGuide: string;
  readonly evaluationCase: EvaluationCase;
  readonly contract: EvaluationContract;
  readonly record: EvaluationRecord;
}

export interface EvaluationCorpusInput {
  readonly canonicalGuide: string;
  readonly cases: readonly EvaluationCase[];
  readonly contract: EvaluationContract;
  readonly records: readonly EvaluationRecord[];
}

export interface ArtifactAuthorityClaim {
  readonly artifactId: string;
  readonly contractId: string;
  readonly claimsSourceOfTruth: boolean;
}

export interface FacetCompletenessInput {
  readonly intendedFacetIds: readonly string[];
  readonly generatedFacetIds: readonly string[];
  readonly oracleKind: 'hand-maintained' | 'generated-sibling';
}

export interface AblationRecord {
  readonly guideSha256: string;
  readonly caseRubricSha256: string;
  /** Hash of case text plus neutral response schema; guide bytes bind separately. */
  readonly promptSha256: string;
  readonly modelVersion: string;
  readonly decodingConfiguration: Readonly<Record<string, EvaluationConfigValue>>;
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

export function buildColdStartPrompt(
  canonicalGuide: string,
  evaluationCase: Pick<EvaluationCase, 'id' | 'text'>,
): string {
  return canonicalJson({
    case: { id: evaluationCase.id, text: evaluationCase.text },
    guide: canonicalGuide,
    responseSchema: {
      additionalProperties: false,
      properties: {
        decisionIds: { items: { type: 'string' }, type: 'array' },
        proofFactIds: { items: { type: 'string' }, type: 'array' },
      },
      required: ['decisionIds', 'proofFactIds'],
      type: 'object',
    },
    toolsDisabled: true,
  });
}

function canonicalEvaluationCaseAndRubricJson(evaluationCase: EvaluationCase): string {
  return canonicalJson({
    case: { id: evaluationCase.id, text: evaluationCase.text },
    rubric: {
      expectedDecisionIds: sortedStrings(evaluationCase.rubric.expectedDecisionIds),
      forbiddenDecisionIds: sortedStrings(evaluationCase.rubric.forbiddenDecisionIds),
      expectedProofFactIds: sortedStrings(evaluationCase.rubric.expectedProofFactIds),
      forbiddenProofFactIds: sortedStrings(evaluationCase.rubric.forbiddenProofFactIds),
    },
  });
}

function idSetDiagnostics(
  actual: readonly string[],
  expected: readonly string[],
  forbidden: readonly string[],
  label: 'decision' | 'proof fact',
): string[] {
  const diagnostics: string[] = [];
  const actualCounts = new Map<string, number>();
  for (const id of actual) actualCounts.set(id, (actualCounts.get(id) ?? 0) + 1);

  const actualIds = new Set(actualCounts.keys());
  const expectedIds = new Set(expected);
  const forbiddenIds = new Set(forbidden);
  const sortedExpectedIds = sortedStrings([...expectedIds]);
  const sortedActualIds = sortedStrings([...actualIds]);
  for (const id of sortedExpectedIds) {
    if (!actualIds.has(id))
      diagnostics.push(`Evaluation response is missing expected ${label} ${id}.`);
  }
  for (const id of sortedActualIds) {
    if (forbiddenIds.has(id)) {
      diagnostics.push(`Evaluation response contains forbidden ${label} ${id}.`);
    } else if (!expectedIds.has(id)) {
      diagnostics.push(`Evaluation response contains unknown ${label} ${id}.`);
    }
    if ((actualCounts.get(id) ?? 0) > 1) {
      diagnostics.push(`Evaluation response contains duplicate ${label} ${id}.`);
    }
  }
  return diagnostics;
}

export function verifyEvaluationRecord(input: EvaluationRecordInput): VerificationResult {
  const diagnostics: string[] = [];
  const expectedPrompt = buildColdStartPrompt(input.canonicalGuide, input.evaluationCase);
  const expectedCaseAndRubricSha256 = sha256(
    canonicalEvaluationCaseAndRubricJson(input.evaluationCase),
  );

  if (input.record.guideSha256 !== sha256(input.canonicalGuide)) {
    diagnostics.push('Evaluation record guide hash does not match the current canonical guide.');
  }
  if (
    input.record.caseId !== input.evaluationCase.id ||
    input.record.caseAndRubricSha256 !== expectedCaseAndRubricSha256
  ) {
    diagnostics.push('Evaluation record does not match the current case and rubric.');
  }
  if (
    input.record.prompt !== expectedPrompt ||
    input.record.coldStartPromptSha256 !== sha256(expectedPrompt)
  ) {
    diagnostics.push('Evaluation record prompt does not match the current cold-start prompt.');
  }
  if (
    input.record.modelVersion !== input.contract.modelVersion ||
    canonicalJson(input.record.decodingConfiguration) !==
      canonicalJson(input.contract.decodingConfiguration) ||
    input.record.responseFormat !== input.contract.responseFormat ||
    input.record.rubricLoader !== input.contract.rubricLoader
  ) {
    diagnostics.push('Evaluation record does not match the checked-in recording contract.');
  }

  diagnostics.push(
    ...idSetDiagnostics(
      input.record.response.decisionIds,
      input.evaluationCase.rubric.expectedDecisionIds,
      input.evaluationCase.rubric.forbiddenDecisionIds,
      'decision',
    ),
    ...idSetDiagnostics(
      input.record.response.proofFactIds,
      input.evaluationCase.rubric.expectedProofFactIds,
      input.evaluationCase.rubric.forbiddenProofFactIds,
      'proof fact',
    ),
  );

  return { accepted: diagnostics.length === 0, diagnostics };
}

export function verifyEvaluationCorpus(input: EvaluationCorpusInput): VerificationResult {
  const diagnostics: string[] = [];

  for (const evaluationCase of input.cases) {
    const record = input.records.find(candidate => candidate.caseId === evaluationCase.id);
    if (record === undefined) {
      diagnostics.push(`[${evaluationCase.id}] Evaluation corpus is missing a record.`);
      continue;
    }

    const result = verifyEvaluationRecord({
      canonicalGuide: input.canonicalGuide,
      evaluationCase,
      contract: input.contract,
      record,
    });
    diagnostics.push(
      ...result.diagnostics.map(diagnostic => `[${evaluationCase.id}] ${diagnostic}`),
    );
  }

  return { accepted: diagnostics.length === 0, diagnostics };
}

export function verifyArtifactOwnership(
  claims: readonly ArtifactAuthorityClaim[],
): VerificationResult {
  const ownersByContract = new Map<string, Set<string>>();
  for (const claim of claims) {
    if (!claim.claimsSourceOfTruth) continue;
    const owners = ownersByContract.get(claim.contractId) ?? new Set<string>();
    owners.add(claim.artifactId);
    ownersByContract.set(claim.contractId, owners);
  }

  const diagnostics = [...ownersByContract]
    .toSorted(([left], [right]) => Buffer.compare(Buffer.from(left), Buffer.from(right)))
    .flatMap(([contractId, owners]) => {
      const sortedOwners = sortedStrings([...owners]);
      return sortedOwners.length > 1
        ? [`[${contractId}] Multiple source-of-truth owners: ${sortedOwners.join(', ')}.`]
        : [];
    });

  return { accepted: diagnostics.length === 0, diagnostics };
}

export function verifyFacetCompleteness(input: FacetCompletenessInput): VerificationResult {
  const intendedFacetIds = new Set(input.intendedFacetIds);
  const generatedFacetIds = new Set(input.generatedFacetIds);
  const diagnostics: string[] = [];
  const sortedIntendedFacetIds = sortedStrings([...intendedFacetIds]);
  const sortedGeneratedFacetIds = sortedStrings([...generatedFacetIds]);

  for (const facetId of sortedIntendedFacetIds) {
    if (!generatedFacetIds.has(facetId))
      diagnostics.push(`Generated manifest is missing intended facet ${facetId}.`);
  }
  for (const facetId of sortedGeneratedFacetIds) {
    if (!intendedFacetIds.has(facetId))
      diagnostics.push(`Generated manifest contains unknown facet ${facetId}.`);
  }

  return { accepted: diagnostics.length === 0, diagnostics };
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
  return { accepted: diagnostics.length === 0, diagnostics };
}
