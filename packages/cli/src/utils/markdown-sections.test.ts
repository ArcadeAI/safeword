/**
 * Unit tests for the shared markdown section-walk primitive `parseHeading`
 * (hoisted here from scenario-coverage/test-skeleton — Rule of Three). The
 * fence/comment skip (`computeSkipMask`, `stripInlineComments`) is exercised
 * indirectly by the scenario-coverage and test-skeleton suites.
 */

import { describe, expect, it } from 'vitest';

import { parseHeading } from './markdown-sections.js';

describe('parseHeading', () => {
  it('parses levels 1 through 6', () => {
    for (let level = 1; level <= 6; level += 1) {
      expect(parseHeading(`${'#'.repeat(level)} Heading`)).toEqual({ level, text: 'Heading' });
    }
  });

  it('returns undefined for a non-heading line', () => {
    expect(parseHeading('just text')).toBeUndefined();
    expect(parseHeading('')).toBeUndefined();
  });

  it('rejects 7+ leading hashes (beyond ATX range)', () => {
    expect(parseHeading('####### too deep')).toBeUndefined();
  });

  it('requires a whitespace separator after the hashes', () => {
    expect(parseHeading('#nospace')).toBeUndefined();
    expect(parseHeading('## Rule: x')).toEqual({ level: 2, text: 'Rule: x' });
  });

  it('accepts a tab separator, not only a space (CommonMark)', () => {
    expect(parseHeading('#\tTabbed')).toEqual({ level: 1, text: 'Tabbed' });
  });

  it('trims surrounding whitespace and tolerates leading indentation', () => {
    expect(parseHeading('   ###   spaced out   ')).toEqual({ level: 3, text: 'spaced out' });
  });

  it('returns undefined for hashes with no following text', () => {
    expect(parseHeading('###')).toBeUndefined();
  });
});
