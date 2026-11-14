import { describe, expect, it } from 'vitest';

import { semanticTicketIdentity } from '../../src/review/planning-context-identity.js';

const before =
  '---\nid: TEST\ntype: feature\nscope:\n  - preserve approved behavior\n---\n# Ticket\n';
const after =
  '---\nid: TEST\ntype: feature\nscope:\n  - preserve approved behavior\nreview_dispositions:\n  - version: 1\n    review_kind: plan-implementation\n    finding_fingerprint: abc\n    accepted_boundary_digest: def\n    disposition: declined\n    reason: outside scope\n---\n# Ticket\n';

describe('planning disposition currency', () => {
  it('stales only a review of the disposition’s own kind', () => {
    expect(semanticTicketIdentity(after, 'plan-implementation')).not.toBe(
      semanticTicketIdentity(before, 'plan-implementation'),
    );
    expect(semanticTicketIdentity(after, 'quality-review')).toBe(
      semanticTicketIdentity(before, 'quality-review'),
    );
    expect(semanticTicketIdentity(after, 'plan-execution')).toBe(
      semanticTicketIdentity(before, 'plan-execution'),
    );
  });
});
