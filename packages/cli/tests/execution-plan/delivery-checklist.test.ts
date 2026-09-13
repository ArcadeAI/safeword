import { describe, expect, it } from 'vitest';

import {
  createDeliveryStableDefinition,
  DELIVERY_CHECKLIST_CATEGORIES,
  normalizedExecutionPlanDigest,
  parseDeliveryChecklist,
  parseDeliveryPlanContract,
  parseProofSpecifications,
} from '../../src/execution-plan/delivery-checklist.js';

function completeChecklist(categories: readonly string[] = DELIVERY_CHECKLIST_CATEGORIES): string {
  const rows = categories.map(
    (category, index) =>
      `| item-${index + 1} | ${category} | Complete ${category} | contributor | proof-${index + 1} | open | missing | | |`,
  );
  return [
    '# Execution Plan',
    '',
    '## Delivery checklist',
    '',
    '<!-- safeword:delivery-checklist:v1 -->',
    '',
    '| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

function proofSpecifications(rows: readonly string[]): string {
  return [
    '# Execution Plan',
    '',
    '## Proof specifications',
    '',
    '| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

function completeDeliveryPlan(
  qualification: 'real_boundary' | 'partial_or_structural' = 'real_boundary',
): string {
  const proofs = DELIVERY_CHECKLIST_CATEGORIES.map(
    (_, index) =>
      `| proof-${index + 1} | command | integration | boundary ${index + 1} | ${index === 3 ? qualification : 'real_boundary'} | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test"]} |`,
  );
  return `${proofSpecifications(proofs)}\n${completeChecklist()}`;
}

describe('Delivery Checklist contract', () => {
  it('returns every item from a complete checklist in plan order', () => {
    const result = parseDeliveryChecklist(completeChecklist());

    expect(result).toMatchObject({
      ok: true,
      items: DELIVERY_CHECKLIST_CATEGORIES.map((category, index) => ({
        id: `item-${index + 1}`,
        category,
        owner: 'contributor',
        disposition: 'open',
        evidenceClass: 'missing',
      })),
    });
  });

  it('names every missing default category in canonical order', () => {
    const omitted = new Set(['testing', 'documentation']);
    const content = completeChecklist(
      DELIVERY_CHECKLIST_CATEGORIES.filter(category => !omitted.has(category)),
    );

    expect(parseDeliveryChecklist(content)).toEqual({
      ok: false,
      code: 'missing_categories',
      message: 'Delivery Checklist is missing categories: testing, documentation.',
      missingCategories: ['testing', 'documentation'],
    });
  });

  it('rejects duplicate checklist IDs instead of merging separate obligations', () => {
    const content = completeChecklist().replace('| item-2 |', '| item-1 |');

    expect(parseDeliveryChecklist(content)).toEqual({
      ok: false,
      code: 'duplicate_checklist_id',
      message: 'Delivery Checklist ID item-1 appears more than once.',
    });
  });

  it('keeps contributor-controlled work open when it is labeled pending human', () => {
    const content = completeChecklist().replace(
      '| item-4 | testing | Complete testing | contributor | proof-4 | open | missing | | |',
      '| item-4 | testing | Complete testing | contributor | proof-4 | pending_human | missing | | security-team |',
    );

    expect(parseDeliveryChecklist(content)).toEqual({
      ok: false,
      code: 'invalid_owner_disposition',
      message: 'Delivery Checklist item item-4 is contributor-owned and cannot be pending_human.',
    });
  });

  it.each([
    {
      name: 'complete without a receipt',
      row: '| item-4 | testing | Complete testing | contributor | proof-4 | complete | missing | | |',
      code: 'invalid_delivery_checklist',
      message: 'Delivery Checklist item item-4 has invalid fields for complete.',
    },
    {
      name: 'not applicable without a reason',
      row: '| item-4 | testing | Complete testing | contributor | | not_applicable | missing | | |',
      code: 'invalid_delivery_checklist',
      message: 'Delivery Checklist item item-4 has invalid fields for not_applicable.',
    },
    {
      name: 'not applicable with a proof claim',
      row: '| item-4 | testing | Complete testing | contributor | proof-4 | not_applicable | missing | | no runtime boundary |',
      code: 'invalid_delivery_checklist',
      message: 'Delivery Checklist item item-4 has invalid fields for not_applicable.',
    },
    {
      name: 'human work left open',
      row: '| item-4 | testing | Complete testing | human | | open | missing | | |',
      code: 'invalid_owner_disposition',
      message: 'Delivery Checklist item item-4 is human-owned and cannot be open.',
    },
    {
      name: 'human dependency with a proof claim',
      row: '| item-4 | testing | Complete testing | human | proof-4 | pending_human | missing | | security-team |',
      code: 'invalid_delivery_checklist',
      message: 'Delivery Checklist item item-4 has invalid fields for pending_human.',
    },
    {
      name: 'an open item with a compatibility assertion',
      row: '| item-4 | testing | Complete testing | contributor | proof-4 | open | reusable_earlier_revision | old-revision | receipt:r1; compatible: unchanged |',
      code: 'invalid_delivery_checklist',
      message: 'Delivery Checklist item item-4 has invalid fields for open.',
    },
  ])('rejects $name', ({ row, code, message }) => {
    const content = completeChecklist().replace(
      '| item-4 | testing | Complete testing | contributor | proof-4 | open | missing | | |',
      () => row,
    );

    expect(parseDeliveryChecklist(content)).toEqual({ ok: false, code, message });
  });
});

describe('Proof specifications contract', () => {
  it('parses retained command and review-receipt invocations without inventing defaults', () => {
    const content = proofSpecifications([
      '| unit-tests | command | unit | checklist parser | partial_or_structural | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test"]} |',
      '| plan-review | review_receipt | E2E | accepted execution plan | real_boundary | compatible_earlier_allowed | {"type":"review_receipt","kind":"plan-execution","targets":[".project/tickets/A639WN/execution-plan.md"]} |',
    ]);

    expect(parseProofSpecifications(content)).toEqual({
      ok: true,
      specifications: [
        {
          id: 'unit-tests',
          method: 'command',
          scope: 'unit',
          boundary: 'checklist parser',
          qualifiesAs: 'partial_or_structural',
          currency: 'current_required',
          invocation: {
            type: 'command',
            cwd: 'packages/cli',
            argv: ['bun', 'run', 'test'],
          },
        },
        {
          id: 'plan-review',
          method: 'review_receipt',
          scope: 'E2E',
          boundary: 'accepted execution plan',
          qualifiesAs: 'real_boundary',
          currency: 'compatible_earlier_allowed',
          invocation: {
            type: 'review_receipt',
            kind: 'plan-execution',
            targets: ['.project/tickets/A639WN/execution-plan.md'],
          },
        },
      ],
    });
  });

  it('rejects duplicate Proof IDs instead of making references ambiguous', () => {
    const content = proofSpecifications([
      '| same-proof | command | unit | parser | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test"]} |',
      '| same-proof | review_receipt | E2E | plan review | real_boundary | current_required | {"type":"review_receipt","kind":"plan-execution","targets":[".project/ticket.md"]} |',
    ]);

    expect(parseProofSpecifications(content)).toEqual({
      ok: false,
      code: 'duplicate_proof_id',
      message: 'Proof ID same-proof appears more than once.',
    });
  });
});

describe('Delivery Plan contract', () => {
  it('rejects a contributor obligation whose required proof is not a real-boundary proof', () => {
    expect(parseDeliveryPlanContract(completeDeliveryPlan('partial_or_structural'))).toEqual({
      ok: false,
      code: 'required_proof_not_real_boundary',
      message:
        'Delivery Checklist item item-4 requires proof-4, which is not a real-boundary proof.',
    });
  });

  it('requires proof specifications to appear before the checklist they define', () => {
    const content = `${completeChecklist()}\n${proofSpecifications(
      DELIVERY_CHECKLIST_CATEGORIES.map(
        (_, index) =>
          `| proof-${index + 1} | command | integration | boundary ${index + 1} | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test"]} |`,
      ),
    )}`;

    expect(parseDeliveryPlanContract(content)).toEqual({
      ok: false,
      code: 'invalid_proof_specifications',
      message: 'Proof specifications must appear before the Delivery Checklist.',
    });
  });

  it('snapshots stable planning identity while excluding mutable progress', () => {
    const content = completeDeliveryPlan()
      .replace(
        '| item-4 | testing | Complete testing | contributor | proof-4 | open | missing | | |',
        '| item-4 | testing | Complete testing | contributor | | not_applicable | missing | | no runtime boundary |',
      )
      .replace(
        '| item-10 | ownership and human dependencies | Complete ownership and human dependencies | contributor | proof-10 | open | missing | | |',
        '| item-10 | ownership and human dependencies | Approve the design | human | | pending_human | missing | | design-approval |',
      );
    const parsed = parseDeliveryPlanContract(content);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.message);

    const definition = createDeliveryStableDefinition(parsed, true);

    expect(definition).toMatchObject({
      schemaVersion: 1,
      designApprovalGate: true,
      specifications: parsed.specifications,
      items: [
        {},
        {},
        {},
        {
          id: 'item-4',
          owner: 'contributor',
          requiredProof: '',
          reviewedDisposition: {
            disposition: 'not_applicable',
            detail: 'no runtime boundary',
          },
        },
        {},
        {},
        {},
        {},
        {},
        {
          id: 'item-10',
          owner: 'human',
          requiredProof: '',
          reviewedDisposition: {
            disposition: 'pending_human',
            detail: 'design-approval',
          },
        },
        {},
      ],
    });
    expect(JSON.stringify(definition)).not.toContain('current_revision_real_boundary');
  });

  it('normalizes only ordinary checklist progress out of the complete plan identity', () => {
    const reviewed = completeDeliveryPlan().replace(
      '| item-4 | testing | Complete testing | contributor | proof-4 | open | missing | | |',
      '| item-4 | testing | Complete testing | contributor | | not_applicable | missing | | no runtime boundary |',
    );
    const progressed = reviewed.replace(
      '| item-5 | data and compatibility | Complete data and compatibility | contributor | proof-5 | open | missing | | |',
      '| item-5 | data and compatibility | Complete data and compatibility | contributor | proof-5 | complete | current_revision_real_boundary | abc123 | receipt:r1 |',
    );

    expect(normalizedExecutionPlanDigest(progressed)).toBe(normalizedExecutionPlanDigest(reviewed));
    expect(
      normalizedExecutionPlanDigest(
        reviewed.replace('Complete data and compatibility', 'Preserve compatible data'),
      ),
    ).not.toBe(normalizedExecutionPlanDigest(reviewed));
    expect(
      normalizedExecutionPlanDigest(reviewed.replace('no runtime boundary', 'different reason')),
    ).not.toBe(normalizedExecutionPlanDigest(reviewed));
  });
});
