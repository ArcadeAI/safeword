import { describe, expect, it } from 'vitest';

import type { ReviewPacket, UnverifiedReviewerOutput } from '../../src/review/contract.js';
import { assemblePlanContract } from '../../src/review/packet.js';
import { PLAN_REVIEW_RUBRIC } from '../../src/review/plan-rubric.generated.js';
import { PRODUCT_PLAN_REVIEW_RUBRIC } from '../../src/review/product-plan-rubric.generated.js';
import { reconcilePlanContract } from '../../src/review/runtime.js';

const approved: UnverifiedReviewerOutput = {
  schema_version: 1,
  dispatch_id: 'dispatch-1',
  reviewer_agent: 'claude',
  verdict: 'approve',
  summary: 'Approved.',
  findings: [],
};

function packet(kind: 'quality-review' | 'plan-implementation', rubric: string): ReviewPacket {
  return {
    schema_version: 1,
    dispatch_id: 'dispatch-1',
    kind,
    logical_files: [],
    ...(kind === 'quality-review' && { planning_phase: 'product-plan' as const }),
    plan_contract: assemblePlanContract(rubric, rubric),
  };
}

describe('canonical planning contract reconciliation', () => {
  it.each([
    ['quality-review', PRODUCT_PLAN_REVIEW_RUBRIC],
    ['plan-implementation', PLAN_REVIEW_RUBRIC],
  ] as const)('rejects matching noncanonical %s copies', (kind, rubric) => {
    const changed = `${rubric}\nUnreviewed contract change.`;
    const result = reconcilePlanContract(packet(kind, changed), approved);

    expect(result.verdict).toBe('request_changes');
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        message: expect.stringContaining('canonical contract-byte identity'),
      }),
    );
  });

  it('admits the canonical Product contract', () => {
    expect(
      reconcilePlanContract(packet('quality-review', PRODUCT_PLAN_REVIEW_RUBRIC), approved),
    ).toBe(approved);
  });
});
