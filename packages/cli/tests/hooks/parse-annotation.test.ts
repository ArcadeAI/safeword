/**
 * Unit tests for the TDD SHA-or-skip checkbox annotation parser (ticket J7VBGJ).
 *
 * Three pure functions:
 *  - parseCheckboxAnnotation  → recognize a R/G/R/cross-scenario checkbox line
 *                               and split it into {step, checked, annotation}
 *  - classifyAnnotation       → tag the annotation text as none | skip | sha
 *  - isValidSkipReason        → non-empty after trim
 *
 * Together they let the write-time, commit-time, and done-time gates ask
 * one question consistently: "what does this checkbox claim, and is it valid?"
 */

import { describe, expect, it } from 'vitest';

import {
  classifyAnnotation,
  isValidSha,
  isValidSkipReason,
  parseCheckboxAnnotation,
} from '../../templates/hooks/lib/parse-annotation.js';

describe('parseCheckboxAnnotation', () => {
  describe('recognized step keywords', () => {
    it('recognizes an unchecked RED line', () => {
      expect(parseCheckboxAnnotation('- [ ] RED')).toEqual({
        step: 'RED',
        checked: false,
        annotation: '',
      });
    });

    it('recognizes an unchecked GREEN line', () => {
      expect(parseCheckboxAnnotation('- [ ] GREEN')).toEqual({
        step: 'GREEN',
        checked: false,
        annotation: '',
      });
    });

    it('recognizes an unchecked REFACTOR line', () => {
      expect(parseCheckboxAnnotation('- [ ] REFACTOR')).toEqual({
        step: 'REFACTOR',
        checked: false,
        annotation: '',
      });
    });

    it('recognizes an unchecked cross-scenario line', () => {
      expect(parseCheckboxAnnotation('- [ ] cross-scenario')).toEqual({
        step: 'cross-scenario',
        checked: false,
        annotation: '',
      });
    });
  });

  describe('checked vs unchecked', () => {
    it('detects a checked checkbox', () => {
      const parsed = parseCheckboxAnnotation('- [x] RED abc1234');
      expect(parsed?.checked).toBe(true);
    });

    it('detects an unchecked checkbox', () => {
      const parsed = parseCheckboxAnnotation('- [ ] RED');
      expect(parsed?.checked).toBe(false);
    });
  });

  describe('annotation extraction', () => {
    it('extracts a SHA after the step keyword', () => {
      expect(parseCheckboxAnnotation('- [x] RED abc1234')).toEqual({
        step: 'RED',
        checked: true,
        annotation: 'abc1234',
      });
    });

    it('extracts a skip: reason after the step keyword', () => {
      expect(
        parseCheckboxAnnotation('- [x] REFACTOR skip: trivial — no structural change'),
      ).toEqual({
        step: 'REFACTOR',
        checked: true,
        annotation: 'skip: trivial — no structural change',
      });
    });

    it('returns empty annotation for a bare legacy checkbox', () => {
      expect(parseCheckboxAnnotation('- [x] RED')).toEqual({
        step: 'RED',
        checked: true,
        annotation: '',
      });
    });

    it('trims surrounding whitespace from the annotation', () => {
      expect(parseCheckboxAnnotation('- [x] GREEN    def5678   ')).toEqual({
        step: 'GREEN',
        checked: true,
        annotation: 'def5678',
      });
    });
  });

  describe('non-step lines', () => {
    it('returns null for unrelated checkbox lines', () => {
      expect(parseCheckboxAnnotation('- [ ] something else')).toBeNull();
    });

    it('returns null for non-checkbox lines', () => {
      expect(parseCheckboxAnnotation('# Heading')).toBeNull();
    });

    it('returns null for empty lines', () => {
      expect(parseCheckboxAnnotation('')).toBeNull();
    });
  });

  describe('indentation tolerance', () => {
    it('parses an indented checkbox line', () => {
      expect(parseCheckboxAnnotation('  - [ ] RED')).toEqual({
        step: 'RED',
        checked: false,
        annotation: '',
      });
    });
  });
});

describe('classifyAnnotation', () => {
  it('classifies an empty string as none', () => {
    expect(classifyAnnotation('')).toEqual({ kind: 'none' });
  });

  it('classifies a skip: with reason as skip with that reason', () => {
    expect(classifyAnnotation('skip: trivial')).toEqual({
      kind: 'skip',
      reason: 'trivial',
    });
  });

  it('classifies a skip: with no reason text as skip with empty reason', () => {
    expect(classifyAnnotation('skip:')).toEqual({ kind: 'skip', reason: '' });
  });

  it('classifies skip: with only whitespace as skip with empty reason after trim', () => {
    expect(classifyAnnotation('skip:    ')).toEqual({ kind: 'skip', reason: '' });
  });

  it('treats anything else as a candidate SHA, preserved verbatim', () => {
    expect(classifyAnnotation('abc1234')).toEqual({ kind: 'sha', value: 'abc1234' });
  });

  it('preserves uppercase SHA candidates verbatim (validation is downstream)', () => {
    expect(classifyAnnotation('ABC1234')).toEqual({ kind: 'sha', value: 'ABC1234' });
  });
});

describe('isValidSkipReason', () => {
  it('accepts a non-empty reason', () => {
    expect(isValidSkipReason('trivial — no structural change')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isValidSkipReason('')).toBe(false);
  });

  it('rejects a whitespace-only string', () => {
    expect(isValidSkipReason(' '.repeat(4))).toBe(false);
  });

  it('rejects a tab-only string', () => {
    expect(isValidSkipReason('\t\t')).toBe(false);
  });
});

describe('isValidSha', () => {
  it('accepts a 7-char hex abbreviation', () => {
    expect(isValidSha('abc1234')).toBe(true);
  });

  it('accepts a full 40-char hex sha', () => {
    expect(isValidSha('a'.repeat(40))).toBe(true);
  });

  it('is case-insensitive on hex digits', () => {
    expect(isValidSha('ABC1234')).toBe(true);
  });

  it('rejects fewer than 7 chars', () => {
    expect(isValidSha('abc12')).toBe(false);
  });

  it('rejects non-hex letters', () => {
    expect(isValidSha('ghi9abc')).toBe(false);
  });

  it('rejects a value carrying shell metacharacters (injection guard)', () => {
    expect(isValidSha('abc1234"; rm -rf ~ #')).toBe(false);
    expect(isValidSha('$(touch pwned)')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidSha('')).toBe(false);
  });
});
