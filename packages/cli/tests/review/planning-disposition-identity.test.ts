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

  it('keeps planning approvals current when branch-review bookkeeping changes', () => {
    const original = `${before}\n## Work Log\n\n- Earlier review.\n`;
    const updated = original
      .replace('type: feature', 'type: feature\nbranch_review_exit_id: new-review')
      .replace('- Earlier review.', '- Latest review.');
    expect(semanticTicketIdentity(updated, 'scenario-gate')).toBe(
      semanticTicketIdentity(original, 'scenario-gate'),
    );
    expect(
      semanticTicketIdentity(updated.replace('preserve approved behavior', 'change goals')),
    ).not.toBe(semanticTicketIdentity(original));
  });
});
