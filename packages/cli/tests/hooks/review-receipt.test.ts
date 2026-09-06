/**
 * Unit tests for the review-receipt decision core (ticket PB1GMZ).
 *
 * A stamp that claims an independent review must cite the coordinator review
 * that produced the verdict. Without this, the agent being reviewed is also the
 * only witness that a review happened — the failure that let a Codex session
 * skip the dispatch and leave an indistinguishable record.
 *
 * Citing *a* real review is not enough: the cited one has to be the review of
 * THIS ticket's work, at the independence it claims. The cross-ticket and
 * provenance cases below are the ways a real-but-unrelated approval could
 * otherwise stand in.
 */

import { describe, expect, it } from 'vitest';

import { hashArtifact, reviewScope } from '../../templates/hooks/lib/review-ledger.js';
import { claimFromScope, receiptGateVerdict } from '../../templates/hooks/lib/review-receipt.js';

const TICKET = 'T1-slug';

const approved = {
  reviewId: 'b3f1c2d4-0000-4000-8000-000000000001',
  status: 'approved',
  kind: 'plan-implementation',
  targets: [`.project/tickets/${TICKET}/impl-plan.md`],
  independence: 'cross-agent',
  authorAgent: 'codex',
  actualReviewer: 'claude',
};

const claimFor = (extra: Record<string, unknown>) => ({
  independence: 'cross-agent',
  ticketFolder: TICKET,
  projectDirectory: '/repo',
  ticketDirectory: `/repo/.project/tickets/${TICKET}`,
  ...extra,
});

describe('receiptGateVerdict — stamps that claim independence', () => {
  it('accepts an approving receipt whose targets cover the stamped artifact', () => {
    expect(receiptGateVerdict(claimFor({ artifact: 'impl-plan' }), approved)).toEqual({ ok: true });
  });

  it('rejects a claim with no review id — the gap that shipped', () => {
    const verdict = receiptGateVerdict(claimFor({ artifact: 'impl-plan' }));

    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.reason).toMatch(/--review-id/u);
  });

  it('rejects a receipt the coordinator reports as stale', () => {
    const verdict = receiptGateVerdict(claimFor({ artifact: 'impl-plan' }), {
      ...approved,
      status: 'stale',
    });

    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.reason).toMatch(/stale/iu);
  });

  it('rejects a receipt whose verdict was changes_requested', () => {
    expect(
      receiptGateVerdict(claimFor({ artifact: 'impl-plan' }), {
        ...approved,
        status: 'changes_requested',
      }).ok,
    ).toBe(false);
  });

  it('rejects a receipt for a different artifact', () => {
    const verdict = receiptGateVerdict(claimFor({ artifact: 'spec' }), approved);

    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.reason).toMatch(/spec\.md/u);
  });

  it('binds a phase stamp to the review kind rather than a file', () => {
    const claim = claimFor({ phase: 'scenario-gate' });

    expect(
      receiptGateVerdict(claim, {
        ...approved,
        kind: 'scenario-gate',
        targets: [`.project/tickets/${TICKET}/feature.feature`],
      }),
    ).toEqual({ ok: true });
    expect(receiptGateVerdict(claim, approved).ok).toBe(false);
  });

  it('holds a degraded stamp to the same receipt requirement', () => {
    expect(
      receiptGateVerdict(claimFor({ independence: 'degraded', artifact: 'impl-plan' })).ok,
    ).toBe(false);
  });
});

describe('receiptGateVerdict — a real review of the wrong work', () => {
  it("rejects an artifact stamp citing another ticket's review of the same filename", () => {
    const verdict = receiptGateVerdict(claimFor({ artifact: 'impl-plan' }), {
      ...approved,
      targets: ['.project/tickets/T2-other/impl-plan.md'],
    });

    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.reason).toMatch(/T1-slug\/impl-plan\.md/u);
  });

  it("rejects a phase stamp citing another ticket's review of the same phase", () => {
    const verdict = receiptGateVerdict(claimFor({ phase: 'scenario-gate' }), {
      ...approved,
      kind: 'scenario-gate',
      targets: ['.project/tickets/T2-other/feature.feature'],
    });

    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.reason).toMatch(/T1-slug/u);
  });

  it.each([
    `.project/tickets/T2-other/../T1-slug/impl-plan.md`,
    '.project/tickets/T1-slug/../T2-other/impl-plan.md',
    '.project/tickets/T1-slug/nested/impl-plan.md',
    String.raw`.project\tickets\T2-other\impl-plan.md`,
  ])('resolves traversal and nesting before binding an artifact: %j', target => {
    // The first row names T1 only after a `..` that leaves it; the third is a
    // real T1 path but not the ticket's own copy. Text matching admits both.
    const verdict = receiptGateVerdict(claimFor({ artifact: 'impl-plan' }), {
      ...approved,
      targets: [target],
    });

    expect(verdict.ok).toBe(target === `.project/tickets/T2-other/../T1-slug/impl-plan.md`);
  });

  it('resolves traversal before binding a phase stamp to its ticket', () => {
    expect(
      receiptGateVerdict(claimFor({ phase: 'scenario-gate' }), {
        ...approved,
        kind: 'scenario-gate',
        targets: ['.project/tickets/T1-slug/../T2-other/feature.feature'],
      }).ok,
    ).toBe(false);
  });

  it('does not let a similarly-named ticket folder satisfy the binding', () => {
    expect(
      receiptGateVerdict(claimFor({ artifact: 'impl-plan' }), {
        ...approved,
        targets: [`.project/tickets/${TICKET}-extended/impl-plan.md`],
      }).ok,
    ).toBe(false);
  });

  it.each([
    `/tmp/decoy/${TICKET}/impl-plan.md`,
    `docs/${TICKET}/impl-plan.md`,
    `../../${TICKET}/impl-plan.md`,
  ])('rejects a reviewed decoy outside the configured tickets root: %j', target => {
    expect(
      receiptGateVerdict(claimFor({ artifact: 'impl-plan' }), {
        ...approved,
        targets: [target],
      }).ok,
    ).toBe(false);
  });
});

