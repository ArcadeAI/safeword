import { describe, expect, it } from 'vitest';

import { reviewerPromptInstructions } from '../../src/review/review-rubric.js';

const prompts = [
  reviewerPromptInstructions('quality-review', 'claude', 'product-plan'),
  reviewerPromptInstructions('plan-implementation', 'claude', 'plan-implementation'),
  reviewerPromptInstructions('plan-execution', 'claude', 'plan-execution'),
];

describe('planning scope review contract', () => {
  it('asks every phase to check both omissions and overreach against accepted authority', () => {
    for (const prompt of prompts) {
      expect(prompt).toContain('ticket scope');
      expect(prompt).toContain('project non-goals');
      expect(prompt).toContain('milestone non-goals');
      expect(prompt).toContain('inherited parent boundaries');
      expect(prompt).toContain('in-scope omissions');
      expect(prompt).toContain('out-of-scope additions');
      expect(prompt).toContain('nonblocking suggestion');
      expect(prompt).toContain('fresh review of the changed bytes');
    }
  });

  it('makes persona outcomes and epistemic status Product approval questions', () => {
    const product = prompts[0] ?? '';
    for (const outcome of ['success', 'refusal', 'failure', 'approval', 'trust', 'recovery'])
      expect(product).toContain(outcome);
    expect(product).toContain('known facts');
    expect(product).toContain('assumptions');
    expect(product).toContain('unresolved product decisions');
    expect(product).toMatch(/scenario\s+coverage\s+belongs\s+to\s+scenario\s+review/iu);
  });

  it('treats external guidance as candidate decisions within the accepted boundary', () => {
    for (const prompt of prompts.slice(1)) {
      expect(prompt).toContain('architecture, data, testing, domain, and research guidance');
      expect(prompt).toContain('candidate decisions');
      expect(prompt).toContain('user-owned scope choice');
    }
  });
});
