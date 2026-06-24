import { describe, expect, it } from 'vitest';

import { buildPayload } from '../../src/tracker-sync/payload.js';
import type { TicketInput } from '../../src/tracker-sync/types.js';

/**
 * AC3 (ticket → flat IssuePayload) and AC10 (egress default minimal). The builder
 * is a pure function over a neutral TicketInput, so these are plain unit tests.
 */
describe('sync-tracker payload builder (sync-tracker.TB1.AC3, AC10)', () => {
  const activeTicket: TicketInput = {
    id: 'AB12CD',
    title: 'Wire the thing to the other thing',
    status: 'in_progress',
    type: 'feature',
    epic: 'tracker-bridge',
    ticketUrl: 'https://github.com/acme/repo/tree/main/.project/tickets/AB12CD-wire',
    bodyMarkdown: '# Wire the thing\n\nSECRET internal spec and work log content',
  };

  // AC3 — an active ticket maps to an open payload with epic and type labels
  it('maps an active ticket to an open payload', () => {
    expect(buildPayload(activeTicket, { bodyMode: 'minimal' }).state).toBe('open');
  });

  it('carries no safeword id prefix in the title', () => {
    const payload = buildPayload(activeTicket, { bodyMode: 'minimal' });
    expect(payload.title).toBe('Wire the thing to the other thing');
    expect(payload.title).not.toContain('AB12CD');
  });

  it('includes the epic and type labels', () => {
    const { labels } = buildPayload(activeTicket, { bodyMode: 'minimal' });
    expect(labels).toContain('epic:tracker-bridge');
    expect(labels).toContain('type:feature');
  });

  it('puts the mirror banner and a back-link to the ticket in the body', () => {
    const { body } = buildPayload(activeTicket, { bodyMode: 'minimal' });
    expect(body).toContain('Mirror of safeword ticket AB12CD');
    expect(body).toContain(activeTicket.ticketUrl);
  });

  // AC3 — a terminal ticket maps to a closed payload
  it.each(['done', 'cancelled', 'superseded', 'wontfix'])(
    'maps a %s ticket to a closed payload',
    status => {
      expect(buildPayload({ ...activeTicket, status }, { bodyMode: 'minimal' }).state).toBe(
        'closed',
      );
    },
  );

  // AC3 — a ticket with no epic yields only the type label
  it('omits the epic label when the ticket has no epic', () => {
    const { labels } = buildPayload({ ...activeTicket, epic: undefined }, { bodyMode: 'minimal' });
    expect(labels).toContain('type:feature');
    expect(labels.some(label => label.startsWith('epic:'))).toBe(false);
  });

  // AC10 — the default (minimal) body omits the spec and work log
  it('excludes the ticket body content under the minimal default', () => {
    const { body } = buildPayload(activeTicket, { bodyMode: 'minimal' });
    expect(body).not.toContain('SECRET internal spec and work log content');
  });

  it('includes the ticket body content only when egress is full', () => {
    const { body } = buildPayload(activeTicket, { bodyMode: 'full' });
    expect(body).toContain('SECRET internal spec and work log content');
  });
});
