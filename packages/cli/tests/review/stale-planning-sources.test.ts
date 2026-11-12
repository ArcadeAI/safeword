import { describe, expect, it } from 'vitest';

import { changedPlanningSources } from '../../src/review/job.js';
import type { PlanningReviewIdentity } from '../../src/review/planning-role-context.js';

function identity(
  dependencies: { role: string; path: string; semantic_digest: string }[],
  targets = [{ path: 'impl-plan.md', digest: 't1' }],
): PlanningReviewIdentity {
  return { dependencies, targets } as unknown as PlanningReviewIdentity;
}

const ticket = { role: 'ticket', path: 'ticket.md', semantic_digest: 'a' };

describe('stale planning diagnostics', () => {
  it('names a changed dependency', () => {
    expect(
      changedPlanningSources(identity([ticket]), identity([{ ...ticket, semantic_digest: 'b' }])),
    ).toEqual(['ticket ticket.md']);
  });

  it('names an added and a removed dependency', () => {
    const architecture = { role: 'architecture', path: 'ARCH.md', semantic_digest: 'c' };
    expect(changedPlanningSources(identity([ticket]), identity([ticket, architecture]))).toEqual([
      'architecture ARCH.md',
    ]);
    expect(changedPlanningSources(identity([ticket, architecture]), identity([ticket]))).toEqual([
      'architecture ARCH.md',
    ]);
  });

  it('names a changed target and nothing when an identity is missing', () => {
    expect(
      changedPlanningSources(
        identity([ticket]),
        identity([ticket], [{ path: 'impl-plan.md', digest: 't2' }]),
      ),
    ).toEqual(['target impl-plan.md']);
    expect(changedPlanningSources(undefined, identity([ticket]))).toEqual([]);
  });
});
