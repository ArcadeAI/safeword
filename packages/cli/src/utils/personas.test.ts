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

import { assert, describe, expect, it } from 'vitest';

import {
  derivePersonaCode,
  isValidPersonaCode,
  isValidPersonaName,
  lookupPersonaReference,
  parsePersonas,
  PERSONA_CODE_PATTERN,
  resolvePersonaCodes,
  validatePersonas,
} from './personas.js';

describe('derivePersonaCode', () => {
  describe('canonical 3–4 character derivation', () => {
    it('two-word name uses two characters from the first word and one from the second', () => {
      expect(derivePersonaCode('Platform Operator')).toBe('PLO');
    });

    it('three-word name derives three-letter code', () => {
      expect(derivePersonaCode('Site Reliability Engineer')).toBe('SRE');
    });

    it('names longer than four words truncate to four initials', () => {
      expect(derivePersonaCode('International Atomic Energy Agency Inspector')).toBe('IAEA');
    });
  });

  describe('single-word names use first three characters uppercased', () => {
    it('Auditor derives AUD', () => {
      expect(derivePersonaCode('Auditor')).toBe('AUD');
    });

    it('Architect derives ARC', () => {
      expect(derivePersonaCode('Architect')).toBe('ARC');
    });
  });

  describe('non-alpha characters stripped before derivation', () => {
    it("apostrophe in name is removed (Bob's Burger → BOB)", () => {
      expect(derivePersonaCode("Bob's Burger")).toBe('BOB');
    });

    it('hyphen in name separates words (Co-Founder → COF)', () => {
      expect(derivePersonaCode('Co-Founder')).toBe('COF');
    });
  });

  describe('whitespace handling', () => {
    it('leading and trailing whitespace trimmed', () => {
      expect(derivePersonaCode('  Platform Operator  ')).toBe('PLO');
    });

    it('multiple internal spaces collapse to single-word separator', () => {
      expect(derivePersonaCode('Platform   Operator')).toBe('PLO');
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

    it('multi-word with a digit-bearing word preserves the digit', () => {
      expect(derivePersonaCode('Level 3 Operator')).toBe('L3O');
    });
  });

  describe('overflow truncation', () => {
    it('seven-word name truncates to first 4 initials', () => {
      expect(
        derivePersonaCode('International Atomic Energy Agency Inspection Sub Department'),
      ).toBe('IAEA');
    });

    it('four-word name returns all 4 initials', () => {
      expect(derivePersonaCode('Alpha Beta Gamma Delta')).toBe('ABGD');
    });
  });

  describe('boundary inputs', () => {
    it('empty string returns empty', () => {
      expect(derivePersonaCode('')).toBe('');
    });

    it('whitespace-only returns empty', () => {
      expect(derivePersonaCode(' '.repeat(3))).toBe('');
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

describe('parsePersonas', () => {
  it('parses a single block with explicit code', () => {
    const content = '## Platform Operator (PO)\n\n**Role:** Owns infra.\n';
    const parsed = parsePersonas(content);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      name: 'Platform Operator',
      rawCode: 'PO',
      explicit: true,
      lineNumber: 1,
      hasRole: true,
    });
  });

  it('parses a single block without code (explicit = false)', () => {
    const content = '## Platform Operator\n\n**Role:** Owns infra.\n';
    const parsed = parsePersonas(content);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      name: 'Platform Operator',
      rawCode: '',
      explicit: false,
      hasRole: true,
    });
  });

  it('records line numbers (1-indexed) of headers', () => {
    const content = [
      '# Personas',
      '',
      '## Platform Operator (PO)',
      '**Role:** A',
      '',
      '## End User (EU)',
      '**Role:** B',
    ].join('\n');
    const parsed = parsePersonas(content);
    expect(parsed.map(p => p.lineNumber)).toEqual([3, 6]);
  });

  it('flags missing Role line via hasRole = false', () => {
    const content = '## Platform Operator (PO)\n\nNo role here.\n';
    const parsed = parsePersonas(content);
    expect(parsed[0]?.hasRole).toBe(false);
  });

  it('parses headerless block (## (PO)) with empty name', () => {
    const content = '## (PO)\n\n**Role:** Something.\n';
    const parsed = parsePersonas(content);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe('');
    expect(parsed[0]?.rawCode).toBe('PO');
  });

  it('ignores ### sub-headers as persona blocks', () => {
    const content = '## Platform Operator (PO)\n\n### Subsection\n\n**Role:** Owns infra.\n';
    const parsed = parsePersonas(content);
    expect(parsed).toHaveLength(1);
  });

  it('parses multiple blocks in sequence', () => {
    const content = [
      '## Platform Operator (PO)',
      '**Role:** A',
      '',
      '## End User (EU)',
      '**Role:** B',
    ].join('\n');
    const parsed = parsePersonas(content);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.name).toBe('Platform Operator');
    expect(parsed[1]?.name).toBe('End User');
  });

  it('returns empty list for content with no headers', () => {
    expect(parsePersonas('# Personas\n\nNo personas yet.\n')).toEqual([]);
  });

  it('returns empty list for empty content', () => {
    expect(parsePersonas('')).toEqual([]);
  });

  it('strips trailing inline HTML comment from persona name (CommonMark inline rule)', () => {
    // Per CommonMark: `<!--` mid-line is inline HTML, not a block comment.
    // The header `## Platform Operator <!-- legacy -->` is a header whose
    // rendered name is "Platform Operator"; the comment shouldn't leak into
    // the parsed name or corrupt code derivation.
    const content = '## Platform Operator <!-- legacy note -->\n\n**Role:** Owns infra.\n';
    const parsed = parsePersonas(content);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe('Platform Operator');
  });

  it('mid-line `<!--` in body text does not open block-comment state', () => {
    // CommonMark: HTML block comment requires `<!--` at the start of the line.
    // Body text with a stray inline `<!--` (even unclosed) should not put
    // subsequent lines into skip mode; the next `## Header` must still parse.
    const content = [
      '## Platform Operator (PO)',
      '**Role:** A note about <!-- some inline tag',
      '',
      '## End User (EU)',
      '**Role:** B',
    ].join('\n');
    const parsed = parsePersonas(content);
    expect(parsed).toHaveLength(2);
    expect(parsed[1]?.name).toBe('End User');
  });
});

describe('resolvePersonaCodes', () => {
  it('keeps explicit codes verbatim', () => {
    const parsed = parsePersonas('## Platform Operator (PLATOPS)\n**Role:** A\n');
    const resolved = resolvePersonaCodes(parsed);
    expect(resolved[0]?.code).toBe('PLATOPS');
  });

  it('derives missing codes from names', () => {
    const parsed = parsePersonas('## Platform Operator\n**Role:** A\n');
    const resolved = resolvePersonaCodes(parsed);
    expect(resolved[0]?.code).toBe('PLO');
  });

  it('appends suffix on collision with existing explicit code', () => {
    const content = [
      '## Partner Org (PLO)',
      '**Role:** A',
      '',
      '## Platform Operator',
      '**Role:** B',
    ].join('\n');
    const resolved = resolvePersonaCodes(parsePersonas(content));
    expect(resolved[0]?.code).toBe('PLO');
    expect(resolved[1]?.code).toBe('PLO2');
  });

  it('chains suffix when multiple derivations collide', () => {
    const content = [
      '## Platform Operator',
      '**Role:** A',
      '',
      '## Planning Owner',
      '**Role:** B',
      '',
      '## Plugin Operator',
      '**Role:** C',
    ].join('\n');
    const resolved = resolvePersonaCodes(parsePersonas(content));
    expect(resolved.map(p => p.code)).toEqual(['PLO', 'PLO2', 'PLO3']);
  });

  it('explicit code claims its slot regardless of file order', () => {
    // Auto-derived Platform Operator (line 1) WOULD be PLO; the explicit (PLO)
    // on Partner Org (line 4) wins because explicit codes are claimed first.
    const content = [
      '## Platform Operator',
      '**Role:** A',
      '',
      '## Partner Org (PLO)',
      '**Role:** B',
    ].join('\n');
    const resolved = resolvePersonaCodes(parsePersonas(content));
    expect(resolved[0]?.code).toBe('PLO2');
    expect(resolved[1]?.code).toBe('PLO');
  });

  it('reports exhaustion before a collision suffix exceeds four characters', () => {
    const content = Array.from(
      { length: 1000 },
      (_, index) => `## Pl${index} Operator\n**Role:** A`,
    ).join('\n\n');
    const parsed = parsePersonas(content);
    const resolved = resolvePersonaCodes(parsed);
    const exhausted = resolved.at(-1);
    expect(exhausted?.codeError).toBe('collision-space-exhausted');
    expect(exhausted?.code.length).toBeLessThanOrEqual(4);
    expect(
      validatePersonas(parsed).some(error =>
        /collision.*exhausted.*explicit.*3[–-]4/i.test(error.message),
      ),
    ).toBe(true);
  });
});

describe('validatePersonas', () => {
  it('well-formed file produces no errors', () => {
    const content = [
      '## Platform Operator (PO)',
      '**Role:** A',
      '',
      '## End User (EU)',
      '**Role:** B',
    ].join('\n');
    expect(validatePersonas(parsePersonas(content))).toEqual([]);
  });

  it('headerless block (empty name) produces missing-name error', () => {
    const content = '## (PO)\n**Role:** A\n';
    const errors = validatePersonas(parsePersonas(content));
    expect(errors.some(error => error.message.includes('missing persona name'))).toBe(true);
  });

  it('single-character name produces minimum-length error', () => {
    const content = '## A\n**Role:** A\n';
    const errors = validatePersonas(parsePersonas(content));
    expect(errors.some(error => error.message.includes('at least 2 characters'))).toBe(true);
  });

  it('missing Role line produces missing-role error', () => {
    const content = '## Platform Operator (PO)\n\nNo role here.\n';
    const errors = validatePersonas(parsePersonas(content));
    expect(errors.some(error => error.message.includes('missing Role'))).toBe(true);
  });

  it('duplicate explicit codes produce duplicate-code errors with both lines', () => {
    const content = [
      '## End User (EU)',
      '**Role:** A',
      '',
      '## Engineering Unit (EU)',
      '**Role:** B',
    ].join('\n');
    const errors = validatePersonas(parsePersonas(content));
    const duplicates = errors.filter(error => error.message.includes('duplicate persona code'));
    expect(duplicates).toHaveLength(2);
    expect(duplicates[0]?.message).toContain('EU');
  });

  it('duplicate persona names produce duplicate-name errors', () => {
    const content = [
      '## Platform Operator (PO)',
      '**Role:** A',
      '',
      '## Platform Operator (PO2)',
      '**Role:** B',
    ].join('\n');
    const errors = validatePersonas(parsePersonas(content));
    const duplicates = errors.filter(error => error.message.includes('duplicate persona name'));
    expect(duplicates).toHaveLength(2);
  });

  it('explicit code violating pattern (lowercase) produces pattern error', () => {
    const content = '## Platform Operator (po)\n**Role:** A\n';
    const errors = validatePersonas(parsePersonas(content));
    expect(errors.some(error => error.message.includes('violates pattern'))).toBe(true);
  });

  it('digit-first name surfaces explicit-override prompt', () => {
    const content = '## 3 Amigos\n**Role:** A\n';
    const errors = validatePersonas(parsePersonas(content));
    expect(
      errors.some(
        error =>
          error.message.includes('non-canonical code') &&
          error.message.includes('explicit 3–4 letter code'),
      ),
    ).toBe(true);
  });

  it('short derived code requests an explicit canonical override', () => {
    const content = '## S3\n**Role:** A\n';
    const errors = validatePersonas(parsePersonas(content));
    const matchesCanonicalOverrideMessage = errors.some(error =>
      /non-canonical.*explicit.*3[–-]4/i.test(error.message),
    );
    expect(matchesCanonicalOverrideMessage).toBe(true);
  });

  it('digit-first name does NOT trigger pattern violation message for explicit codes (different message)', () => {
    // When user authors `## 3 Amigos (THREE)`, explicit code is valid → no error
    const content = '## 3 Amigos (THREE)\n**Role:** A\n';
    const errors = validatePersonas(parsePersonas(content));
    expect(errors.some(error => error.message.includes('non-conformant'))).toBe(false);
  });
});

function buildResolvedFixture(content: string) {
  return resolvePersonaCodes(parsePersonas(content));
}

describe('lookupPersonaReference', () => {
  const fixture = buildResolvedFixture(
    ['## Platform Operator (PO)', '**Role:** A', '', '## End User (EU)', '**Role:** B'].join('\n'),
  );

  it('matches by exact code returns valid with match', () => {
    const result = lookupPersonaReference(fixture, 'PO');
    assert(result.status === 'valid');
    expect(result.match.code).toBe('PO');
    expect(result.match.name).toBe('Platform Operator');
  });

  it('matches by exact full name returns valid with match', () => {
    const result = lookupPersonaReference(fixture, 'Platform Operator');
    assert(result.status === 'valid');
    expect(result.match.code).toBe('PO');
  });

  it('casing mismatch on code returns unknown with suggestion', () => {
    const result = lookupPersonaReference(fixture, 'po');
    assert(result.status === 'unknown');
    expect(result.suggestion).toBe('PO');
  });

  it('casing mismatch on name returns unknown with suggestion (the name)', () => {
    const result = lookupPersonaReference(fixture, 'platform operator');
    assert(result.status === 'unknown');
    expect(result.suggestion).toBe('Platform Operator');
  });

  it('unknown identifier returns unknown without suggestion', () => {
    const result = lookupPersonaReference(fixture, 'AdminUser');
    assert(result.status === 'unknown');
    expect(result.suggestion).toBeUndefined();
  });

  it('empty input returns unknown without suggestion', () => {
    const result = lookupPersonaReference(fixture, '');
    assert(result.status === 'unknown');
    expect(result.suggestion).toBeUndefined();
  });

  it('lookup against empty list returns unknown', () => {
    const result = lookupPersonaReference([], 'PO');
    expect(result.status).toBe('unknown');
  });

  it('exact code match wins over casing-suggestion match for a different persona', () => {
    // If "PO" exists and "po" is queried, suggestion should be "PO" (not aliasing to a different persona)
    const result = lookupPersonaReference(fixture, 'eu');
    assert(result.status === 'unknown');
    expect(result.suggestion).toBe('EU');
  });
});
