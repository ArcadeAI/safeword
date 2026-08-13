import { describe, expect, it } from 'vitest';

import { findTicketFolderMatches } from './ticket-folder-matches.js';

describe('findTicketFolderMatches', () => {
  it('separates exact and slugged matches while preserving their input order', () => {
    expect(findTicketFolderMatches(['ABC-second', 'ABC', 'OTHER', 'ABC-first'], 'ABC')).toEqual({
      all: ['ABC-second', 'ABC', 'ABC-first'],
      exact: ['ABC'],
      slugged: ['ABC-second', 'ABC-first'],
    });
  });

  it('matches ticket IDs case-sensitively', () => {
    expect(findTicketFolderMatches(['abc', 'abc-lower', 'ABC-upper'], 'ABC')).toEqual({
      all: ['ABC-upper'],
      exact: [],
      slugged: ['ABC-upper'],
    });
  });
});
