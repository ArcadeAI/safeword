import { describe, expect, it } from 'vitest';

import { EXECUTION_PREREQUISITE_REPAIR_CODES } from '../../src/commands/execution-prerequisite.js';

describe('delivery checklist recovery contract', () => {
  it('publishes every execution prerequisite repair code in planning order', () => {
    expect(EXECUTION_PREREQUISITE_REPAIR_CODES).toEqual([
      'missing_accepted_scenarios',
      'missing_accepted_approach',
      'missing_admitted_delivery_checklist',
    ]);
    expect(new Set(EXECUTION_PREREQUISITE_REPAIR_CODES).size).toBe(
      EXECUTION_PREREQUISITE_REPAIR_CODES.length,
    );
  });
});
