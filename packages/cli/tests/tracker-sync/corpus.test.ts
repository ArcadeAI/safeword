import { describe, expect, it } from 'vitest';

import { backLinkUrl, toTicketInput } from '../../src/tracker-sync/corpus.js';

describe('sync-tracker corpus mapping', () => {
  it('builds a github tree URL when a repo is configured', () => {
    expect(backLinkUrl('.project/tickets/AB12CD-wire', 'acme/repo')).toBe(
      'https://github.com/acme/repo/tree/HEAD/.project/tickets/AB12CD-wire',
    );
  });

  it('falls back to the in-repo relative path when no repo is configured', () => {
    expect(backLinkUrl('.project/tickets/AB12CD-wire', undefined)).toBe(
      '.project/tickets/AB12CD-wire',
    );
  });

  it('maps a ticket entry and its type to the neutral TicketInput', () => {
    const input = toTicketInput(
      {
        id: 'AB12CD',
        title: 'Wire it up',
        status: 'in_progress',
        epic: 'bridge',
        relativePath: '.project/tickets/AB12CD-wire',
      },
      'feature',
      'acme/repo',
      'body text',
    );
    expect(input).toEqual({
      id: 'AB12CD',
      title: 'Wire it up',
      status: 'in_progress',
      type: 'feature',
      epic: 'bridge',
      ticketUrl: 'https://github.com/acme/repo/tree/HEAD/.project/tickets/AB12CD-wire',
      bodyMarkdown: 'body text',
    });
  });
});
