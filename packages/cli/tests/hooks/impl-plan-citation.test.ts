/**
 * Unit tests for hasCitation — the Decisions-section evidence check (ticket
 * MR5M3A). Proves test-definitions Rule "Enabled — cited evidence" at the
 * helper level. Pure function — no filesystem.
 */

import { describe, expect, it } from 'vitest';

import { hasCitation } from '../../templates/hooks/lib/impl-plan.js';

describe('hasCitation — citation detection', () => {
  it('treats a URL as a citation (decisions_with_citation_passes)', () => {
    expect(hasCitation('We chose X. See https://example.com/adr-1 for why.')).toBe(true);
  });

  it('treats a [n] source-reference marker as a citation', () => {
    expect(hasCitation('Storage is append-only [1]; the queue is at-least-once [2].')).toBe(true);
  });

  it('rejects prose with no URL and no marker (decisions_without_citation_blocks)', () => {
    expect(hasCitation('We chose a file store because it is simpler than a database.')).toBe(false);
  });

  it('rejects an empty body', () => {
    expect(hasCitation('')).toBe(false);
  });
});
