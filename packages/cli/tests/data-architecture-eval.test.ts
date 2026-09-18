import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  type AblationRecord,
  type EvaluationResponse,
  verifyAblationPair,
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

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).toSorted(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function record(
  guideContent: string,
  response: EvaluationResponse,
  overrides: Partial<AblationRecord> = {},
): AblationRecord {
  return {
    guideSha256: sha256(guideContent),
    caseRubricSha256: sha256(canonicalJson(rubric)),
    modelVersion: 'controlled-model-v1',
    decodingConfiguration: { temperature: 0, topP: 1 },
    responseFormat: 'data-architecture-eval-v1',
    rubricLoader: 'data-architecture-rubric-v1',
    response,
    ...overrides,
  };
}

describe('data architecture guide evaluation', () => {
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

  it('rejects a pair recorded through different response and rubric loaders', () => {
    const result = verifyAblationPair({
      ablationId: 'independent-proof',
      canonicalGuide: guide,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      rubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse, {
        responseFormat: 'different-response-v2',
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
      diagnostics: ['Full-guide response does not satisfy the evaluation rubric.'],
    });
  });
});
