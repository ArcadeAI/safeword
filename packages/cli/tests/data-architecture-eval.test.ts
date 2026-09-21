import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  type AblationRecord,
  type ArtifactAuthorityClaim,
  buildColdStartPrompt,
  buildGuideIndependentPrompt,
  type ConditionalProofInput,
  type EvaluationCase,
  type EvaluationContract,
  type EvaluationCorpusInput,
  type EvaluationRecord,
  type EvaluationResponse,
  type EvaluationRubric,
  type EvidenceSafetyInput,
  type FacetCompletenessInput,
  type StoredAblationRecord,
  verifyAblationPair,
  verifyArtifactOwnership,
  verifyConditionalProof,
  verifyEvaluationCorpus,
  verifyEvaluationCorpusSafety,
  verifyEvaluationRecord,
  verifyEvidenceSafety,
  verifyFacetCompleteness,
  verifyStoredAblation,
} from '../scripts/lib/data-architecture-eval.js';

const guide = [
  '# Data architecture',
  '## Independent proof [decision.core.independent-proof]',
  '<!-- data-architecture-ablation:independent-proof:start -->',
  'Every completeness claim names an oracle independent of the mechanism under test [proof.generated.independent-inventory].',
  '<!-- data-architecture-ablation:independent-proof:end -->',
].join('\n');
const ablatedGuide = [
  '# Data architecture',
  '## Independent proof [decision.core.independent-proof]',
  '<!-- data-architecture-ablation:independent-proof:start -->',
  '<!-- data-architecture-ablation:independent-proof:end -->',
].join('\n');
const rubric = {
  expectedDecisionIds: ['decision.generated.source', 'decision.core.independent-proof'],
  forbiddenDecisionIds: [],
  expectedProofFactIds: ['proof.generated.independent-inventory'],
  forbiddenProofFactIds: ['proof.generated.sibling-output'],
} as const;
const fullResponse: EvaluationResponse = {
  decisionIds: ['decision.generated.source', 'decision.core.independent-proof'],
  proofFactIds: ['proof.generated.independent-inventory'],
};
const ablatedResponse: EvaluationResponse = {
  decisionIds: ['decision.generated.source'],
  proofFactIds: [],
};
const ablationCase = {
  id: 'generated-manifest-missing-one-facet',
  text: 'Prove a generated manifest covers every independently intended facet.',
} as const;
const sharedPromptSha256 = sha256(buildGuideIndependentPrompt(ablationCase));
const shippedCanonicalGuide = readFileSync(
  nodePath.resolve(import.meta.dirname, '../templates/guides/data-architecture-guide.md'),
  'utf8',
);
const recordedCorpusDirectory = nodePath.resolve(
  import.meta.dirname,
  'fixtures/data-architecture-eval',
);
const currentCases = JSON.parse(
  readFileSync(nodePath.join(recordedCorpusDirectory, 'cases.json'), 'utf8'),
) as EvaluationCase[];
const currentContract = JSON.parse(
  readFileSync(nodePath.join(recordedCorpusDirectory, 'contract.json'), 'utf8'),
) as EvaluationContract;
const currentRecords = JSON.parse(
  readFileSync(nodePath.join(recordedCorpusDirectory, 'records.json'), 'utf8'),
) as EvaluationRecord[];
const currentAblation = JSON.parse(
  readFileSync(nodePath.join(recordedCorpusDirectory, 'ablation-record.json'), 'utf8'),
) as StoredAblationRecord;

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

function canonicalRubricJson(value: EvaluationRubric): string {
  return canonicalJson({
    expectedDecisionIds: sortedStrings(value.expectedDecisionIds),
    forbiddenDecisionIds: sortedStrings(value.forbiddenDecisionIds),
    expectedProofFactIds: sortedStrings(value.expectedProofFactIds),
    forbiddenProofFactIds: sortedStrings(value.forbiddenProofFactIds),
  });
}

function record(
  guideContent: string,
  response: EvaluationResponse,
  overrides: Partial<AblationRecord> = {},
): AblationRecord {
  return {
    guideSha256: sha256(guideContent),
    caseRubricSha256: sha256(canonicalRubricJson(rubric)),
    promptSha256: sharedPromptSha256,
    modelVersion: 'controlled-model-v1',
    decodingConfiguration: { temperature: 0, topP: 1 },
    responseFormat: 'data-architecture-eval-v1',
    rubricLoader: 'data-architecture-rubric-v1',
    response,
    ...overrides,
  };
}

const corpusContract: EvaluationContract = {
  modelVersion: 'controlled-model-v1',
  decodingConfiguration: { temperature: 0, topP: 1 },
  responseFormat: 'data-architecture-eval-v1',
  rubricLoader: 'data-architecture-rubric-v1',
  toolsDisabled: true,
};

const universalDecisionIds = [
  'decision.core.source-of-truth',
  'decision.core.identity-and-scope',
  'decision.core.value-contract',
  'decision.core.lifecycle',
] as const;

interface RepresentativeCaseFixture {
  readonly decisions: readonly string[];
  readonly forbiddenDecisions?: readonly string[];
  readonly forbiddenProofs?: readonly string[];
  readonly id: string;
  readonly proofs: readonly string[];
  readonly text: string;
}

const representativeCases: readonly RepresentativeCaseFixture[] = [
  {
    id: 'simple-key-value-preference',
    text: 'Plan a user-scoped key-value preference with no conditional data risks.',
    decisions: [...universalDecisionIds],
    proofs: [],
  },
  {
    id: 'multi-tenant-relational-event-store',
    text: 'Plan a multi-tenant relational event store with live migration and erasure.',
    decisions: [
      ...universalDecisionIds,
      'decision.relational.physical-schema',
      'decision.relational.query-contract',
      'decision.migration.deployed-state',
      'decision.migration.compatibility',
      'decision.migration.cutover-and-recovery',
      'decision.erasure.copy-disposition',
      'decision.erasure.isolation',
    ],
    forbiddenDecisions: ['decision.relational.cross-tenant-parent-binding'],
    forbiddenProofs: ['proof.relational.self-generated-coverage'],
    proofs: [
      'proof.relational.engine-and-version',
      'proof.relational.representative-data-shape',
      'proof.relational.query-shape',
      'proof.relational.threshold',
      'proof.relational.revalidation-trigger',
      'proof.migration.deployed-starting-state',
      'proof.migration.mixed-version-compatibility',
      'proof.migration.cutover',
      'proof.migration.recovery',
      'proof.migration.restore-behavior',
      'proof.erasure.copy-inventory',
      'proof.erasure.positive-deletion',
      'proof.erasure.sibling-scope-isolation',
      'proof.erasure.different-owner-isolation',
    ],
  },
  {
    id: 'encrypted-credential-record',
    text: 'Plan an encrypted credential record with identity-bound AAD and key rotation.',
    decisions: [
      ...universalDecisionIds,
      'decision.encryption.representation',
      'decision.encryption.aad-binding',
      'decision.encryption.key-lifecycle',
    ],
    proofs: [
      'proof.encryption.canonical-aad-identity',
      'proof.encryption.scope-mutation-failure',
      'proof.encryption.key-dependency-rotation-coverage',
    ],
  },
  {
    id: 'live-additive-migration',
    text: 'Plan a live additive migration from a deployed mixed-version starting state.',
    decisions: [
      ...universalDecisionIds,
      'decision.migration.deployed-state',
      'decision.migration.compatibility',
      'decision.migration.cutover-and-recovery',
    ],
    proofs: [
      'proof.migration.deployed-starting-state',
      'proof.migration.mixed-version-compatibility',
      'proof.migration.cutover',
      'proof.migration.recovery',
      'proof.migration.restore-behavior',
    ],
  },
  {
    id: 'generated-manifest-missing-one-facet',
    text: 'Prove a generated manifest covers every independently intended facet.',
    decisions: [
      ...universalDecisionIds,
      'decision.generated.source',
      'decision.core.independent-proof',
    ],
    proofs: ['proof.generated.independent-inventory'],
  },
  {
    id: 'erasure-across-secondary-copies',
    text: 'Plan erasure across primary and secondary copies with isolation controls.',
    decisions: [
      ...universalDecisionIds,
      'decision.erasure.copy-disposition',
      'decision.erasure.isolation',
    ],
    proofs: [
      'proof.erasure.copy-inventory',
      'proof.erasure.positive-deletion',
      'proof.erasure.sibling-scope-isolation',
      'proof.erasure.different-owner-isolation',
    ],
  },
  {
    id: 'time-equality-boundary',
    text: 'Plan expiry behavior at exact clock equality and delayed physical deletion.',
    decisions: [
      ...universalDecisionIds,
      'decision.temporal.clock-boundary',
      'decision.temporal.deletion-lag',
      'decision.erasure.copy-disposition',
      'decision.erasure.isolation',
    ],
    proofs: [
      'proof.temporal.authoritative-clock',
      'proof.temporal.exact-equality-behavior',
      'proof.temporal.retry-behavior',
      'proof.temporal.restore-behavior',
      'proof.erasure.copy-inventory',
      'proof.erasure.positive-deletion',
      'proof.erasure.sibling-scope-isolation',
      'proof.erasure.different-owner-isolation',
    ],
  },
  {
    id: 'mixed-decision-routing',
    text: 'Route durable identity and lifecycle separately from reversible helpers.',
    decisions: [
      'decision.routing.identity-architecture',
      'decision.routing.lifecycle-architecture',
      'decision.routing.helper-implementation',
      'decision.routing.control-flow-implementation',
    ],
    forbiddenDecisions: [
      'decision.routing.identity-implementation-only',
      'decision.routing.helper-architecture',
    ],
    forbiddenProofs: ['proof.routing.durable-and-reversible-collapsed'],
    proofs: ['proof.routing.durable-and-reversible-separated'],
  },
  {
    id: 'artifact-ownership',
    text: 'Assign each durable decision and its evidence to exactly one owning artifact.',
    decisions: [
      'decision.ownership.data-architecture',
      'decision.ownership.implementation-plan',
      'decision.ownership.generated-representation',
      'decision.ownership.adr',
      'decision.ownership.linked-evidence',
    ],
    forbiddenDecisions: ['decision.ownership.duplicate-authority'],
    proofs: ['proof.ownership.single-authority'],
  },
] as const;

