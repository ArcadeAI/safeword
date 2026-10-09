import { describe, expect, it } from 'vitest';

import { planningSkipReason } from '../../src/review/planning-context-identity.js';

describe('Implementation applicability declarations', () => {
  it('retains a justified depth-two skip', () => {
    expect(
      planningSkipReason(
        '# Plan\n\n## Data applicability\n\nskip: No data is stored.\n',
        'Data applicability',
      ),
    ).toBe('No data is stored.');
  });
  it('accepts the shipped template depth-three Data declaration as applicable', () => {
    const plan =
      '# Plan\n\n## Approach\n\n### Data applicability\n\nData applicability: review provenance changes a durable schema.\n\n- **Purpose:** authenticate the current scope.\n';
    expect(planningSkipReason(plan, 'Data applicability')).toBeUndefined();
  });
  it('recognizes the shipped template inline Architecture skip', () => {
    const plan =
      '# Plan\n\n## Design alignment\n\nArchitecture applicability: skip: No durable architecture record applies.\n';
    expect(planningSkipReason(plan, 'Architecture applicability')).toBe(
      'No durable architecture record applies.',
    );
  });
  it('does not interpret unrelated prose as an Architecture declaration', () => {
    const plan =
      '# Plan\n\n## Approach\n\nA code example says `Architecture applicability: skip: pretend`.\n\n## Design alignment\n\nThe current decisions still apply.\n';
    expect(() => planningSkipReason(plan, 'Architecture applicability')).toThrow();
  });
});
