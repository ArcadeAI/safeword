/**
 * Unit tests for the review-receipt decision core (ticket PB1GMZ).
 *
 * A stamp that claims an independent review must cite the coordinator review
 * that produced the verdict. Without this, the agent being reviewed is also the
 * only witness that a review happened — the failure that let a Codex session
 * skip the dispatch and leave an indistinguishable record.
 */

import { describe, expect, it } from 'vitest';

import { receiptGateVerdict } from '../../templates/hooks/lib/review-receipt.js';

const approved = {
  reviewId: 'b3f1c2d4-0000-4000-8000-000000000001',
  status: 'approved',
  kind: 'plan-implementation',
  targets: ['.project/tickets/T1-slug/impl-plan.md'],
};

describe('receiptGateVerdict — stamps that claim independence', () => {
  it('accepts an approving receipt whose targets cover the stamped artifact', () => {
    expect(
      receiptGateVerdict({ independence: 'cross-agent', artifact: 'impl-plan' }, approved),
    ).toEqual({ ok: true });
  });

  it('rejects a claim with no review id — the gap that shipped', () => {
    const verdict = receiptGateVerdict({ independence: 'cross-agent', artifact: 'impl-plan' });

    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.reason).toMatch(/--review-id/u);
  });

  it('rejects a receipt the coordinator reports as stale', () => {
    const verdict = receiptGateVerdict(
      { independence: 'cross-agent', artifact: 'impl-plan' },
      { ...approved, status: 'stale' },
    );

    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.reason).toMatch(/stale/iu);
  });

  it('rejects a receipt whose verdict was changes_requested', () => {
    expect(
      receiptGateVerdict(
        { independence: 'cross-agent', artifact: 'impl-plan' },
        { ...approved, status: 'changes_requested' },
      ).ok,
    ).toBe(false);
  });

  it('rejects a receipt for a different artifact', () => {
    const verdict = receiptGateVerdict({ independence: 'cross-agent', artifact: 'spec' }, approved);

    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.reason).toMatch(/impl-plan\.md/u);
  });

  it('binds a phase stamp to the review kind rather than a file', () => {
    const claim = { independence: 'cross-agent', phase: 'scenario-gate' } as const;

    expect(
      receiptGateVerdict(claim, {
        ...approved,
        kind: 'scenario-gate',
        targets: ['feature.feature'],
      }),
    ).toEqual({ ok: true });
    expect(receiptGateVerdict(claim, approved).ok).toBe(false);
  });

  it('holds a degraded stamp to the same receipt requirement', () => {
    expect(receiptGateVerdict({ independence: 'degraded', artifact: 'impl-plan' }).ok).toBe(false);
  });
});

describe('receiptGateVerdict — stamps that claim nothing', () => {
  it('leaves self-review alone: no independence claim needs no receipt', () => {
    expect(receiptGateVerdict({ artifact: 'spec' })).toEqual({ ok: true });
  });

  it('leaves a deliberate skip alone', () => {
    expect(
      receiptGateVerdict({ independence: 'cross-agent', artifact: 'spec', skip: true }),
    ).toEqual({ ok: true });
  });
});