const recordedResponsesByCase: Readonly<Record<string, EvaluationResponse>> = {
  'simple-key-value-preference': {
    decisionIds: [
      'decision.core.source-of-truth',
      'decision.core.identity-and-scope',
      'decision.core.value-contract',
      'decision.core.lifecycle',
    ],
    proofFactIds: [],
  },
  'multi-tenant-relational-event-store': {
    decisionIds: [
      'decision.core.source-of-truth',
      'decision.core.identity-and-scope',
      'decision.core.value-contract',
      'decision.core.lifecycle',
      'decision.relational.physical-schema',
      'decision.relational.query-contract',
      'decision.migration.deployed-state',
      'decision.migration.compatibility',
      'decision.migration.cutover-and-recovery',
      'decision.erasure.copy-disposition',
      'decision.erasure.isolation',
    ],
    proofFactIds: [
      'proof.relational.engine-and-version',
      'proof.relational.representative-data-shape',
      'proof.relational.query-shape',
      'proof.relational.threshold',
      'proof.relational.revalidation-trigger',
      'proof.migration.deployed-starting-state',
      'proof.migration.mixed-version-compatibility',
      'proof.migration.cutover',
      'proof.migration.recovery',
      'proof.migration.restore-behavior',
      'proof.erasure.copy-inventory',
      'proof.erasure.positive-deletion',
      'proof.erasure.sibling-scope-isolation',
      'proof.erasure.different-owner-isolation',
    ],
  },
  'encrypted-credential-record': {
    decisionIds: [
      'decision.core.source-of-truth',
      'decision.core.identity-and-scope',
      'decision.core.value-contract',
      'decision.core.lifecycle',
      'decision.encryption.representation',
      'decision.encryption.aad-binding',
      'decision.encryption.key-lifecycle',
    ],
    proofFactIds: [
      'proof.encryption.canonical-aad-identity',
      'proof.encryption.scope-mutation-failure',
      'proof.encryption.key-dependency-rotation-coverage',
    ],
  },
  'live-additive-migration': {
    decisionIds: [
      'decision.core.source-of-truth',
      'decision.core.identity-and-scope',
      'decision.core.value-contract',
      'decision.core.lifecycle',
      'decision.migration.deployed-state',
      'decision.migration.compatibility',
      'decision.migration.cutover-and-recovery',
    ],
    proofFactIds: [
      'proof.migration.deployed-starting-state',
      'proof.migration.mixed-version-compatibility',
      'proof.migration.cutover',
      'proof.migration.recovery',
      'proof.migration.restore-behavior',
    ],
  },
  'generated-manifest-missing-one-facet': {
    decisionIds: [
      'decision.core.source-of-truth',
      'decision.core.identity-and-scope',
      'decision.core.value-contract',
      'decision.core.lifecycle',
      'decision.generated.source',
      'decision.core.independent-proof',
    ],
    proofFactIds: ['proof.generated.independent-inventory'],
  },
  'erasure-across-secondary-copies': {
    decisionIds: [
      'decision.core.source-of-truth',
      'decision.core.identity-and-scope',
      'decision.core.value-contract',
      'decision.core.lifecycle',
      'decision.erasure.copy-disposition',
      'decision.erasure.isolation',
    ],
    proofFactIds: [
      'proof.erasure.copy-inventory',
      'proof.erasure.positive-deletion',
      'proof.erasure.sibling-scope-isolation',
      'proof.erasure.different-owner-isolation',
    ],
  },
  'time-equality-boundary': {
    decisionIds: [
      'decision.core.source-of-truth',
      'decision.core.identity-and-scope',
      'decision.core.value-contract',
      'decision.core.lifecycle',
      'decision.temporal.clock-boundary',
      'decision.temporal.deletion-lag',
      'decision.erasure.copy-disposition',
      'decision.erasure.isolation',
    ],
    proofFactIds: [
      'proof.temporal.authoritative-clock',
      'proof.temporal.exact-equality-behavior',
      'proof.temporal.retry-behavior',
      'proof.temporal.restore-behavior',
      'proof.erasure.copy-inventory',
      'proof.erasure.positive-deletion',
      'proof.erasure.sibling-scope-isolation',
      'proof.erasure.different-owner-isolation',
    ],
  },
  'mixed-decision-routing': {
    decisionIds: [
      'decision.routing.identity-architecture',
      'decision.routing.lifecycle-architecture',
      'decision.routing.helper-implementation',
      'decision.routing.control-flow-implementation',
    ],
    proofFactIds: ['proof.routing.durable-and-reversible-separated'],
  },
  'artifact-ownership': {
    decisionIds: [
      'decision.ownership.data-architecture',
      'decision.ownership.implementation-plan',
      'decision.ownership.generated-representation',
      'decision.ownership.adr',
      'decision.ownership.linked-evidence',
    ],
    proofFactIds: ['proof.ownership.single-authority'],
  },
};

