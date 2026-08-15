import { describe, expect, it } from 'vitest';

import { findTicketFolderMatch } from './ticket-folder-matches.js';

describe('findTicketFolderMatch', () => {
  it('prefers an exact match over slugged candidates', () => {
    expect(findTicketFolderMatch(['ABC-second', 'ABC', 'ABCD', 'ABC-first'], 'ABC')).toBe('ABC');
  });

  it('matches ticket IDs case-sensitively', () => {
    expect(findTicketFolderMatch(['abc', 'abc-lower', 'ABC-upper'], 'ABC')).toBe('ABC-upper');
  });

  it('requires a hyphen before the slug', () => {
    expect(findTicketFolderMatch(['ABCD'], 'ABC')).toBeUndefined();
  });
});
