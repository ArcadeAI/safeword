import { expect, it } from 'vitest';

import { SOULLESS_RETROSPECTIVE_POLICY as policy } from '../../src/review/retrospective-policy.js';
import { reviewerPromptInstructions } from '../../src/review/review-rubric.js';

it.each(['retrospective-eligibility', 'retrospective-proof'] as const)(
  'gives the %s reviewer the source-enrolled Electron boundary',
  kind => {
    const instructions = reviewerPromptInstructions(kind, 'claude');
    expect(instructions).toContain(policy.id);
    expect(instructions).toContain(policy.repository);
    expect(instructions).toContain(policy.cutoff);
    expect(instructions).toContain(policy.ledger);
    expect(instructions).toContain(policy.feature);
    for (const heading of policy.scenarios) expect(instructions).toContain(heading);
    expect(instructions).toContain('CKWE2D');
    expect(instructions).not.toContain('Review only the CKWE2D retrospective migration.');
  },
);
