import { describe, expect, it } from 'vitest';

import {
  DELIVERY_CHECKLIST_CATEGORIES,
  parseDeliveryChecklist,
} from '../../src/execution-plan/delivery-checklist.js';

function completeChecklist(): string {
  const rows = DELIVERY_CHECKLIST_CATEGORIES.map(
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
});
