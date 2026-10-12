/**
 * Unit tests for isTicketCloseEdit (#5546): given a ticket.md now at status
 * done and the tool input that produced it, decide whether the call moved the
 * ticket to done. It fails closed — only positive evidence that the ticket was
 * already done rules a close out. The real-hook sequence lives in
 * tests/integration/close-edit-done-gate.test.ts.
 */

import { describe, expect, it } from 'vitest';

import { isTicketCloseEdit } from '../../../../.safeword/hooks/lib/ticket-close';

function ticket(status: string, phase = 'done', body = '# Task'): string {
  return `---\nid: T1\ntype: task\nphase: ${phase}\nstatus: ${status}\n---\n${body}\n`;
}

describe('isTicketCloseEdit', () => {
  it('treats a Write as a close because it carries no prior text', () => {
    expect(isTicketCloseEdit(ticket('done'), {})).toBe(true);
    expect(isTicketCloseEdit(ticket('done'), undefined)).toBe(true);
  });

  it('is a close when undoing the Edit shows a not-done status', () => {
    const toolInput = { old_string: ticket('in_progress'), new_string: ticket('done') };

    expect(isTicketCloseEdit(ticket('done'), toolInput)).toBe(true);
  });

  it('is not a close when undoing the Edit shows the ticket was already done', () => {
    const toolInput = { old_string: '# Task', new_string: '# Task (typo fixed)' };

    expect(isTicketCloseEdit(ticket('done', 'done', '# Task (typo fixed)'), toolInput)).toBe(false);
  });

  it('is a close when an ambiguous replacement lands on the status line', () => {
    // 'done' appears in both phase and status, so the Edit cannot be undone.
    const toolInput = { old_string: 'in_progress', new_string: 'done' };

    expect(isTicketCloseEdit(ticket('done', 'done'), toolInput)).toBe(true);
  });

  it('is not a close when an ambiguous replacement stays off the status line', () => {
    const content = ticket('done', 'done', 'note\nnote');
    const toolInput = { old_string: 'todo', new_string: 'note' };

    expect(isTicketCloseEdit(content, toolInput)).toBe(false);
  });

  it('is a close when a deletion leaves nothing to undo against', () => {
    const toolInput = { old_string: 'status: in_progress\n', new_string: '' };

    expect(isTicketCloseEdit(ticket('done'), toolInput)).toBe(true);
  });

  it('is a close when MultiEdit fragments assemble the done status', () => {
    const toolInput = {
      edits: [
        { old_string: 'wont', new_string: 'don' },
        { old_string: 'fix', new_string: 'e' },
      ],
    };

    expect(isTicketCloseEdit(ticket('done', 'implement'), toolInput)).toBe(true);
  });

  it('is not a close when every MultiEdit replacement undoes to a done status', () => {
    const toolInput = {
      edits: [
        { old_string: '# Task', new_string: '# Task one' },
        { old_string: 'phase: implement', new_string: 'phase: done' },
      ],
    };

    expect(isTicketCloseEdit(ticket('done', 'done', '# Task one'), toolInput)).toBe(false);
  });
});
