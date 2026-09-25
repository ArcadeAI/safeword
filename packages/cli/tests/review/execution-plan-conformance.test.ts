import { describe, expect, it } from 'vitest';

import { filterExecutionPlanRoutes } from '../../src/review/execution-plan-conformance.js';
import type { ReviewRoute } from '../../src/review/policy.js';

describe('Execution Plan reviewer admission', () => {
  it('keeps an unproven route out of Execution Plan review', () => {
    const routes: ReviewRoute[] = [
      { reviewer: 'claude', model: 'unproven-model', independence: 'cross-agent' },
    ];

    expect(filterExecutionPlanRoutes('plan-execution', routes)).toEqual([]);
  });
});
