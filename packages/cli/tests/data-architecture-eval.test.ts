import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  type AblationRecord,
  buildColdStartPrompt,
  type EvaluationCase,
  type EvaluationContract,
  type EvaluationRecord,
  type EvaluationResponse,
  type EvaluationRubric,
  verifyAblationPair,
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

describe('data architecture guide evaluation', () => {
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
        forbiddenProofFactIds: [],
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
      caseRubricSha256: sha256(
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
      promptSha256: sha256(prompt),
      modelVersion: contract.modelVersion,
      decodingConfiguration: contract.decodingConfiguration,
      responseFormat: contract.responseFormat,
      rubricLoader: contract.rubricLoader,
      response: {
        decisionIds: [...mixedCase.rubric.expectedDecisionIds],
        proofFactIds: [...mixedCase.rubric.expectedProofFactIds],
      },
    };

    expect(JSON.parse(prompt)).toEqual({
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
    expect(
      verifyEvaluationRecord({
        canonicalGuide: guide,
        evaluationCase: mixedCase,
        contract,
        record: mixedRecord,
      }),
    ).toEqual({ accepted: true, diagnostics: [] });
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
