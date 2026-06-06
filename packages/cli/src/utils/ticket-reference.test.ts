/**
 * Unit tests for slug-first ticket-reference rendering (ticket ZRXM6Q).
 *
 * Pure function — no filesystem. The reference leads with the human slug and
 * trails the Crockford ID as a locator, so a human or agent recognizes the
 * ticket instead of decoding the bare code (NN/g recognition-over-recall).
 */

import { describe, expect, it } from 'vitest';

import { formatTicketReference } from './ticket-reference.js';

describe('formatTicketReference', () => {
  it('leads with the slug and trails the ID as a locator', () => {
    expect(formatTicketReference('ZBVGPF', 'embed-figure-it-out')).toBe(
      'embed-figure-it-out (ZBVGPF)',
    );
  });

  it('falls back to the bare ID when no slug is available', () => {
    expect(formatTicketReference('ZBVGPF')).toBe('ZBVGPF');
    expect(formatTicketReference('ZBVGPF', '')).toBe('ZBVGPF');
  });
});
