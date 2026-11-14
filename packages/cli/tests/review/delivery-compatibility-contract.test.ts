import { describe, expect, it } from 'vitest';

import { isReviewKind } from '../../src/review/contract.js';
import { reviewPromptContract } from '../../src/review/review-rubric.js';
import { reviewOutputSchema } from '../../src/review/runtime.js';

describe('delivery compatibility review contract', () => {
  it('uses a dedicated review kind and judgment without widening reviewer output', () => {
    expect(isReviewKind('delivery-compatibility')).toBe(true);

    const prompt = reviewPromptContract('delivery-compatibility');
    expect(prompt).toContain('Earlier delivery-proof compatibility judgment');
    expect(prompt).toContain('Does the earlier passing receipt still establish this');
    expect(prompt).not.toContain('Shared execution-plan judgment standard');
    expect(reviewOutputSchema('delivery-compatibility')).toBe(reviewOutputSchema('quality-review'));
  });
});