function corpusFixture(): EvaluationCorpusInput {
  const cases: EvaluationCase[] = representativeCases.map(item => ({
    id: item.id,
    text: item.text,
    rubric: {
      expectedDecisionIds: [...item.decisions],
      forbiddenDecisionIds: [...(item.forbiddenDecisions ?? [])],
      expectedProofFactIds: [...item.proofs],
      forbiddenProofFactIds: [...(item.forbiddenProofs ?? [])],
    },
  }));
  const records = cases.map((evaluationCase): EvaluationRecord => {
    const recordedResponse = recordedResponsesByCase[evaluationCase.id];
    if (recordedResponse === undefined)
      throw new Error(`Missing recorded response for ${evaluationCase.id}.`);
    const prompt = buildColdStartPrompt(guide, evaluationCase);
    return {
      caseId: evaluationCase.id,
      guideSha256: sha256(guide),
      caseAndRubricSha256: sha256(
        canonicalJson({
          case: { id: evaluationCase.id, text: evaluationCase.text },
          rubric: {
            expectedDecisionIds: sortedStrings(evaluationCase.rubric.expectedDecisionIds),
            forbiddenDecisionIds: sortedStrings(evaluationCase.rubric.forbiddenDecisionIds),
            expectedProofFactIds: sortedStrings(evaluationCase.rubric.expectedProofFactIds),
            forbiddenProofFactIds: sortedStrings(evaluationCase.rubric.forbiddenProofFactIds),
          },
        }),
      ),
      prompt,
      coldStartPromptSha256: sha256(prompt),
      modelVersion: corpusContract.modelVersion,
      decodingConfiguration: { ...corpusContract.decodingConfiguration },
      responseFormat: corpusContract.responseFormat,
      rubricLoader: corpusContract.rubricLoader,
      response: {
        decisionIds: [...recordedResponse.decisionIds],
        proofFactIds: [...recordedResponse.proofFactIds],
      },
    };
  });
  return { canonicalGuide: guide, cases, contract: corpusContract, records };
}