describe('receiptGateVerdict — provenance the stamp claims', () => {
  it('refuses to write a degraded review up as cross-agent', () => {
    const verdict = receiptGateVerdict(claimFor({ artifact: 'impl-plan' }), {
      ...approved,
      independence: 'degraded',
    });

    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.reason).toMatch(/degraded/u);
  });

  it('fails closed when the receipt records no independence at all', () => {
    expect(
      receiptGateVerdict(claimFor({ artifact: 'impl-plan' }), {
        ...approved,
        independence: undefined,
      }).ok,
    ).toBe(false);
  });

  it('rejects a stamp naming a reviewer the coordinator did not use', () => {
    const verdict = receiptGateVerdict(
      claimFor({ artifact: 'impl-plan', reviewerAgent: 'codex' }),
      approved,
    );

    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.reason).toMatch(/reviewer/u);
  });

  it('rejects a stamp naming an author the coordinator did not record', () => {
    expect(
      receiptGateVerdict(claimFor({ artifact: 'impl-plan', authorAgent: 'claude' }), approved).ok,
    ).toBe(false);
  });

  it('accepts provenance flags that match the receipt', () => {
    expect(
      receiptGateVerdict(
        claimFor({ artifact: 'impl-plan', authorAgent: 'codex', reviewerAgent: 'claude' }),
        approved,
      ),
    ).toEqual({ ok: true });
  });
});

describe('receiptGateVerdict — stamps that claim nothing', () => {
  it('leaves self-review alone: no independence claim needs no receipt', () => {
    expect(
      receiptGateVerdict({
        artifact: 'spec',
        ticketFolder: TICKET,
        projectDirectory: '/repo',
        ticketDirectory: `/repo/.project/tickets/${TICKET}`,
      }),
    ).toEqual({ ok: true });
  });

  it('leaves a deliberate skip alone', () => {
    expect(receiptGateVerdict(claimFor({ artifact: 'spec', skip: true }))).toEqual({ ok: true });
  });
});

describe('claimFromScope — rebuilding a written stamp’s claim', () => {
  it('reads an artifact scope back into its ticket and artifact', () => {
    expect(
      claimFromScope('T1-slug:impl-plan@a1b2c3d4e5f6', {
        projectDirectory: '/repo',
        ticketDirectory: `/repo/.project/tickets/${TICKET}`,
      }),
    ).toEqual({
      ticketFolder: 'T1-slug',
      artifact: 'impl-plan',
      projectDirectory: '/repo',
      ticketDirectory: `/repo/.project/tickets/${TICKET}`,
    });
  });

  it('reads a phase scope back into its ticket and phase', () => {
    expect(
      claimFromScope('T1-slug:phase@scenario-gate', {
        projectDirectory: '/repo',
        ticketDirectory: `/repo/.project/tickets/${TICKET}`,
      }),
    ).toEqual({
      ticketFolder: 'T1-slug',
      phase: 'scenario-gate',
      projectDirectory: '/repo',
      ticketDirectory: `/repo/.project/tickets/${TICKET}`,
    });
  });

  it('carries the provenance the stamp recorded', () => {
    expect(
      claimFromScope('T1-slug:impl-plan@a1b2c3', {
        projectDirectory: '/repo',
        ticketDirectory: `/repo/.project/tickets/${TICKET}`,
        independence: 'cross-agent',
        authorAgent: 'codex',
        reviewerAgent: 'claude',
      }),
    ).toEqual({
      ticketFolder: 'T1-slug',
      artifact: 'impl-plan',
      projectDirectory: '/repo',
      ticketDirectory: `/repo/.project/tickets/${TICKET}`,
      independence: 'cross-agent',
      authorAgent: 'codex',
      reviewerAgent: 'claude',
    });
  });

  it.each(['', 'no-separators', 'T1-slug:impl-plan', ':impl-plan@hash', 'T1-slug:@hash'])(
    'refuses to read a malformed scope, so it cannot satisfy a gate: %j',
    scope => {
      expect(
        claimFromScope(scope, {
          projectDirectory: '/repo',
          ticketDirectory: `/repo/.project/tickets/${TICKET}`,
        }),
      ).toBeUndefined();
    },
  );

  it('round-trips a scope the ledger built, and the receipt then witnesses it', () => {
    const scope = reviewScope(TICKET, 'impl-plan', hashArtifact('plan body'));
    const claim = claimFromScope(scope, {
      projectDirectory: '/repo',
      ticketDirectory: `/repo/.project/tickets/${TICKET}`,
      independence: 'cross-agent',
    });

    expect(claim).toBeDefined();
    expect(claim === undefined ? undefined : receiptGateVerdict(claim, approved)).toEqual({
      ok: true,
    });
  });
});
