import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  type AblationRecord,
  type ArtifactAuthorityClaim,
  buildColdStartPrompt,
  type EvaluationCase,
  type EvaluationContract,
  type EvaluationCorpusInput,
  type EvaluationRecord,
  type EvaluationResponse,
  type EvaluationRubric,
  verifyAblationPair,
  verifyArtifactOwnership,
  verifyEvaluationCorpus,
  verifyEvaluationRecord,
} from '../scripts/lib/data-architecture-eval.js';

const guide = [
  '# Data architecture',
  '## Independent proof [decision.core.independent-proof]',
  '<!-- data-architecture-ablation:independent-proof:start -->',
  'Every completeness claim names an oracle independent of the mechanism under test.',
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
const sharedPromptSha256 = sha256('generated-manifest case + neutral response schema');

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

const representativeCases = [
  {
    id: 'simple-key-value-preference',
    text: 'Plan a user-scoped key-value preference with no conditional data risks.',
    decisions: [...universalDecisionIds],
    proofs: ['proof.core.contract-complete'],
  },
  {
    id: 'multi-tenant-relational-event-store',
    text: 'Plan a multi-tenant relational event store with live migration and erasure.',
    decisions: [
      ...universalDecisionIds,
      'decision.relational.physical-schema',
      'decision.relational.query-contract',
      'decision.migration.deployed-state',
      'decision.erasure.copy-disposition',
    ],
    forbiddenDecisions: ['decision.relational.cross-tenant-parent-binding'],
    forbiddenProofs: ['proof.relational.self-generated-coverage'],
    proofs: [
      'proof.relational.query-context',
      'proof.migration.deployed-mixed-version',
      'proof.erasure.complete-and-isolated',
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
    proofs: ['proof.encryption.scope-and-rotation'],
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
    proofs: ['proof.migration.deployed-mixed-version'],
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
    proofs: ['proof.erasure.complete-and-isolated'],
  },
  {
    id: 'time-equality-boundary',
    text: 'Plan expiry behavior at exact clock equality and delayed physical deletion.',
    decisions: [
      ...universalDecisionIds,
      'decision.temporal.clock-boundary',
      'decision.temporal.deletion-lag',
    ],
    proofs: ['proof.temporal.equality-retry-restore'],
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
] as const satisfies readonly RepresentativeCaseFixture[];

const recordedResponsesByCase: Readonly<Record<string, EvaluationResponse>> = {
  'simple-key-value-preference': {
    decisionIds: [
      'decision.core.source-of-truth',
      'decision.core.identity-and-scope',
      'decision.core.value-contract',
      'decision.core.lifecycle',
    ],
    proofFactIds: ['proof.core.contract-complete'],
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
      'decision.erasure.copy-disposition',
    ],
    proofFactIds: [
      'proof.relational.query-context',
      'proof.migration.deployed-mixed-version',
      'proof.erasure.complete-and-isolated',
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
    proofFactIds: ['proof.encryption.scope-and-rotation'],
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
    proofFactIds: ['proof.migration.deployed-mixed-version'],
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
    proofFactIds: ['proof.erasure.complete-and-isolated'],
  },
  'time-equality-boundary': {
    decisionIds: [
      'decision.core.source-of-truth',
      'decision.core.identity-and-scope',
      'decision.core.value-contract',
      'decision.core.lifecycle',
      'decision.temporal.clock-boundary',
      'decision.temporal.deletion-lag',
    ],
    proofFactIds: ['proof.temporal.equality-retry-restore'],
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
              id => id !== 'proof.migration.deployed-mixed-version',
            ),
          },
        }),
        diagnostic:
          '[multi-tenant-relational-event-store] Evaluation response is missing expected proof fact proof.migration.deployed-mixed-version.',
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
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      rubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse),
    });

    expect(result).toEqual({ accepted: true, diagnostics: [] });
  });

  it('rejects a stored ablation that was not derived from the canonical guide', () => {
    const mismatchedAblation = `${ablatedGuide}\nUnexpected retained guidance`;
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      storedAblatedGuide: mismatchedAblation,
      preservedDecisionIds: ['decision.core.independent-proof'],
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
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
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
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
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
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      rubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, fullResponse),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: ['Ablated response still satisfies the evaluation rubric.'],
    });
  });

  it('rejects a pair when the full-guide response fails its control rubric', () => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
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
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
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
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      rubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse, {
        promptSha256: sha256('different case prompt'),
      }),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: ['Ablation records do not share one evaluation configuration.'],
    });
  });

  it('rejects a pair recorded with different decoding configurations', () => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
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
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
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
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
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
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
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
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
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
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
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
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
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
      'Every completeness claim names an independent oracle.',
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
      storedAblatedGuide: labelRemovingAblation,
      preservedDecisionIds: ['decision.core.independent-proof'],
      rubric,
      fullGuideRecord: record(labelInsideTransform, fullResponse),
      ablatedGuideRecord: record(labelRemovingAblation, ablatedResponse),
    });

    expect(result).toEqual({
      accepted: false,
      diagnostics: ['Ablation does not preserve decision label decision.core.independent-proof.'],
    });
  });

  it('distinguishes a missing canonical decision label from ablation drift', () => {
    const guideWithoutLabel = guide.replace(' [decision.core.independent-proof]', '');
    const ablatedGuideWithoutLabel = ablatedGuide.replace(' [decision.core.independent-proof]', '');
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guideWithoutLabel,
      storedAblatedGuide: ablatedGuideWithoutLabel,
      preservedDecisionIds: ['decision.core.independent-proof'],
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
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
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
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
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
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
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
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
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
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
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
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
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
