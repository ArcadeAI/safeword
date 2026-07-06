/**
 * Unit tests for the boundary engine's resolver-failure path (CDRJTW,
 * SM1.AC2 "A failing SHA resolution is recorded as indeterminate, never a
 * crash"). Pure — a stub resolver that throws stands in for git breaking
 * mid-run; the command layer's exit-0 wrapper is proven in the command suites.
 */

import { describe, expect, it } from 'vitest';

import { reconcileChange, type TicketChange } from '../../src/boundary/engine.js';

function ticketContent(phase: string, anchors?: string[]): string {
  const lines = ['---', 'id: ZZENG', 'type: feature', `phase: ${phase}`, 'status: in_progress'];
  if (anchors) {
    lines.push('phase_anchors:');
    for (const entry of anchors) lines.push(`  - ${entry}`);
  }
  lines.push('---', '', '# Fixture', '');
  return lines.join('\n');
}

const throwingResolver = () => {
  throw new Error('git exploded mid-run');
};

describe('boundary engine — resolver failure degrades to indeterminate', () => {
  it('anchor reachability becomes indeterminate when the resolver throws', () => {
    const change: TicketChange = {
      ticketFolder: 'ENG001-fixture',
      artifacts: [
        {
          artifact: 'ticket.md',
          prior: ticketContent('define-behavior'),
          proposed: ticketContent('implement', ['implement: a1b2c3d']),
        },
      ],
      ticketCurrent: ticketContent('implement', ['implement: a1b2c3d']),
      hasLedger: true,
    };

    const [reconciliation] = reconcileChange([change], throwingResolver);

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
      ticketCurrent: ticketContent('implement', ['implement: a1b2c3d']),
      hasLedger: true,
    };

    const [reconciliation] = reconcileChange([change], throwingResolver);

    const format = reconciliation?.checks.find(c => c.check === 'ledger-format');
    expect(format?.verdict).toBe('indeterminate');
  });
});
