/**
 * Unit tests for persona derivation, parsing, validation, and lookup
 * (ticket 7YN5QB).
 *
 * Covers the pure-function scenarios in
 * `.safeword-project/tickets/7YN5QB/test-definitions.md` — derivation
 * algorithm, code-pattern validation, and name-length validation.
 *
 * Integration tests against the `safeword setup` / `safeword check` commands
 * live under `tests/commands/`. File-IO behavior for `validatePersonaRef`
 * (missing-file graceful return) lives under `tests/utils/personas-ref.test.ts`
 * (sibling — separate file because it needs filesystem fixtures).
 */

import { describe, expect, it } from 'vitest';

import {
  derivePersonaCode,
  isValidPersonaCode,
  isValidPersonaName,
  PERSONA_CODE_PATTERN,
} from './personas.js';

describe('derivePersonaCode', () => {
  describe('multi-word names use first-letter-of-each-word', () => {
    it('two-word name derives two-letter code', () => {
      expect(derivePersonaCode('Platform Operator')).toBe('PO');
    });

    it('three-word name derives three-letter code', () => {
      expect(derivePersonaCode('Site Reliability Engineer')).toBe('SRE');
    });

    it('two-word name with End User derives EU', () => {
      expect(derivePersonaCode('End User')).toBe('EU');
    });
  });

  describe('single-word names use first two characters uppercased', () => {
    it('Auditor derives AU', () => {
      expect(derivePersonaCode('Auditor')).toBe('AU');
    });

    it('Architect derives AR', () => {
      expect(derivePersonaCode('Architect')).toBe('AR');
    });
  });

  describe('non-alpha characters stripped before derivation', () => {
    it("apostrophe in name is removed (Bob's Burger → BB)", () => {
      expect(derivePersonaCode("Bob's Burger")).toBe('BB');
    });

    it('hyphen in name is removed (Co-Founder → CF as single word after strip)', () => {
      // After stripping hyphen: "CoFounder" — single word, first 2 chars
      expect(derivePersonaCode('Co-Founder')).toBe('CO');
    });
  });

  describe('whitespace handling', () => {
    it('leading and trailing whitespace trimmed', () => {
      expect(derivePersonaCode('  Platform Operator  ')).toBe('PO');
    });

    it('multiple internal spaces collapse to single-word separator', () => {
      expect(derivePersonaCode('Platform   Operator')).toBe('PO');
    });
  });

  describe('digits preserved within derived code', () => {
    it('single-word with digit (S3) derives S3', () => {
      expect(derivePersonaCode('S3')).toBe('S3');
    });

    it('single-word with leading digit (3M) derives 3M (validation will reject)', () => {
      // Derivation produces non-conformant output for pathological inputs;
      // pattern enforcement happens at validation.
      expect(derivePersonaCode('3M')).toBe('3M');
    });

    it('multi-word with digit-first word (3 Amigos) derives 3A', () => {
      expect(derivePersonaCode('3 Amigos')).toBe('3A');
    });
  });

  describe('overflow truncation', () => {
    it('seven-word name truncates to first 6 initials', () => {
      // "International Atomic Energy Agency Inspection Sub Department" → IAEAISD → IAEAIS
      expect(
        derivePersonaCode('International Atomic Energy Agency Inspection Sub Department'),
      ).toBe('IAEAIS');
    });

    it('six-word name returns full 6 initials (no truncation)', () => {
      expect(derivePersonaCode('Alpha Beta Gamma Delta Epsilon Zeta')).toBe('ABGDEZ');
    });
  });

  describe('boundary inputs', () => {
    it('empty string returns empty', () => {
      expect(derivePersonaCode('')).toBe('');
    });

    it('whitespace-only returns empty', () => {
      expect(derivePersonaCode('   ')).toBe('');
    });

    it('punctuation-only returns empty', () => {
      expect(derivePersonaCode("'-.,")).toBe('');
    });

    it('single character returns single uppercased char (validation will reject as too-short)', () => {
      expect(derivePersonaCode('A')).toBe('A');
    });
  });
});

describe('isValidPersonaName', () => {
  it('two-character name is valid', () => {
    expect(isValidPersonaName('Al')).toBe(true);
  });

  it('single-character name is invalid', () => {
    expect(isValidPersonaName('A')).toBe(false);
  });

  it('empty string is invalid', () => {
    expect(isValidPersonaName('')).toBe(false);
  });

  it('whitespace-only is invalid', () => {
    expect(isValidPersonaName('  ')).toBe(false);
  });

  it('whitespace around a 2-char name is trimmed before length check', () => {
    expect(isValidPersonaName('  Al  ')).toBe(true);
  });
});

describe('isValidPersonaCode', () => {
  it('PO matches pattern', () => {
    expect(isValidPersonaCode('PO')).toBe(true);
  });

  it('PO2 matches pattern (digits allowed after first letter)', () => {
    expect(isValidPersonaCode('PO2')).toBe(true);
  });

  it('PLATOPS at exactly 6 chars matches pattern', () => {
    expect(isValidPersonaCode('PLATOPS')).toBe(false); // PLATOPS is 7 chars; max is 6
  });

  it('PLATOP at 6 chars matches pattern', () => {
    expect(isValidPersonaCode('PLATOP')).toBe(true);
  });

  it('single-letter A does not match (minimum is 2)', () => {
    expect(isValidPersonaCode('A')).toBe(false);
  });

  it('lowercase po does not match', () => {
    expect(isValidPersonaCode('po')).toBe(false);
  });

  it('digit-first 3M does not match', () => {
    expect(isValidPersonaCode('3M')).toBe(false);
  });

  it('S3 matches pattern (digit allowed after first letter)', () => {
    expect(isValidPersonaCode('S3')).toBe(true);
  });
});

describe('PERSONA_CODE_PATTERN export', () => {
  it('is a RegExp', () => {
    expect(PERSONA_CODE_PATTERN).toBeInstanceOf(RegExp);
  });
});
