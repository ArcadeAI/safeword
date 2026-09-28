import { describe, expect, it } from 'vitest';

import type { ReviewPacket } from '../../src/review/contract.js';
import { productParentContextIdentity } from '../../src/review/planning-context-identity.js';

const ticketPath = '.project/tickets/OWN123-owned/ticket.md';
const ticket =
  '---\nid: OWN123\ntype: feature\nphase: intake\nstatus: in_progress\nlast_modified: yesterday\nproduct_plan_contract: v1\nscope: preserve approval\nout_of_scope: anonymous approval\ndone_when: current approval advances\n---\n# Ticket\n\nPreserve authentication.\n';

function projected(content: string) {
  const packet: ReviewPacket = {
    schema_version: 1,
    dispatch_id: 'implementation-ticket-identity',
    kind: 'plan-implementation',
    planning_phase: 'plan-implementation',
    planning_context: {
      schema_version: 1,
      ticket_id: 'OWN123',
      ticket_path: ticketPath,
      dependencies: [{ role: 'ticket', path: ticketPath }],
      absences: [],
    },
    logical_files: [{ path: '.project/tickets/OWN123-owned/impl-plan.md', content: '# Impl Plan' }],
    context_files: [{ path: ticketPath, content }],
  };
  const value = productParentContextIdentity(packet).get(ticketPath);
  expect(value).toEqual(expect.any(String));
  return value;
}

describe('Implementation ticket semantic projection', () => {
  it.each([
    ['phase: intake', 'phase: define-behavior'],
    ['status: in_progress', 'status: done'],
    ['last_modified: yesterday', 'last_modified: today'],
    ['scope: preserve approval', 'scope: "preserve approval"'],
    ['# Ticket', '<!-- editorial -->\n\n# Ticket'],
  ])('ignores cosmetic or administrative %s', (before, after) => {
    const changed = ticket.replace(before, () => after);
    expect(changed).not.toBe(ticket);
    expect(projected(changed)).toBe(projected(ticket));
  });
  it.each([
    ['scope: preserve approval', 'scope: permit anonymous approval'],
    ['out_of_scope: anonymous approval', 'out_of_scope: none'],
    ['done_when: current approval advances', 'done_when: any approval advances'],
    ['Preserve authentication.', 'Remove authentication.'],
  ])('retains decision-bearing %s', (before, after) => {
    const changed = ticket.replace(before, () => after);
    expect(changed).not.toBe(ticket);
    expect(projected(changed)).not.toBe(projected(ticket));
  });
});
