import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  acceptedBoundaryDigest,
  reviewDispositionContext,
} from '../../src/review/planning-accepted-boundary.js';
import { PLANNING_ROLE_PRODUCT } from '../planning-role-fixtures.js';

const ticket = `---
id: CHILD
type: feature
scope:
  - preserve current approval
out_of_scope:
  - anonymous approval
parent: PARENT
parent_job: approval.BU1
milestone: M1
---
# Ticket
`;

describe('accepted boundary of a user decline', () => {
  it('excludes dispositions while tracking scope, parent job and milestone boundaries', () => {
    const before = acceptedBoundaryDigest(ticket, PLANNING_ROLE_PRODUCT);
    const withDisposition = ticket.replace(
      '---\n# Ticket',
      'review_dispositions:\n  - review_kind: plan-implementation\n    disposition: declined\n---\n# Ticket',
    );
    expect(acceptedBoundaryDigest(withDisposition, PLANNING_ROLE_PRODUCT)).toBe(before);
    expect(
      acceptedBoundaryDigest(
        ticket.replace('preserve current approval', 'expand approval'),
        PLANNING_ROLE_PRODUCT,
      ),
    ).not.toBe(before);
    expect(
      acceptedBoundaryDigest(
        ticket,
        PLANNING_ROLE_PRODUCT.replace(
          'Current approval advances.',
          'Current approval is attributable.',
        ),
      ),
    ).not.toBe(before);
    expect(
      acceptedBoundaryDigest(
        ticket,
        PLANNING_ROLE_PRODUCT.replace('Anonymous approval.', 'No anonymous or delegated approval.'),
      ),
    ).not.toBe(before);
  });
  it('keeps a decline current when parent boundary wording only changes Markdown emphasis', () => {
    expect(
      acceptedBoundaryDigest(
        ticket,
        PLANNING_ROLE_PRODUCT.replace('Anonymous approval.', '_Anonymous_ approval.'),
      ),
    ).toBe(acceptedBoundaryDigest(ticket, PLANNING_ROLE_PRODUCT));
  });

  it('preserves a recorded decline as superseded history after a boundary change', () => {
    const digest = acceptedBoundaryDigest(ticket, PLANNING_ROLE_PRODUCT);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ severity: 'warning', message: 'Optional audit export.' }))
      .digest('hex');
    const recorded = ticket.replace(
      '---\n# Ticket',
      () =>
        `review_dispositions:\n  - version: 1\n    review_id: prior-review\n    review_kind: plan-implementation\n    finding_fingerprint: ${fingerprint}\n    finding_severity: warning\n    finding_message: Optional audit export.\n    accepted_boundary_digest: ${digest}\n    disposition: declined\n    reason: outside scope\n---\n# Ticket`,
    );
    expect(
      reviewDispositionContext(recorded, PLANNING_ROLE_PRODUCT, 'plan-implementation')?.records[0]
        ?.boundary_status,
    ).toBe('current');
    expect(
      reviewDispositionContext(
        recorded.replace('preserve current approval', 'expanded approval'),
        PLANNING_ROLE_PRODUCT,
        'plan-implementation',
      )?.records[0]?.boundary_status,
    ).toBe('superseded');
    expect(
      reviewDispositionContext(recorded, PLANNING_ROLE_PRODUCT, 'quality-review')?.records,
    ).toEqual([]);
  });
  it('rejects a malformed recorded decline instead of silently hiding it', () => {
    const invalid = ticket.replace(
      '---\n# Ticket',
      () => 'review_dispositions:\n  - malformed\n---\n# Ticket',
    );
    expect(() =>
      reviewDispositionContext(invalid, PLANNING_ROLE_PRODUCT, 'quality-review'),
    ).toThrow('review dispositions are invalid');
  });
});
