import { describe, expect, it } from 'vitest';

import { executionDiscoveryNotice } from '../../src/commands/plan-approval.js';
import { semanticTicketIdentity } from '../../src/review/planning-context-identity.js';
import { appendWorkLogEntry } from '../../templates/hooks/lib/work-log-stamp.js';

// Issue #5766: ticket bookkeeping must not stale planning approvals, while
// changes to the agreed contract (and deliberate invalidation notices) must.
const ticket = `---
id: TEST01
type: feature
phase: plan-execution
status: in_progress
scope:
  - convert temperatures, see [requirements][req]
out_of_scope:
  - Rankine
done_when:
  - scenarios pass
phase_anchors:
  - scenario-gate: features/tempconv.feature
---

# Ticket

**Goal:** Convert a CSV of temperatures.

## Work Log

- 2026-11-09T00:08:45.819Z Started: Created ticket TEST01

[req]: https://example.com/requirements-v1
`;

const kinds = ['scenario-gate', 'plan-implementation', 'plan-execution'] as const;

function expectSame(before: string, after: string): void {
  expect(after, 'the mutation must change the source').not.toBe(before);
  for (const kind of kinds) {
    expect(semanticTicketIdentity(after, kind), kind).toBe(semanticTicketIdentity(before, kind));
  }
}

function expectChanged(before: string, after: string): void {
  for (const kind of kinds) {
    expect(semanticTicketIdentity(after, kind), kind).not.toBe(
      semanticTicketIdentity(before, kind),
    );
  }
}

describe('ticket journal does not stale planning approvals', () => {
  it('ignores the phase line the work-log hook appends', () => {
    const after = appendWorkLogEntry(
      ticket.replace('phase: plan-execution', 'phase: implement'),
      '- 2026-11-09T01:28:11.624Z Phase: plan-execution → implement',
    );
    expectSame(ticket, after);
  });

  it('ignores a recorded phase anchor', () => {
    expectSame(
      ticket,
      ticket.replace(
        '  - scenario-gate: features/tempconv.feature\n',
        '  - scenario-gate: features/tempconv.feature\n  - plan-execution: execution-plan.md\n',
      ),
    );
  });

  it('ignores agent-written journal paragraphs and multi-line entries', () => {
    const after = appendWorkLogEntry(
      appendWorkLogEntry(
        ticket,
        '- Ledger correction: GREEN is recorded as `8f0f1d07`, a\n  typo.',
      ),
      '\nNarrative note about the correction.',
    );
    expectSame(ticket, after);
  });

  it('ignores journal entries appended after an execution-discovery notice', () => {
    const notice = executionDiscoveryNotice({
      destination: 'plan-implementation',
      reviewId: 'review-1',
      findings: ['Repair the affected plan.'],
    });
    const discovered = `${ticket}${notice}`;
    expectSame(
      discovered,
      appendWorkLogEntry(
        discovered,
        '- 2026-11-09T02:00:00.000Z Phase: plan-implementation → plan-execution',
      ),
    );
  });
});

describe('ticket contract changes still stale planning approvals', () => {
  it('counts the execution-discovery notice', () => {
    const notice = executionDiscoveryNotice({
      destination: 'plan-implementation',
      reviewId: 'review-1',
      findings: ['Repair the affected plan.'],
    });
    expectChanged(ticket, `${ticket}${notice}`);
  });

  it('counts scope, out_of_scope, done_when and goal edits', () => {
    expectChanged(ticket, ticket.replace('  - Rankine', '  - Rankine\n  - Kelvin'));
    expectChanged(ticket, ticket.replace('convert temperatures', 'convert and round temperatures'));
    expectChanged(ticket, ticket.replace('scenarios pass', 'scenarios and lint pass'));
    expectChanged(ticket, ticket.replace('a CSV of temperatures', 'a CSV of pressures'));
  });

  it('counts a changed reference destination stored in the Work Log', () => {
    expectChanged(ticket, ticket.replace('requirements-v1', 'requirements-v2'));
  });

  it('counts a changed reference destination nested in a Work Log list item', () => {
    const nested = ticket.replace(
      '\n[req]: https://example.com/requirements-v1\n',
      '- Linked the requirements.\n\n  [req]: https://example.com/requirements-v1\n',
    );
    expectChanged(nested, nested.replace('requirements-v1', 'requirements-v2'));
  });

  it('counts content in a section after the Work Log', () => {
    const later = `${ticket}\n## Decisions\n\nKeep two decimals.\n`;
    expectChanged(later, later.replace('two decimals', 'three decimals'));
  });

  it('counts an unknown frontmatter field', () => {
    expectChanged(
      ticket,
      ticket.replace('status: in_progress', 'status: in_progress\nowner: dana'),
    );
  });
});
