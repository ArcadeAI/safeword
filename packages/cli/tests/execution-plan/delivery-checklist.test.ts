import { describe, expect, it } from 'vitest';

import {
  DELIVERY_CHECKLIST_CATEGORIES,
  parseDeliveryChecklist,
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
});
