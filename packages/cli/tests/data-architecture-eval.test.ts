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

function record(guideContent: string, response: EvaluationResponse): AblationRecord {
  return {
    guideSha256: sha256(guideContent),
    caseRubricSha256: sha256(JSON.stringify(rubric)),
    modelVersion: 'controlled-model-v1',
    decodingConfiguration: { temperature: 0, topP: 1 },
    responseFormat: 'data-architecture-eval-v1',
    rubricLoader: 'data-architecture-rubric-v1',
    response,
  };
}

describe('data architecture guide evaluation', () => {
  it('accepts a discriminating independent-proof guide ablation', () => {
    const result = verifyAblationPair({
      canonicalGuide: guide,
      storedAblatedGuide: ablatedGuide,
      preservedDecisionIds: ['decision.core.independent-proof'],
      rubric,
      fullGuideRecord: record(guide, fullResponse),
      ablatedGuideRecord: record(ablatedGuide, ablatedResponse),
    });

    expect(result).toEqual({ accepted: true, diagnostics: [] });
  });
});
