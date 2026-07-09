/**
 * Unit tests for the boundary engine's failure paths and tier behavior
 * (CDRJTW, re-expressed by HGYGND for artifact-content anchors). Pure — a
 * stub artifact reader / SHA resolver that throws stands in for git breaking
 * mid-run; the command layer's exit-0 wrapper is proven in the command suites.
 */

import { describe, expect, it } from 'vitest';

import { reconcileChange, type TicketChange } from '../../src/boundary/engine.js';
import { boundaryTicketContent, shapeValidImplPlan } from './boundary-helpers';

const IMPL_PLAN = '.project/tickets/ENG001-fixture/impl-plan.md';

function ticketContent(phase: string, anchors?: string[]): string {
  return boundaryTicketContent({ id: 'ZZENG', phase, anchors });
}

function advanceChange(anchors: string[] | undefined): TicketChange {
  return {
    ticketFolder: 'ENG001-fixture',
    artifacts: [
      {
        artifact: 'ticket.md',
        prior: ticketContent('scenario-gate'),
        proposed: ticketContent('implement', anchors),
      },
    ],
    ticketCurrent: ticketContent('implement', anchors),
    hasLedger: true,
  };
}

const throwingReader = () => {
  throw new Error('git exploded mid-run');
};

const throwingResolver = () => {
  throw new Error('git exploded mid-run');
};

describe('boundary engine — reader/resolver failure degrades to indeterminate', () => {
  it('anchor verification becomes indeterminate when the artifact reader throws', () => {
    const [reconciliation] = reconcileChange(
      [advanceChange([`implement: ${IMPL_PLAN}`])],
      undefined,
      throwingReader,
    );

    const anchor = reconciliation?.checks.find(c => c.check === 'phase-anchor');
    expect(anchor?.verdict).toBe('indeterminate');
    expect(anchor?.detail).toMatch(/could not be determined/i);
  });

  it('ledger reachability becomes indeterminate when the resolver throws', () => {
    const ledger = [
      '# Test Definitions',
      '',
      '### Scenario: s1',
      '',
      '- [x] RED a1b2c3d',
      '- [ ] GREEN',
      '- [ ] REFACTOR',
      '',
    ].join('\n');
    const change: TicketChange = {
      ticketFolder: 'ENG002-fixture',
      artifacts: [{ artifact: 'test-definitions.md', proposed: ledger }],
      ticketCurrent: ticketContent('implement', [`implement: ${IMPL_PLAN}`]),
      hasLedger: true,
    };

    const [reconciliation] = reconcileChange([change], throwingResolver);

    const format = reconciliation?.checks.find(c => c.check === 'ledger-format');
    expect(format?.verdict).toBe('indeterminate');
  });
});

describe('boundary engine — anchor verification is tree-only', () => {
  it('a path anchor whose artifact the reader supplies passes', () => {
    const [reconciliation] = reconcileChange(
      [advanceChange([`implement: ${IMPL_PLAN}`])],
      undefined,
      relpath => (relpath === IMPL_PLAN ? shapeValidImplPlan() : undefined),
    );

    const anchor = reconciliation?.checks.find(c => c.check === 'phase-anchor');
    expect(anchor?.verdict).toBe('pass');
  });

  it('a path anchor with no reader passes on format alone (write-time mode)', () => {
    const [reconciliation] = reconcileChange([advanceChange([`implement: ${IMPL_PLAN}`])]);

    const anchor = reconciliation?.checks.find(c => c.check === 'phase-anchor');
    expect(anchor?.verdict).toBe('pass');
  });

  it('a hex-shaped legacy anchor on a transition warns toward the path grammar at any tier', () => {
    const [reconciliation] = reconcileChange([advanceChange(['implement: deadbee'])]);

    const anchor = reconciliation?.checks.find(c => c.check === 'phase-anchor');
    expect(anchor?.verdict).toBe('warn');
    expect(anchor?.detail).toMatch(/artifact path/i);
  });
});