describe('data architecture guide evaluation', () => {
  it('binds the canonical guide to every durable decision and named ablation marker', () => {
    const expectedDecisionIds = new Set(representativeCases.flatMap(item => item.decisions));
    for (const decisionId of expectedDecisionIds) {
      expect(shippedCanonicalGuide).toContain(`[${decisionId}]`);
    }
    expect(shippedCanonicalGuide).toContain(
      '<!-- data-architecture-ablation:independent-proof:start -->',
    );
    expect(shippedCanonicalGuide).toContain(
      '<!-- data-architecture-ablation:independent-proof:end -->',
    );
  });

  it('accepts all nine representative cases with exactly their applicable guidance', () => {
    const corpus = corpusFixture();
    const relationalRecord = corpus.records.find(
      evaluationRecord => evaluationRecord.caseId === 'multi-tenant-relational-event-store',
    );
    if (relationalRecord === undefined) throw new Error('Missing relational corpus record.');
    const encryptedCredentialRecord = corpus.records.find(
      evaluationRecord => evaluationRecord.caseId === 'encrypted-credential-record',
    );
    if (encryptedCredentialRecord === undefined)
      throw new Error('Missing encrypted credential corpus record.');
    const artifactOwnershipRecord = corpus.records.find(
      evaluationRecord => evaluationRecord.caseId === 'artifact-ownership',
    );
    if (artifactOwnershipRecord === undefined)
      throw new Error('Missing artifact ownership corpus record.');
    const smuggledPrompt = JSON.stringify({
      ...JSON.parse(relationalRecord.prompt),
      ambientContext: 'repository state',
    });
    const replaceRelationalRecord = (replacement: EvaluationRecord): EvaluationCorpusInput => ({
      ...corpus,
      records: corpus.records.map(evaluationRecord =>
        evaluationRecord === relationalRecord ? replacement : evaluationRecord,
      ),
    });
    const rejectedCorpora = [
      {
        name: 'missing case record',
        corpus: {
          ...corpus,
          records: corpus.records.filter(
            evaluationRecord => evaluationRecord.caseId !== 'encrypted-credential-record',
          ),
        },
        diagnostic: '[encrypted-credential-record] Evaluation corpus is missing a record.',
      },
      {
        name: 'duplicate case record',
        corpus: { ...corpus, records: [...corpus.records, relationalRecord] },
        diagnostic:
          '[multi-tenant-relational-event-store] Evaluation corpus contains duplicate records.',
      },
      {
        name: 'unknown case record',
        corpus: {
          ...corpus,
          records: [...corpus.records, { ...relationalRecord, caseId: 'retired-case' }],
        },
        diagnostic: '[retired-case] Evaluation corpus contains a record for an unknown case.',
      },
      {
        name: 'stale guide hash',
        corpus: replaceRelationalRecord({
          ...relationalRecord,
          guideSha256: sha256('stale guide'),
        }),
        diagnostic:
          '[multi-tenant-relational-event-store] Evaluation record guide hash does not match the current canonical guide.',
      },
      {
        name: 'stale case and rubric digest',
        corpus: replaceRelationalRecord({
          ...relationalRecord,
          caseAndRubricSha256: sha256('stale case and rubric'),
        }),
        diagnostic:
          '[multi-tenant-relational-event-store] Evaluation record does not match the current case and rubric.',
      },
      {
        name: 'stale cold-start prompt digest',
        corpus: replaceRelationalRecord({
          ...relationalRecord,
          coldStartPromptSha256: sha256('stale prompt'),
        }),
        diagnostic:
          '[multi-tenant-relational-event-store] Evaluation record prompt does not match the current cold-start prompt.',
      },
      {
        name: 'self-consistent prompt with ambient context',
        corpus: replaceRelationalRecord({
          ...relationalRecord,
          prompt: smuggledPrompt,
          coldStartPromptSha256: sha256(smuggledPrompt),
        }),
        diagnostic:
          '[multi-tenant-relational-event-store] Evaluation record prompt does not match the current cold-start prompt.',
      },
      {
        name: 'different model version',
        corpus: replaceRelationalRecord({
          ...relationalRecord,
          modelVersion: 'different-model-v2',
        }),
        diagnostic:
          '[multi-tenant-relational-event-store] Evaluation record does not match the checked-in recording contract.',
      },
      {
        name: 'different decoding configuration',
        corpus: replaceRelationalRecord({
          ...relationalRecord,
          decodingConfiguration: { temperature: 1, topP: 1 },
        }),
        diagnostic:
          '[multi-tenant-relational-event-store] Evaluation record does not match the checked-in recording contract.',
      },
      {
        name: 'different response format',
        corpus: replaceRelationalRecord({
          ...relationalRecord,
          responseFormat: 'freeform-text',
        }),
        diagnostic:
          '[multi-tenant-relational-event-store] Evaluation record does not match the checked-in recording contract.',
      },
      {
        name: 'response fails its rubric',
        corpus: replaceRelationalRecord({
          ...relationalRecord,
          response: {
            ...relationalRecord.response,
            decisionIds: relationalRecord.response.decisionIds.filter(
              id => id !== 'decision.relational.query-contract',
            ),
          },
        }),
        diagnostic:
          '[multi-tenant-relational-event-store] Evaluation response is missing expected decision decision.relational.query-contract.',
      },
      {
        name: 'a non-relational response fails its rubric',
        corpus: {
          ...corpus,
          records: corpus.records.map(evaluationRecord =>
            evaluationRecord === encryptedCredentialRecord
              ? {
                  ...encryptedCredentialRecord,
                  response: {
                    ...encryptedCredentialRecord.response,
                    decisionIds: encryptedCredentialRecord.response.decisionIds.filter(
                      id => id !== 'decision.encryption.aad-binding',
                    ),
                  },
                }
              : evaluationRecord,
          ),
        },
        diagnostic:
          '[encrypted-credential-record] Evaluation response is missing expected decision decision.encryption.aad-binding.',
      },
      {
        name: 'response contains an unknown decision',
        corpus: replaceRelationalRecord({
          ...relationalRecord,
          response: {
            ...relationalRecord.response,
            decisionIds: [...relationalRecord.response.decisionIds, 'decision.relational.unknown'],
          },
        }),
        diagnostic:
          '[multi-tenant-relational-event-store] Evaluation response contains unknown decision decision.relational.unknown.',
      },
      {
        name: 'response contains a known but inapplicable decision',
        corpus: replaceRelationalRecord({
          ...relationalRecord,
          response: {
            ...relationalRecord.response,
            decisionIds: [
              ...relationalRecord.response.decisionIds,
              'decision.encryption.aad-binding',
            ],
          },
        }),
        diagnostic:
          '[multi-tenant-relational-event-store] Evaluation response contains unknown decision decision.encryption.aad-binding.',
      },
      {
        name: 'response contains a forbidden decision',
        corpus: replaceRelationalRecord({
          ...relationalRecord,
          response: {
            ...relationalRecord.response,
            decisionIds: [
              ...relationalRecord.response.decisionIds,
              'decision.relational.cross-tenant-parent-binding',
            ],
          },
        }),
        diagnostic:
          '[multi-tenant-relational-event-store] Evaluation response contains forbidden decision decision.relational.cross-tenant-parent-binding.',
      },
      {
        name: 'response is missing an expected proof fact',
        corpus: replaceRelationalRecord({
          ...relationalRecord,
          response: {
            ...relationalRecord.response,
            proofFactIds: relationalRecord.response.proofFactIds.filter(
              id => id !== 'proof.migration.deployed-starting-state',
            ),
          },
        }),
        diagnostic:
          '[multi-tenant-relational-event-store] Evaluation response is missing expected proof fact proof.migration.deployed-starting-state.',
      },
      {
        name: 'response contains an unknown proof fact',
        corpus: replaceRelationalRecord({
          ...relationalRecord,
          response: {
            ...relationalRecord.response,
            proofFactIds: [...relationalRecord.response.proofFactIds, 'proof.relational.unknown'],
          },
        }),
        diagnostic:
          '[multi-tenant-relational-event-store] Evaluation response contains unknown proof fact proof.relational.unknown.',
      },
      {
        name: 'response contains a forbidden proof fact',
        corpus: replaceRelationalRecord({
          ...relationalRecord,
          response: {
            ...relationalRecord.response,
            proofFactIds: [
              ...relationalRecord.response.proofFactIds,
              'proof.relational.self-generated-coverage',
            ],
          },
        }),
        diagnostic:
          '[multi-tenant-relational-event-store] Evaluation response contains forbidden proof fact proof.relational.self-generated-coverage.',
      },
      {
        name: 'two artifacts claim authority for one durable contract',
        corpus: {
          ...corpus,
          records: corpus.records.map(evaluationRecord =>
            evaluationRecord === artifactOwnershipRecord
              ? {
                  ...artifactOwnershipRecord,
                  response: {
                    ...artifactOwnershipRecord.response,
                    decisionIds: [
                      ...artifactOwnershipRecord.response.decisionIds,
                      'decision.ownership.duplicate-authority',
                    ],
                  },
                }
              : evaluationRecord,
          ),
        },
        diagnostic:
          '[artifact-ownership] Evaluation response contains forbidden decision decision.ownership.duplicate-authority.',
      },
    ];

    expect.soft(verifyEvaluationCorpus(corpus)).toEqual({ accepted: true, diagnostics: [] });
    for (const rejected of rejectedCorpora) {
      expect.soft(verifyEvaluationCorpus(rejected.corpus), rejected.name).toEqual({
        accepted: false,
        diagnostics: [rejected.diagnostic],
      });
    }
  });

  it.each([
    { id: 'simple-key-value-preference' },
    { id: 'multi-tenant-relational-event-store' },
    { id: 'encrypted-credential-record' },
    { id: 'live-additive-migration' },
    { id: 'generated-manifest-missing-one-facet' },
    { id: 'erasure-across-secondary-copies' },
    { id: 'time-equality-boundary' },
  ])('records $id against the canonical guide and rubric', ({ id }) => {
    const evaluationCase = currentCases.find(candidate => candidate.id === id);
    if (evaluationCase === undefined) throw new Error(`Missing current case for ${id}.`);
    const evaluationRecord = currentRecords.find(
      candidate => candidate.caseId === evaluationCase.id,
    );
    if (evaluationRecord === undefined)
      throw new Error(`Missing current record for ${evaluationCase.id}.`);
    expect(
      verifyEvaluationRecord({
        canonicalGuide: shippedCanonicalGuide,
        evaluationCase,
        contract: currentContract,
        record: evaluationRecord,
      }),
    ).toEqual({ accepted: true, diagnostics: [] });
  });

  it('accepts the complete current nine-case corpus against the shipped guide', () => {
    expect(
      verifyEvaluationCorpus({
        canonicalGuide: shippedCanonicalGuide,
        cases: currentCases,
        contract: currentContract,
        records: currentRecords,
      }),
    ).toEqual({ accepted: true, diagnostics: [] });
  });

  it('accepts the current mixed decision-routing record against the shipped guide', () => {
    const evaluationCase = currentCases.find(item => item.id === 'mixed-decision-routing');
    const evaluationRecord = currentRecords.find(item => item.caseId === 'mixed-decision-routing');
    if (evaluationCase === undefined || evaluationRecord === undefined)
      throw new Error('Current mixed decision-routing evidence is missing.');
    expect(
      verifyEvaluationRecord({
        canonicalGuide: shippedCanonicalGuide,
        evaluationCase,
        contract: currentContract,
        record: evaluationRecord,
      }),
    ).toEqual({ accepted: true, diagnostics: [] });
  });

  it('accepts the current recorder-produced independent-proof ablation', () => {
    const evaluationCase = currentCases.find(
      item => item.id === 'generated-manifest-missing-one-facet',
    );
    const fullGuideRecord = currentRecords.find(
      item => item.caseId === 'generated-manifest-missing-one-facet',
    );
    if (evaluationCase === undefined || fullGuideRecord === undefined)
      throw new Error('Current ablation control evidence is missing.');
    expect(
      verifyStoredAblation({
        canonicalGuide: shippedCanonicalGuide,
        contract: currentContract,
        evaluationCase,
        fullGuideRecord,
        stored: currentAblation,
      }),
    ).toEqual({ accepted: true, diagnostics: [] });
  });

  it('safety-checks the current authored corpus', () => {
    expect(verifyEvaluationCorpusSafety({ cases: currentCases })).toEqual({
      accepted: true,
      diagnostics: [],
    });
  });

  it.each([
    { name: 'missing record', mutate: (records: EvaluationRecord[]) => records.slice(1) },
    {
      name: 'duplicate record',
      mutate: (records: EvaluationRecord[]) => {
        const firstRecord = records[0];
        if (firstRecord === undefined) throw new Error('Expected a non-empty evaluation corpus.');
        return [...records, firstRecord];
      },
    },
    {
      name: 'unknown record',
      mutate: (records: EvaluationRecord[]) => {
        const firstRecord = records[0];
        if (firstRecord === undefined) throw new Error('Expected a non-empty evaluation corpus.');
        return [...records, { ...firstRecord, caseId: 'retired-case' }];
      },
    },
    {
      name: 'stale guide hash',
      mutate: (records: EvaluationRecord[]) => {
        const firstRecord = records[0];
        if (firstRecord === undefined) throw new Error('Expected a non-empty evaluation corpus.');
        return [{ ...firstRecord, guideSha256: sha256('stale guide') }, ...records.slice(1)];
      },
    },
    {
      name: 'stale case and rubric digest',
      mutate: (records: EvaluationRecord[]) => {
        const firstRecord = records[0];
        if (firstRecord === undefined) throw new Error('Expected a non-empty evaluation corpus.');
        return [
          { ...firstRecord, caseAndRubricSha256: sha256('stale rubric') },
          ...records.slice(1),
        ];
      },
    },
    {
      name: 'stale prompt digest',
      mutate: (records: EvaluationRecord[]) => {
        const firstRecord = records[0];
        if (firstRecord === undefined) throw new Error('Expected a non-empty evaluation corpus.');
        return [
          { ...firstRecord, coldStartPromptSha256: sha256('stale prompt') },
          ...records.slice(1),
        ];
      },
    },
    {
      name: 'recording contract drift',
      mutate: (records: EvaluationRecord[]) => {
        const firstRecord = records[0];
        if (firstRecord === undefined) throw new Error('Expected a non-empty evaluation corpus.');
        return [{ ...firstRecord, modelVersion: 'different-model' }, ...records.slice(1)];
      },
    },
    {
      name: 'response rubric failure',
      mutate: (records: EvaluationRecord[]) => {
        const firstRecord = records[0];
        if (firstRecord === undefined) throw new Error('Expected a non-empty evaluation corpus.');
        return [
          { ...firstRecord, response: { ...firstRecord.response, decisionIds: [] } },
          ...records.slice(1),
        ];
      },
    },
  ])('rejects corpus defect $name', ({ mutate }) => {
    const result = verifyEvaluationCorpus({
      canonicalGuide: shippedCanonicalGuide,
      cases: currentCases,
      contract: currentContract,
      records: mutate(currentRecords),
    });
    expect(result.accepted).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('accepts the current artifact-ownership record with one authority per role', () => {
    const evaluationCase = currentCases.find(item => item.id === 'artifact-ownership');
    const evaluationRecord = currentRecords.find(item => item.caseId === 'artifact-ownership');
    if (evaluationCase === undefined || evaluationRecord === undefined)
      throw new Error('Current artifact-ownership evidence is missing.');
    expect(
      verifyEvaluationRecord({
        canonicalGuide: shippedCanonicalGuide,
        evaluationCase,
        contract: currentContract,
        record: evaluationRecord,
      }),
    ).toEqual({ accepted: true, diagnostics: [] });
  });

  it('rejects routing a consequential data contract only to implementation planning', () => {
    const evaluationCase = currentCases.find(item => item.id === 'mixed-decision-routing');
    const evaluationRecord = currentRecords.find(item => item.caseId === 'mixed-decision-routing');
    if (evaluationCase === undefined || evaluationRecord === undefined)
      throw new Error('Current mixed-routing evidence is missing.');
    const result = verifyEvaluationRecord({
      canonicalGuide: shippedCanonicalGuide,
      evaluationCase,
      contract: currentContract,
      record: {
        ...evaluationRecord,
        response: {
          ...evaluationRecord.response,
          decisionIds: evaluationRecord.response.decisionIds.filter(
            id => id !== 'decision.routing.identity-architecture',
          ),
        },
      },
    });
    expect(result.diagnostics).toContain(
      'Evaluation response is missing expected decision decision.routing.identity-architecture.',
    );
  });

  it('scans authored corpus text and responses without rejecting ordinary prose', () => {
    const corpus = corpusFixture();
    const firstCase = corpus.cases[0];
    if (firstCase === undefined) throw new Error('Corpus fixture is empty.');
    expect(verifyEvaluationCorpusSafety({ cases: corpus.cases })).toEqual({
      accepted: true,
      diagnostics: [],
    });
    expect(
      verifyEvaluationCorpusSafety({
        cases: [
          {
            ...firstCase,
            text: 'Use token github_pat_12345678901234567890123456789012.',
          },
        ],
      }),
    ).toEqual({
      accepted: false,
      diagnostics: [
        'Corpus value at cases[0].text contains a credential or token prefix.',
        'Corpus value at cases[0].text contains a non-placeholder high-entropy value.',
      ],
    });
  });

  it('rejects duplicate source-of-truth ownership across artifacts', () => {
    expect(
      verifyArtifactOwnership([
        {
          artifactId: 'architecture-answer',
          contractId: 'durable-session-contract',
          claimsSourceOfTruth: true,
        },
        {
          artifactId: 'generated-representation',
          contractId: 'durable-session-contract',
          claimsSourceOfTruth: false,
        },
      ]),
    ).toEqual({ accepted: true, diagnostics: [] });
    expect(
      verifyArtifactOwnership([
        {
          artifactId: 'architecture-answer',
          contractId: 'durable-session-contract',
          claimsSourceOfTruth: true,
        },
        {
          artifactId: 'architecture-answer',
          contractId: 'retention-policy',
          claimsSourceOfTruth: true,
        },
      ]),
    ).toEqual({ accepted: true, diagnostics: [] });

    const claims: ArtifactAuthorityClaim[] = [
      {
        artifactId: 'generated-representation',
        contractId: 'durable-session-contract',
        claimsSourceOfTruth: true,
      },
      {
        artifactId: 'architecture-answer',
        contractId: 'durable-session-contract',
        claimsSourceOfTruth: true,
      },
    ];

    expect(verifyArtifactOwnership(claims)).toEqual({
      accepted: false,
      diagnostics: [
        '[durable-session-contract] Multiple source-of-truth owners: architecture-answer, generated-representation.',
      ],
    });
  });

  it('reports a generated-manifest facet omitted from an independent inventory', () => {
    const complete: FacetCompletenessInput = {
      intendedFacetIds: ['access-patterns', 'encryption', 'erasure'],
      generatedFacetIds: ['access-patterns', 'encryption', 'erasure'],
      oracleKind: 'hand-maintained',
    };

    expect.soft(verifyFacetCompleteness(complete)).toEqual({ accepted: true, diagnostics: [] });
    expect
      .soft(
        verifyFacetCompleteness({
          ...complete,
          generatedFacetIds: ['access-patterns', 'encryption'],
        }),
      )
      .toEqual({
        accepted: false,
        diagnostics: ['Generated manifest is missing intended facet erasure.'],
      });
    expect
      .soft(
        verifyFacetCompleteness({
          ...complete,
          generatedFacetIds: [...complete.generatedFacetIds, 'retention'],
        }),
      )
      .toEqual({
        accepted: false,
        diagnostics: ['Generated manifest contains unknown facet retention.'],
      });
  });

  it('rejects sibling generated outputs as a completeness oracle', () => {
    const generatedFacetIds = ['access-patterns', 'encryption'];

    expect
      .soft(
        verifyFacetCompleteness({
          intendedFacetIds: generatedFacetIds,
          generatedFacetIds,
          oracleKind: 'hand-maintained',
        }),
      )
      .toEqual({ accepted: true, diagnostics: [] });
    expect
      .soft(
        verifyFacetCompleteness({
          intendedFacetIds: generatedFacetIds,
          generatedFacetIds,
          oracleKind: 'generated-sibling',
        }),
      )
      .toEqual({
        accepted: false,
        diagnostics: ['Completeness oracle must be independent of generated outputs.'],
      });
  });

  it.each([
    {
      claim: 'relational-query-performance',
      factIds: [
        'proof.relational.engine-and-version',
        'proof.relational.representative-data-shape',
        'proof.relational.query-shape',
        'proof.relational.threshold',
        'proof.relational.revalidation-trigger',
      ],
    },
    {
      claim: 'encrypted-scope-binding',
      factIds: [
        'proof.encryption.canonical-aad-identity',
        'proof.encryption.scope-mutation-failure',
        'proof.encryption.key-dependency-rotation-coverage',
      ],
    },
    {
      claim: 'live-additive-migration',
      factIds: [
        'proof.migration.deployed-starting-state',
        'proof.migration.mixed-version-compatibility',
        'proof.migration.cutover',
        'proof.migration.recovery',
        'proof.migration.restore-behavior',
      ],
    },
    {
      claim: 'erasure-completeness',
      factIds: [
        'proof.erasure.copy-inventory',
        'proof.erasure.positive-deletion',
        'proof.erasure.sibling-scope-isolation',
        'proof.erasure.different-owner-isolation',
      ],
    },
    {
      claim: 'time-dependent-lifecycle',
      factIds: [
        'proof.temporal.authoritative-clock',
        'proof.temporal.exact-equality-behavior',
        'proof.temporal.retry-behavior',
        'proof.temporal.restore-behavior',
      ],
    },
  ] satisfies readonly ConditionalProofInput[])(
    'accepts the complete $claim conditional proof',
    conditionalProof => {
      expect(verifyConditionalProof(conditionalProof)).toEqual({ accepted: true, diagnostics: [] });
    },
  );

  it.each([
    {
      defect: 'query evidence without execution context',
      diagnostic: 'Conditional proof is missing query context.',
      proof: {
        claim: 'relational-query-performance',
        factIds: [
          'proof.relational.query-shape',
          'proof.relational.threshold',
          'proof.relational.revalidation-trigger',
        ],
      },
    },
    {
      defect: 'a child identity bound to another tenant',
      diagnostic: 'Conditional proof has cross-tenant parent binding.',
      proof: {
        claim: 'tenant-parent-binding',
        factIds: ['decision.relational.cross-tenant-parent-binding'],
      },
    },
    {
      defect: 'a generic encrypted-at-rest assertion',
      diagnostic: 'Conditional proof is missing AAD and key lifecycle.',
      proof: {
        claim: 'encrypted-scope-binding',
        factIds: ['proof.encryption.encrypted-at-rest'],
      },
    },
    {
      defect: 'migration evidence from a feature branch',
      diagnostic: 'Conditional proof is missing deployed starting state.',
      proof: {
        claim: 'live-additive-migration',
        factIds: [
          'proof.migration.feature-branch-starting-state',
          'proof.migration.mixed-version-compatibility',
          'proof.migration.cutover',
          'proof.migration.recovery',
          'proof.migration.restore-behavior',
        ],
      },
    },
    {
      defect: 'deletion evidence for only the primary row',
      diagnostic: 'Conditional proof is missing secondary-copy disposition.',
      proof: {
        claim: 'erasure-completeness',
        factIds: [
          'proof.erasure.positive-deletion',
          'proof.erasure.sibling-scope-isolation',
          'proof.erasure.different-owner-isolation',
        ],
      },
    },
    {
      defect: 'erasure proof without isolation controls',
      diagnostic: 'Conditional proof is missing negative isolation.',
      proof: {
        claim: 'erasure-completeness',
        factIds: ['proof.erasure.copy-inventory', 'proof.erasure.positive-deletion'],
      },
    },
    {
      defect: 'coverage inferred from a generated sibling',
      diagnostic: 'Conditional proof uses a dependent completeness oracle.',
      proof: {
        claim: 'generated-completeness',
        factIds: ['proof.generated.sibling-output'],
      },
    },
    {
      defect: 'temporal proof away from equality',
      diagnostic: 'Conditional proof is missing equality boundary.',
      proof: {
        claim: 'time-dependent-lifecycle',
        factIds: [
          'proof.temporal.authoritative-clock',
          'proof.temporal.retry-behavior',
          'proof.temporal.restore-behavior',
        ],
      },
    },
  ] satisfies readonly {
    readonly defect: string;
    readonly diagnostic: string;
    readonly proof: ConditionalProofInput;
  }[])('rejects $defect with its focused diagnostic', ({ diagnostic, proof }) => {
    expect(verifyConditionalProof(proof)).toEqual({ accepted: false, diagnostics: [diagnostic] });
  });

  it('accepts synthetic mutable values and read-only migration evidence', () => {
    const evidence: EvidenceSafetyInput = {
      mutableValues: {
        cases: [{ tenantId: 'SYNTHETIC_TENANT_ID' }],
        records: [
          {
            payload: {
              encryptedValue: 'SYNTHETIC_ENCRYPTED_VALUE',
              ownerId: 'SYNTHETIC_OWNER_ID',
            },
          },
        ],
      },
      migrationEvidenceSources: ['deployed-read-only', 'checked-in-equivalent'],
    };

    expect(verifyEvidenceSafety(evidence)).toEqual({ accepted: true, diagnostics: [] });
  });

  it.each([
    {
      diagnostic:
        'Evidence value at mutableValues.records[0].response.proofFactIds[0] is a credential, token, or key prefix.',
      value: 'sk_live_EXAMPLE_CREDENTIAL',
      valueClass: 'credential, token, or key prefix',
    },
    {
      diagnostic:
        'Evidence value at mutableValues.records[0].response.proofFactIds[0] is an email-shaped value.',
      value: 'customer@example.com',
      valueClass: 'email-shaped value',
    },
    {
      diagnostic:
        'Evidence value at mutableValues.records[0].response.proofFactIds[0] is a non-placeholder high-entropy value.',
      value: '7b1d9f0342a6e8c57d0b1493f6a2c8e57b1d9f0342a6e8c57d0b1493f6a2c8e5',
      valueClass: 'non-placeholder high-entropy value',
    },
  ])(
    'rejects a nested $valueClass with its unsafe value class identified',
    ({ diagnostic, value }) => {
      const evidence: EvidenceSafetyInput = {
        mutableValues: { records: [{ response: { proofFactIds: [value] } }] },
        migrationEvidenceSources: ['deployed-read-only'],
      };

      expect(verifyEvidenceSafety(evidence)).toEqual({
        accepted: false,
        diagnostics: [diagnostic],
      });
    },
  );

  it('reports every nested unsafe value in stable path order', () => {
    const evidence: EvidenceSafetyInput = {
      mutableValues: {
        records: [
          {
            response: {
              contact: 'customer@example.com',
              token: 'sk_live_EXAMPLE_CREDENTIAL',
            },
          },
        ],
      },
      migrationEvidenceSources: ['checked-in-equivalent'],
    };

    expect(verifyEvidenceSafety(evidence)).toEqual({
      accepted: false,
      diagnostics: [
        'Evidence value at mutableValues.records[0].response.contact is an email-shaped value.',
        'Evidence value at mutableValues.records[0].response.token is a credential, token, or key prefix.',
      ],
    });
  });

  it('accepts a mixed planning record that separates durable decisions from reversible helpers', () => {
    const mixedCase: EvaluationCase = {
      id: 'mixed-decision-routing',
      text: [
        'Plan a stored session record with a durable account identity and expiry lifecycle.',
        'A local parsing helper and retry loop remain reversible implementation choices.',
      ].join(' '),
      rubric: {
        expectedDecisionIds: [
          'decision.routing.identity-architecture',
          'decision.routing.lifecycle-architecture',
          'decision.routing.helper-implementation',
          'decision.routing.control-flow-implementation',
        ],
        forbiddenDecisionIds: [
          'decision.routing.identity-implementation-only',
          'decision.routing.helper-architecture',
        ],
        expectedProofFactIds: ['proof.routing.durable-and-reversible-separated'],
        forbiddenProofFactIds: ['proof.routing.durable-and-reversible-collapsed'],
      },
    };
    const contract: EvaluationContract = {
      modelVersion: 'controlled-model-v1',
      decodingConfiguration: { temperature: 0, topP: 1 },
      responseFormat: 'data-architecture-eval-v1',
      rubricLoader: 'data-architecture-rubric-v1',
      toolsDisabled: true,
    };
    const prompt = buildColdStartPrompt(guide, mixedCase);
    const mixedRecord: EvaluationRecord = {
      caseId: mixedCase.id,
      guideSha256: sha256(guide),
      caseAndRubricSha256: sha256(
        canonicalJson({
          case: { id: mixedCase.id, text: mixedCase.text },
          rubric: {
            expectedDecisionIds: sortedStrings(mixedCase.rubric.expectedDecisionIds),
            forbiddenDecisionIds: sortedStrings(mixedCase.rubric.forbiddenDecisionIds),
            expectedProofFactIds: sortedStrings(mixedCase.rubric.expectedProofFactIds),
            forbiddenProofFactIds: sortedStrings(mixedCase.rubric.forbiddenProofFactIds),
          },
        }),
      ),
      prompt,
      coldStartPromptSha256: sha256(prompt),
      modelVersion: contract.modelVersion,
      decodingConfiguration: contract.decodingConfiguration,
      responseFormat: contract.responseFormat,
      rubricLoader: contract.rubricLoader,
      response: {
        decisionIds: [...mixedCase.rubric.expectedDecisionIds],
        proofFactIds: [...mixedCase.rubric.expectedProofFactIds],
      },
    };

    expect.soft(JSON.parse(prompt)).toEqual({
      case: { id: mixedCase.id, text: mixedCase.text },
      guide,
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
    const smuggledPrompt = JSON.stringify({
      ...JSON.parse(prompt),
      ambientContext: 'repository state',
    });
    const rejectedRecords = [
      {
        name: 'different case identity',
        record: { ...mixedRecord, caseId: 'different-case' },
        diagnostic: 'Evaluation record does not match the current case and rubric.',
      },
      {
        name: 'stale canonical guide hash',
        record: { ...mixedRecord, guideSha256: sha256('stale guide') },
        diagnostic: 'Evaluation record guide hash does not match the current canonical guide.',
      },
      {
        name: 'stale case and rubric digest',
        record: { ...mixedRecord, caseAndRubricSha256: sha256('stale case and rubric') },
        diagnostic: 'Evaluation record does not match the current case and rubric.',
      },
      {
        name: 'stale cold-start prompt digest',
        record: { ...mixedRecord, coldStartPromptSha256: sha256('stale prompt') },
        diagnostic: 'Evaluation record prompt does not match the current cold-start prompt.',
      },
      {
        name: 'self-consistent prompt with ambient context',
        record: {
          ...mixedRecord,
          prompt: smuggledPrompt,
          coldStartPromptSha256: sha256(smuggledPrompt),
        },
        diagnostic: 'Evaluation record prompt does not match the current cold-start prompt.',
      },
      {
        name: 'different model version',
        record: { ...mixedRecord, modelVersion: 'different-model-v2' },
        diagnostic: 'Evaluation record does not match the checked-in recording contract.',
      },
      {
        name: 'different decoding configuration',
        record: { ...mixedRecord, decodingConfiguration: { temperature: 1, topP: 1 } },
        diagnostic: 'Evaluation record does not match the checked-in recording contract.',
      },
      {
        name: 'missing durable lifecycle decision',
        record: {
          ...mixedRecord,
          response: {
            ...mixedRecord.response,
            decisionIds: mixedRecord.response.decisionIds.filter(
              id => id !== 'decision.routing.lifecycle-architecture',
            ),
          },
        },
        diagnostic:
          'Evaluation response is missing expected decision decision.routing.lifecycle-architecture.',
      },
      {
        name: 'unknown decision',
        record: {
          ...mixedRecord,
          response: {
            ...mixedRecord.response,
            decisionIds: [...mixedRecord.response.decisionIds, 'decision.routing.unknown'],
          },
        },
        diagnostic: 'Evaluation response contains unknown decision decision.routing.unknown.',
      },
      {
        name: 'known but inapplicable decision',
        record: {
          ...mixedRecord,
          response: {
            ...mixedRecord.response,
            decisionIds: [...mixedRecord.response.decisionIds, 'decision.encryption.aad-binding'],
          },
        },
        diagnostic:
          'Evaluation response contains unknown decision decision.encryption.aad-binding.',
      },
      {
        name: 'forbidden decision',
        record: {
          ...mixedRecord,
          response: {
            ...mixedRecord.response,
            decisionIds: [
              ...mixedRecord.response.decisionIds,
              'decision.routing.helper-architecture',
            ],
          },
        },
        diagnostic:
          'Evaluation response contains forbidden decision decision.routing.helper-architecture.',
      },
      {
        name: 'missing expected proof fact',
        record: {
          ...mixedRecord,
          response: {
            ...mixedRecord.response,
            proofFactIds: mixedRecord.response.proofFactIds.filter(
              id => id !== 'proof.routing.durable-and-reversible-separated',
            ),
          },
        },
        diagnostic:
          'Evaluation response is missing expected proof fact proof.routing.durable-and-reversible-separated.',
      },
      {
        name: 'unknown proof fact',
        record: {
          ...mixedRecord,
          response: {
            ...mixedRecord.response,
            proofFactIds: [...mixedRecord.response.proofFactIds, 'proof.routing.unknown'],
          },
        },
        diagnostic: 'Evaluation response contains unknown proof fact proof.routing.unknown.',
      },
      {
        name: 'forbidden proof fact',
        record: {
          ...mixedRecord,
          response: {
            ...mixedRecord.response,
            proofFactIds: [
              ...mixedRecord.response.proofFactIds,
              'proof.routing.durable-and-reversible-collapsed',
            ],
          },
        },
        diagnostic:
          'Evaluation response contains forbidden proof fact proof.routing.durable-and-reversible-collapsed.',
      },
    ];
    for (const rejected of rejectedRecords) {
      expect
        .soft(
          verifyEvaluationRecord({
            canonicalGuide: guide,
            evaluationCase: mixedCase,
            contract,
            record: rejected.record,
          }),
          rejected.name,
        )
        .toEqual({ accepted: false, diagnostics: [rejected.diagnostic] });
    }
    expect
      .soft(
        verifyEvaluationRecord({
          canonicalGuide: guide,
          evaluationCase: mixedCase,
          contract,
          record: mixedRecord,
        }),
      )
      .toEqual({ accepted: true, diagnostics: [] });
  });

  it('accepts a discriminating independent-proof guide ablation', () => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse),
    });

    expect(result).toEqual({ accepted: true, diagnostics: [] });
  });

  it('rejects an ablation whose failure is unrelated to the removed guidance', () => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, {
        decisionIds: ['decision.core.independent-proof'],
        proofFactIds: ['proof.generated.independent-inventory'],
      }),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: [
        'Ablated response failure does not implicate an expected ID from the removed guidance.',
      ],
    });
  });

  it('accepts an ablation whose only missing attributable ID is a proof fact', () => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, {
        decisionIds: ['decision.generated.source', 'decision.core.independent-proof'],
        proofFactIds: [],
      }),
    });

    expect(result).toEqual({ accepted: true, diagnostics: [] });
  });

  it('rejects a stored ablation that was not derived from the canonical guide', () => {
    const mismatchedAblation = `${ablatedGuide}\nUnexpected retained guidance`;
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: mismatchedAblation,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(mismatchedAblation, ablatedResponse),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: ['Stored ablated guide does not match the independent-proof transform.'],
    });
  });

  it.each([
    ['one newline', ablatedGuide],
    [
      'adjacent markers',
      ablatedGuide.replace(
        ':independent-proof:start -->\n<!-- data-architecture-ablation:',
        ':independent-proof:start --><!-- data-architecture-ablation:',
      ),
    ],
    [
      'whitespace-only content',
      ablatedGuide.replace(
        ':independent-proof:start -->\n<!-- data-architecture-ablation:',
        ':independent-proof:start -->  \n<!-- data-architecture-ablation:',
      ),
    ],
  ])('rejects a named transform containing only $0', (_name, canonicalGuide) => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(canonicalGuide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: ['Named independent-proof transform does not change the canonical guide.'],
    });
  });

  it.each([
    {
      name: 'missing transform markers',
      canonicalGuide: guide.replaceAll(
        /<!-- data-architecture-ablation:independent-proof:(?:start|end) -->\n?/g,
        '',
      ),
    },
    {
      name: 'duplicate transform markers',
      canonicalGuide: `${guide}\n<!-- data-architecture-ablation:independent-proof:start -->`,
    },
  ])('rejects a canonical guide with $name', ({ canonicalGuide }) => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(canonicalGuide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: ['Canonical guide does not define one independent-proof transform.'],
    });
  });

  it('rejects a pair when the ablated response still satisfies the rubric', () => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, fullResponse),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: ['Ablated response still satisfies the evaluation rubric.'],
    });
  });

  it('rejects duplicate IDs in the full-guide ablation control', () => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guide, {
        ...fullResponse,
        decisionIds: [...fullResponse.decisionIds, 'decision.generated.source'],
      }),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: ['Full-guide response does not satisfy the evaluation rubric.'],
    });
  });

  it('rejects a pair when the full-guide response fails its control rubric', () => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guide, ablatedResponse),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: ['Full-guide response does not satisfy the evaluation rubric.'],
    });
  });

  it('rejects a pair recorded with different model configurations', () => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse, {
        modelVersion: 'different-model-v2',
      }),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: ['Ablation records do not share one evaluation configuration.'],
    });
  });

  it('rejects a pair recorded from different case prompts', () => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse, {
        promptSha256: sha256('different case prompt'),
      }),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: [
        'Ablation records do not share one evaluation configuration.',
        'Ablation records do not match the current guide-independent prompt.',
      ],
    });
  });

  it('rejects a pair whose shared prompt digest does not derive from the declared case', () => {
    const promptSha256 = sha256('same stale case prompt');
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guide, fullResponse, { promptSha256 }),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse, { promptSha256 }),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: ['Ablation records do not match the current guide-independent prompt.'],
    });
  });

  it('rejects a pair recorded with different decoding configurations', () => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse, {
        decodingConfiguration: { temperature: 1, topP: 1 },
      }),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: ['Ablation records do not share one evaluation configuration.'],
    });
  });

  it('accepts equivalent decoding configurations with different key order', () => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse, {
        decodingConfiguration: { topP: 1, temperature: 0 },
      }),
    });

    expect(result).toEqual({ accepted: true, diagnostics: [] });
  });

  it('rejects a pair recorded through different response formats', () => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse, {
        responseFormat: 'different-response-v2',
      }),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: ['Ablation records do not share one evaluation configuration.'],
    });
  });

  it('rejects a pair recorded through different rubric loaders', () => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse, {
        rubricLoader: 'different-rubric-v2',
      }),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: ['Ablation records do not share one evaluation configuration.'],
    });
  });

  it('rejects a pair whose record is bound to a different case rubric', () => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse, {
        caseRubricSha256: sha256('stale rubric'),
      }),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: ['Ablation records do not match the current case rubric.'],
    });
  });

  it('accepts an equivalent case rubric with different property order', () => {
    const reorderedRubric = {
      forbiddenProofFactIds: ['proof.generated.sibling-output'],
      expectedProofFactIds: ['proof.generated.independent-inventory'],
      forbiddenDecisionIds: [],
      expectedDecisionIds: ['decision.generated.source', 'decision.core.independent-proof'],
    } as const;
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric: reorderedRubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse),
    });

    expect(result).toEqual({ accepted: true, diagnostics: [] });
  });

  it('accepts an equivalent case rubric with different ID order', () => {
    const reorderedRubric = {
      ...rubric,
      expectedDecisionIds: rubric.expectedDecisionIds.toReversed(),
    };
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric: reorderedRubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse),
    });

    expect(result).toEqual({ accepted: true, diagnostics: [] });
  });

  it('rejects a named transform that removes a preserved decision label', () => {
    const labelInsideTransform = [
      '# Data architecture',
      '## Independent proof',
      '<!-- data-architecture-ablation:independent-proof:start -->',
      '[decision.core.independent-proof]',
      'Every completeness claim names an independent oracle [proof.generated.independent-inventory].',
      '<!-- data-architecture-ablation:independent-proof:end -->',
    ].join('\n');
    const labelRemovingAblation = [
      '# Data architecture',
      '## Independent proof',
      '<!-- data-architecture-ablation:independent-proof:start -->',
      '<!-- data-architecture-ablation:independent-proof:end -->',
    ].join('\n');
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: labelInsideTransform,
      evaluationCase: ablationCase,
      storedAblatedGuide: labelRemovingAblation,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(labelInsideTransform, fullResponse),
      ablatedGuideRecord: record(labelRemovingAblation, ablatedResponse),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: ['Ablation does not preserve decision label decision.core.independent-proof.'],
    });
  });

  it('rejects an attribution ID outside the removed guidance', () => {
    const misplacedAttributionGuide = [
      '# Data architecture',
      '## Independent proof [decision.core.independent-proof]',
      '[proof.generated.independent-inventory]',
      '<!-- data-architecture-ablation:independent-proof:start -->',
      'Every completeness claim names an independent oracle.',
      '<!-- data-architecture-ablation:independent-proof:end -->',
    ].join('\n');
    const misplacedAttributionAblation = [
      '# Data architecture',
      '## Independent proof [decision.core.independent-proof]',
      '[proof.generated.independent-inventory]',
      '<!-- data-architecture-ablation:independent-proof:start -->',
      '<!-- data-architecture-ablation:independent-proof:end -->',
    ].join('\n');
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: misplacedAttributionGuide,
      evaluationCase: ablationCase,
      storedAblatedGuide: misplacedAttributionAblation,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: [],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(misplacedAttributionGuide, fullResponse),
      ablatedGuideRecord: record(misplacedAttributionAblation, ablatedResponse),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: [
        'Ablation attribution ID proof.generated.independent-inventory is not defined in the removed guidance.',
        'Ablation attribution ID proof.generated.independent-inventory survives the named transform.',
      ],
    });
  });

  it('distinguishes a missing canonical decision label from ablation drift', () => {
    const guideWithoutLabel = guide.replace(' [decision.core.independent-proof]', '');
    const ablatedGuideWithoutLabel = ablatedGuide.replace(' [decision.core.independent-proof]', '');
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guideWithoutLabel,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuideWithoutLabel,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guideWithoutLabel, fullResponse),
      ablatedGuideRecord: record(ablatedGuideWithoutLabel, ablatedResponse),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: [
        'Canonical guide does not define preserved decision label decision.core.independent-proof.',
      ],
    });
  });

  it('rejects a pair whose recorded guide hash is stale', () => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guide, fullResponse, { guideSha256: sha256('stale guide') }),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: ['Full-guide hash does not match the canonical guide.'],
    });
  });

  it('rejects a pair whose ablated-guide hash is stale', () => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse, {
        guideSha256: sha256('stale ablated guide'),
      }),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: ['Ablated-guide hash does not match the stored ablation.'],
    });
  });

  it('reports every independent binding failure in stable order', () => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guide, fullResponse, {
        guideSha256: sha256('stale guide'),
      }),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse, {
        modelVersion: 'different-model-v2',
      }),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: [
        'Full-guide hash does not match the canonical guide.',
        'Ablation records do not share one evaluation configuration.',
      ],
    });
  });

  it('rejects a full-guide control response containing a forbidden decision', () => {
    const forbiddenDecisionRubric = {
      ...rubric,
      forbiddenDecisionIds: ['decision.generated.sibling-output'],
    } as const;
    const forbiddenResponse: EvaluationResponse = {
      ...fullResponse,
      decisionIds: [...fullResponse.decisionIds, 'decision.generated.sibling-output'],
    };
    const caseRubricSha256 = sha256(canonicalRubricJson(forbiddenDecisionRubric));
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric: forbiddenDecisionRubric,
      fullGuideRecord: record(guide, forbiddenResponse, { caseRubricSha256 }),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse, { caseRubricSha256 }),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: [
        'Full-guide response contains forbidden decision decision.generated.sibling-output.',
      ],
    });
  });

  it('rejects a rubric that both expects and forbids one decision', () => {
    const contradictoryRubric = {
      ...rubric,
      forbiddenDecisionIds: ['decision.core.independent-proof'],
    } as const;
    const caseRubricSha256 = sha256(canonicalRubricJson(contradictoryRubric));
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric: contradictoryRubric,
      fullGuideRecord: record(guide, fullResponse, { caseRubricSha256 }),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse, { caseRubricSha256 }),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: [
        'Evaluation rubric both expects and forbids decision decision.core.independent-proof.',
      ],
    });
  });

  it('rejects a full-guide control response containing a forbidden proof fact', () => {
    const forbiddenResponse: EvaluationResponse = {
      ...fullResponse,
      proofFactIds: [...fullResponse.proofFactIds, 'proof.generated.sibling-output'],
    };
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      evaluationCase: ablationCase,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      attributableDecisionIds: ['decision.core.independent-proof'],
      attributableProofFactIds: ['proof.generated.independent-inventory'],
      rubric,
      fullGuideRecord: record(guide, forbiddenResponse),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: [
        'Full-guide response contains forbidden proof fact proof.generated.sibling-output.',
      ],
    });
  });
});
