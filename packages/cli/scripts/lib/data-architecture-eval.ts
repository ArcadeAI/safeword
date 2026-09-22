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
  readonly ablation?: EvaluationAblationConfig;
}

export interface EvaluationAblationConfig {
  readonly id: string;
  readonly caseId: string;
  readonly preservedDecisionIds: readonly string[];
  readonly attributableDecisionIds: readonly string[];
  readonly attributableProofFactIds: readonly string[];
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

export interface EvaluationCorpusSafetyInput {
  readonly cases: readonly EvaluationCase[];
  readonly contract: EvaluationContract;
}

export interface AblationRecord {
  readonly guideSha256: string;
  readonly caseRubricSha256: string;
  /** Hash of case text plus neutral response schema; guide bytes bind separately. */
  readonly promptSha256: string;
  readonly prompt: string;
  readonly coldStartPromptSha256: string;
  readonly modelVersion: string;
  readonly decodingConfiguration: Readonly<Record<string, EvaluationConfigValue>>;
  readonly responseFormat: string;
  readonly rubricLoader: string;
  readonly response: EvaluationResponse;
}

export interface StoredAblationRecord {
  readonly ablationId: string;
  readonly caseId: string;
  readonly record: AblationRecord;
}

export interface AblationPairInput {
  readonly ablationId: string;
  readonly canonicalGuide: string;
  readonly evaluationCase: Pick<EvaluationCase, 'id' | 'text'>;
  readonly storedAblatedGuide: string;
  readonly preservedDecisionIds: readonly string[];
  readonly attributableDecisionIds: readonly string[];
  readonly attributableProofFactIds: readonly string[];
  readonly rubric: EvaluationRubric;
  readonly fullGuideRecord: AblationRecord;
  readonly ablatedGuideRecord: AblationRecord;
}

const neutralResponseSchema = {
  additionalProperties: false,
  properties: {
    decisionIds: { items: { type: 'string' }, type: 'array' },
    proofFactIds: { items: { type: 'string' }, type: 'array' },
  },
  required: ['decisionIds', 'proofFactIds'],
  type: 'object',
} as const;

export function buildGuideIndependentPrompt(
  evaluationCase: Pick<EvaluationCase, 'id' | 'text'>,
): string {
  return canonicalJson({
    case: { id: evaluationCase.id, text: evaluationCase.text },
    responseSchema: neutralResponseSchema,
    toolsDisabled: true,
  });
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

export function evaluationRubricSha256(rubric: EvaluationRubric): string {
  return sha256(canonicalRubricJson(rubric));
}

export function buildColdStartPrompt(
  canonicalGuide: string,
  evaluationCase: Pick<EvaluationCase, 'id' | 'text'>,
): string {
  return canonicalJson({
    case: { id: evaluationCase.id, text: evaluationCase.text },
    guide: canonicalGuide,
    responseSchema: neutralResponseSchema,
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

export function createEvaluationRecord(input: {
  readonly canonicalGuide: string;
  readonly contract: EvaluationContract;
  readonly evaluationCase: EvaluationCase;
  readonly response: EvaluationResponse;
}): EvaluationRecord {
  const prompt = buildColdStartPrompt(input.canonicalGuide, input.evaluationCase);
  return {
    caseId: input.evaluationCase.id,
    guideSha256: sha256(input.canonicalGuide),
    caseAndRubricSha256: sha256(canonicalEvaluationCaseAndRubricJson(input.evaluationCase)),
    prompt,
    coldStartPromptSha256: sha256(prompt),
    modelVersion: input.contract.modelVersion,
    decodingConfiguration: input.contract.decodingConfiguration,
    responseFormat: input.contract.responseFormat,
    rubricLoader: input.contract.rubricLoader,
    response: input.response,
  };
}

export function createAblationRecord(input: {
  readonly guide: string;
  readonly evaluationCase: EvaluationCase;
  readonly contract: EvaluationContract;
  readonly response: EvaluationResponse;
}): AblationRecord {
  const prompt = buildColdStartPrompt(input.guide, input.evaluationCase);
  return {
    guideSha256: sha256(input.guide),
    caseRubricSha256: evaluationRubricSha256(input.evaluationCase.rubric),
    promptSha256: sha256(buildGuideIndependentPrompt(input.evaluationCase)),
    prompt,
    coldStartPromptSha256: sha256(prompt),
    modelVersion: input.contract.modelVersion,
    decodingConfiguration: input.contract.decodingConfiguration,
    responseFormat: input.contract.responseFormat,
    rubricLoader: input.contract.rubricLoader,
    response: input.response,
  };
}

export function evaluationRecordAsAblationRecord(
  record: EvaluationRecord,
  evaluationCase: EvaluationCase,
): AblationRecord {
  return {
    guideSha256: record.guideSha256,
    caseRubricSha256: evaluationRubricSha256(evaluationCase.rubric),
    promptSha256: sha256(buildGuideIndependentPrompt(evaluationCase)),
    prompt: record.prompt,
    coldStartPromptSha256: record.coldStartPromptSha256,
    modelVersion: record.modelVersion,
    decodingConfiguration: record.decodingConfiguration,
    responseFormat: record.responseFormat,
    rubricLoader: record.rubricLoader,
    response: record.response,
  };
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

function recordingContractMatches(contract: EvaluationContract, record: EvaluationRecord): boolean {
  return (
    contract.toolsDisabled &&
    record.modelVersion === contract.modelVersion &&
    canonicalJson(record.decodingConfiguration) === canonicalJson(contract.decodingConfiguration) &&
    record.responseFormat === contract.responseFormat &&
    record.rubricLoader === contract.rubricLoader
  );
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
  if (!recordingContractMatches(input.contract, input.record)) {
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

function corpusRecordDiagnostics(
  casesById: ReadonlyMap<string, EvaluationCase>,
  recordsByCaseId: ReadonlyMap<string, readonly EvaluationRecord[]>,
): string[] {
  return [...recordsByCaseId].flatMap(([caseId, records]) => {
    if (!casesById.has(caseId))
      return [`[${caseId}] Evaluation corpus contains a record for an unknown case.`];
    return records.length > 1 ? [`[${caseId}] Evaluation corpus contains duplicate records.`] : [];
  });
}

export function verifyEvaluationCorpus(input: EvaluationCorpusInput): VerificationResult {
  const casesById = new Map(input.cases.map(evaluationCase => [evaluationCase.id, evaluationCase]));
  const recordsByCaseId = new Map<string, EvaluationRecord[]>();
  for (const record of input.records) {
    const records = recordsByCaseId.get(record.caseId) ?? [];
    records.push(record);
    recordsByCaseId.set(record.caseId, records);
  }

  const diagnostics = corpusRecordDiagnostics(casesById, recordsByCaseId);

  for (const evaluationCase of input.cases) {
    const records = recordsByCaseId.get(evaluationCase.id) ?? [];
    const record = records.length === 1 ? records[0] : undefined;
    if (record === undefined) {
      if (records.length === 0)
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

const awsCredentialPattern = /\b(?:AKIA|ASIA)[A-Z0-9]{12,}\b/u;
const credentialPrefixPattern =
  /gh[pousr]_|github_pat_|[ps]k_(?:live|test)_|xox[baprs]-|-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/u;
const emailShapePattern = /\b[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+\b/u;

function hasHighEntropy(value: string): boolean {
  if (value.length < 32) return false;
  const frequencies = new Map<string, number>();
  for (const character of value) {
    frequencies.set(character, (frequencies.get(character) ?? 0) + 1);
  }
  let entropy = 0;
  for (const frequency of frequencies.values()) {
    const probability = frequency / value.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy >= 3.5;
}

function isLowercaseKebabCase(value: string): boolean {
  const segments = value.split('-');
  return (
    segments.length > 1 &&
    segments.every(segment => {
      if (segment.length === 0) return false;
      for (let index = 0; index < segment.length; index += 1) {
        const code = segment.codePointAt(index) ?? -1;
        const isLowercaseLetter = code >= 97 && code <= 122;
        const isDigit = code >= 48 && code <= 57;
        if (!isLowercaseLetter && !isDigit) return false;
      }
      return true;
    })
  );
}

function isSyntheticPlaceholder(value: string): boolean {
  if (!value.startsWith('SYNTHETIC_')) return false;
  const segments = value.slice('SYNTHETIC_'.length).split('_');
  return (
    segments.length > 0 &&
    segments.length <= 4 &&
    segments.every(
      segment => segment.length > 0 && segment.length <= 16 && /^[A-Z0-9]+$/u.test(segment),
    )
  );
}

function containsNonPlaceholderHighEntropyValue(value: string): boolean {
  const opaqueTokens = value.match(/[\w+/=-]{32,}/gu) ?? [];
  return opaqueTokens.some(
    token =>
      !isSyntheticPlaceholder(token) && !isLowercaseKebabCase(token) && hasHighEntropy(token),
  );
}

function containsCredentialPrefix(value: string): boolean {
  return awsCredentialPattern.test(value) || credentialPrefixPattern.test(value);
}

function authoredCorpusStringDiagnostics(value: string, path: string): string[] {
  const diagnostics: string[] = [];
  if (containsCredentialPrefix(value))
    diagnostics.push(`Corpus value at ${path} contains a credential or token prefix.`);
  if (emailShapePattern.test(value))
    diagnostics.push(`Corpus value at ${path} contains an email-shaped value.`);
  if (containsNonPlaceholderHighEntropyValue(value))
    diagnostics.push(`Corpus value at ${path} contains a non-placeholder high-entropy value.`);
  return diagnostics;
}

export function verifyEvaluationCorpusSafety(
  input: EvaluationCorpusSafetyInput,
): VerificationResult {
  // Prompts are reconstructed from the canonical guide, authored case identity/prose, and the
  // checked-in recording contract, while responses are constrained to exact rubric IDs. Scan every
  // authored string that can carry an arbitrary sensitive value after those checks succeed.
  const diagnostics = input.cases.flatMap((evaluationCase, caseIndex) => [
    ...authoredCorpusStringDiagnostics(evaluationCase.id, `cases[${caseIndex}].id`),
    ...authoredCorpusStringDiagnostics(evaluationCase.text, `cases[${caseIndex}].text`),
  ]);
  const visitAuthoredValue = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      diagnostics.push(...authoredCorpusStringDiagnostics(value, path));
      return;
    }
    if (Array.isArray(value)) {
      for (const [index, entry] of value.entries()) visitAuthoredValue(entry, `${path}[${index}]`);
      return;
    }
    if (typeof value === 'object' && value !== null) {
      for (const [key, entry] of Object.entries(value)) {
        visitAuthoredValue(entry, `${path}.${key}`);
      }
    }
  };
  for (const [caseIndex, evaluationCase] of input.cases.entries()) {
    visitAuthoredValue(evaluationCase.rubric, `cases[${caseIndex}].rubric`);
  }
  visitAuthoredValue(input.contract, 'contract');
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
  return (
    sameSet(response.decisionIds, rubric.expectedDecisionIds) &&
    sameSet(response.proofFactIds, rubric.expectedProofFactIds) &&
    idSetDiagnostics(
      response.decisionIds,
      rubric.expectedDecisionIds,
      rubric.forbiddenDecisionIds,
      'decision',
    ).length === 0 &&
    idSetDiagnostics(
      response.proofFactIds,
      rubric.expectedProofFactIds,
      rubric.forbiddenProofFactIds,
      'proof fact',
    ).length === 0
  );
}

export function deriveNamedAblation(
  canonicalGuide: string,
  ablationId: string,
): string | undefined {
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
  const diagnostics =
    derivedAblation === input.storedAblatedGuide
      ? []
      : [`Stored ablated guide does not match the ${input.ablationId} transform.`];
  if (
    input.attributableDecisionIds.every(
      decisionId => !input.preservedDecisionIds.includes(decisionId),
    )
  ) {
    diagnostics.push(
      'Ablation must attribute failure to at least one decision label preserved by the transform.',
    );
  }
  const attributableIds = [
    ...input.attributableDecisionIds.filter(
      decisionId => !input.preservedDecisionIds.includes(decisionId),
    ),
    ...input.attributableProofFactIds,
  ];
  for (const id of attributableIds) {
    const label = `[${id}]`;
    if (!removedContent.includes(label)) {
      diagnostics.push(`Ablation attribution ID ${id} is not defined in the removed guidance.`);
    }
    if (derivedAblation.includes(label)) {
      diagnostics.push(`Ablation attribution ID ${id} survives the named transform.`);
    }
  }
  return diagnostics;
}

function promptBindingDiagnostics(input: AblationPairInput): string[] {
  const expectedPromptSha256 = sha256(buildGuideIndependentPrompt(input.evaluationCase));
  const guideIndependentPromptMatches =
    input.fullGuideRecord.promptSha256 === expectedPromptSha256 &&
    input.ablatedGuideRecord.promptSha256 === expectedPromptSha256;
  const expectedFullPrompt = buildColdStartPrompt(input.canonicalGuide, input.evaluationCase);
  const expectedAblatedPrompt = buildColdStartPrompt(
    input.storedAblatedGuide,
    input.evaluationCase,
  );
  const coldStartPromptsMatch =
    input.fullGuideRecord.prompt === expectedFullPrompt &&
    input.fullGuideRecord.coldStartPromptSha256 === sha256(expectedFullPrompt) &&
    input.ablatedGuideRecord.prompt === expectedAblatedPrompt &&
    input.ablatedGuideRecord.coldStartPromptSha256 === sha256(expectedAblatedPrompt);
  return [
    ...(guideIndependentPromptMatches
      ? []
      : ['Ablation records do not match the current guide-independent prompt.']),
    ...(coldStartPromptsMatch
      ? []
      : ['Ablation records do not match the current cold-start prompts.']),
  ];
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
  diagnostics.push(...promptBindingDiagnostics(input));
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
  const ablatedDecisionIds = new Set(input.ablatedGuideRecord.response.decisionIds);
  const ablatedProofFactIds = new Set(input.ablatedGuideRecord.response.proofFactIds);
  const preservedAttributableDecisionIds = input.attributableDecisionIds.filter(id =>
    input.preservedDecisionIds.includes(id),
  );
  const preservedAttributableFailure = preservedAttributableDecisionIds.some(
    id => !ablatedDecisionIds.has(id),
  );
  const attributableFailure =
    input.attributableDecisionIds.some(id => !ablatedDecisionIds.has(id)) ||
    input.attributableProofFactIds.some(id => !ablatedProofFactIds.has(id));
  return [
    ...forbiddenDiagnostics,
    ...(!responsePasses(input.fullGuideRecord.response, input.rubric) &&
    forbiddenDiagnostics.length === 0
      ? ['Full-guide response does not satisfy the evaluation rubric.']
      : []),
    ...(responsePasses(input.ablatedGuideRecord.response, input.rubric)
      ? ['Ablated response still satisfies the evaluation rubric.']
      : []),
    ...(preservedAttributableDecisionIds.length > 0 && !preservedAttributableFailure
      ? ['Ablated response retains every attributable decision label preserved by the transform.']
      : []),
    ...(!responsePasses(input.ablatedGuideRecord.response, input.rubric) && !attributableFailure
      ? ['Ablated response failure does not implicate an expected ID from the removed guidance.']
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

export function verifyStoredAblation(input: {
  readonly canonicalGuide: string;
  readonly contract: EvaluationContract;
  readonly evaluationCase: EvaluationCase;
  readonly fullGuideRecord: EvaluationRecord;
  readonly stored: StoredAblationRecord;
}): VerificationResult {
  const config = input.contract.ablation;
  if (config === undefined) {
    return { accepted: false, diagnostics: ['Evaluation contract does not define an ablation.'] };
  }
  const ablatedGuide = deriveNamedAblation(input.canonicalGuide, config.id);
  if (ablatedGuide === undefined) {
    return {
      accepted: false,
      diagnostics: [`Canonical guide does not define one ${config.id} transform.`],
    };
  }
  const diagnostics: string[] = [];
  if (input.stored.ablationId !== config.id)
    diagnostics.push('Stored ablation ID does not match the evaluation contract.');
  if (input.stored.caseId !== config.caseId || input.evaluationCase.id !== config.caseId)
    diagnostics.push('Stored ablation case does not match the evaluation contract.');
  if (diagnostics.length > 0) return { accepted: false, diagnostics };
  return verifyAblationPair({
    ablationId: config.id,
    canonicalGuide: input.canonicalGuide,
    evaluationCase: input.evaluationCase,
    storedAblatedGuide: ablatedGuide,
    preservedDecisionIds: config.preservedDecisionIds,
    attributableDecisionIds: config.attributableDecisionIds,
    attributableProofFactIds: config.attributableProofFactIds,
    rubric: input.evaluationCase.rubric,
    fullGuideRecord: evaluationRecordAsAblationRecord(input.fullGuideRecord, input.evaluationCase),
    ablatedGuideRecord: input.stored.record,
  });
}
