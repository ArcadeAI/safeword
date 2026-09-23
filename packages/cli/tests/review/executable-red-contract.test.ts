import { describe, expect, it } from 'vitest';

import { isReviewKind } from '../../src/review/contract.js';

describe('executable RED review contract', () => {
  it('accepts executable-red as a review kind', () => {
    expect(isReviewKind('executable-red')).toBe(true);
  });

  it('accepts plan-execution as a receipt kind', () => {
    expect(isReviewKind('plan-execution')).toBe(true);
  });
});
