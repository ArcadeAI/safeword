/**
 * Unit tests for the JTBD parser + gate-level persona resolution + gate
 * decision (ticket Y2HCNJ, slice C). Covers test-definitions.md Rules 4-6.
 * Pure functions — no filesystem.
 */

import { describe, expect, it } from 'vitest';

import { derivePersonaCode } from '../../src/utils/personas.js';
import {
  evaluateJtbdGate,
  knownPersonaRefs as knownPersonaReferences,
  parseJtbdSection,
} from '../../templates/hooks/lib/jtbd.js';

const PERSONAS = '# Personas\n\n## Platform Operator (PO)\n\n**Role:** Owns infra.\n';

function spec(jtbdBody: string): string {
  return `# Spec: x\n\n## Intent\n\nWhy.\n\n## Jobs To Be Done\n\n${jtbdBody}\n\n## Outcomes\n\nDone.\n`;
}

describe('parseJtbdSection (Rule 4)', () => {
  it('parses a single entry to its persona ref', () => {
    const { entries, skip } = parseJtbdSection(
      spec(
        '### x.PO1 — t\n\n**Persona:** Platform Operator (PO)\n\n> When I a, I want b, so I can c.',
      ),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.persona).toBe('Platform Operator (PO)');
    expect(skip).toBeNull();
  });

  it('parses multiple entries', () => {
    const { entries } = parseJtbdSection(
      spec('### a\n\n**Persona:** PO\n\n### b\n\n**Persona:** End User'),
    );
    expect(entries).toHaveLength(2);
  });

  it('returns zero entries for a header-only section', () => {
    const { entries, skip } = parseJtbdSection(spec(''));
    expect(entries).toHaveLength(0);
    expect(skip).toBeNull();
  });

  it('captures a skip declaration', () => {
    const { entries, skip } = parseJtbdSection(
      spec('skip: internal refactor, no persona-facing job'),
    );
    expect(skip).toBe('internal refactor, no persona-facing job');
    expect(entries).toHaveLength(0);
  });

  it('captures an empty persona value as an empty ref', () => {
    const { entries } = parseJtbdSection(spec('### a\n\n**Persona:**'));
    expect(entries).toHaveLength(1);
    expect(entries[0]?.persona).toBe('');
  });

  it('ignores Persona lines outside the Jobs To Be Done section', () => {
    const content =
      '# Spec: x\n\n## Personas\n\n**Persona:** PO\n\n## Jobs To Be Done\n\n(nothing)\n\n## Outcomes\n';
    expect(parseJtbdSection(content).entries).toHaveLength(0);
  });

  it('does not parse an HTML-commented example as an entry', () => {
    const { entries, skip } = parseJtbdSection(
      spec(
        '<!--\n### x.PO1 — t\n\n**Persona:** Platform Operator (PO)\n\n> When I a, I want b, so I can c.\n-->',
      ),
    );
    expect(entries).toHaveLength(0);
    expect(skip).toBeNull();
  });

  it('treats a mid-line unclosed <!-- as inline, not a block that swallows later JTBDs (P58R22)', () => {
    // CommonMark: an HTML comment block starts only when the line begins with
    // `<!--`. A trailing unclosed `<!--` mid-line is inline — it must not hide
    // the JTBDs that follow.
    const body = '### a\n\n**Persona:** PO <!-- TODO confirm\n\n### b\n\n**Persona:** End User';
    expect(parseJtbdSection(spec(body)).entries).toHaveLength(2);
  });

  it('strips a closed mid-line <!-- ... --> from a persona ref (P58R22)', () => {
    const { entries } = parseJtbdSection(spec('### a\n\n**Persona:** PO <!-- note -->'));
    expect(entries[0]?.persona).toBe('PO');
  });
});

describe('knownPersonaRefs (Rule 5)', () => {
  it.each([
    ['Auditor', 'AUD'],
    ['Platform Operator', 'PLO'],
    ['Site Reliability Engineer', 'SRE'],
    ['International Atomic Energy Agency Inspector', 'IAEA'],
    ['Co-Founder', 'COF'],
    ["Bob's Burger", 'BOB'],
    ['Level 3 Operator', 'L3O'],
  ])('matches CLI canonical derivation for %s', (name, expectedCode) => {
    const references = knownPersonaReferences(`## ${name}\n`);
    expect(derivePersonaCode(name)).toBe(expectedCode);
    expect(references.has(expectedCode)).toBe(true);
    expect(references.has(`${name} (${expectedCode})`)).toBe(true);
  });

  it('contributes name, code, and combined form', () => {
    const references = knownPersonaReferences('## Platform Operator (PO)\n');
    expect(references.has('Platform Operator (PO)')).toBe(true);
    expect(references.has('Platform Operator')).toBe(true);
    expect(references.has('PO')).toBe(true);
  });

  it('contributes the derived code for a bare-named persona (G9BXE9)', () => {
    const references = knownPersonaReferences('## Platform Operator\n');
    expect(references.has('Platform Operator')).toBe(true);
    expect(references.has('PLO')).toBe(true);
    expect(references.has('Platform Operator (PLO)')).toBe(true);
  });

  it('allocates canonical collision suffixes in persona source order', () => {
    const references = knownPersonaReferences('## Platform Operator\n\n## Planning Owner\n');
    expect(references.has('Platform Operator (PLO)')).toBe(true);
    expect(references.has('Planning Owner (PLO2)')).toBe(true);
  });

  it('does not let an explicit canonical code reserve its own derived alias', () => {
    const references = knownPersonaReferences('## Platform Operator (PLO)\n\n## Planning Owner\n');

    expect(references.has('Platform Operator (PLO)')).toBe(true);
    expect(references.has('Planning Owner (PLO2)')).toBe(true);
  });

  it('never exposes a derived collision code longer than four characters', () => {
    const content = Array.from({ length: 1000 }, (_, index) => `## Pl${index} Operator`).join('\n');
    const references = knownPersonaReferences(content);
    expect(references.has('Pl999 Operator (PLO1000)')).toBe(false);
    expect([...references].some(reference => /^PLO\d{4,}$/.test(reference))).toBe(false);
  });

  it('does not contain an undeclared reference', () => {
    expect(knownPersonaReferences('## Platform Operator (PO)\n').has('End User')).toBe(false);
  });

  it('degrades to an empty set on empty content without throwing', () => {
    expect(knownPersonaReferences('').size).toBe(0);
  });
});

describe('evaluateJtbdGate (Rule 6)', () => {
  it('passes one JTBD with a resolving persona', () => {
    const verdict = evaluateJtbdGate(
      spec('### a\n\n**Persona:** Platform Operator (PO)'),
      PERSONAS,
    );
    expect(verdict.ok).toBe(true);
  });

  it('passes a non-empty skip reason with zero JTBDs', () => {
    expect(evaluateJtbdGate(spec('skip: internal plumbing'), PERSONAS).ok).toBe(true);
  });

  it('denies zero JTBD entries with no skip', () => {
    const verdict = evaluateJtbdGate(spec(''), PERSONAS);
    expect(verdict.ok).toBe(false);
    expect(verdict).toMatchObject({ reason: expect.stringContaining('no Jobs To Be Done') });
  });

  it('denies a JTBD naming a persona absent from personas.md', () => {
    const verdict = evaluateJtbdGate(spec('### a\n\n**Persona:** Ghost Persona'), PERSONAS);
    expect(verdict.ok).toBe(false);
    expect(verdict).toMatchObject({ reason: expect.stringContaining('Ghost Persona') });
  });

  it('resolves a derived code against a bare-named persona (G9BXE9)', () => {
    const personas = '## Platform Operator\n\n**Role:** Owns infra.\n';
    const verdict = evaluateJtbdGate(spec('### x.PO1 — t\n\n**Persona:** PO'), personas);
    expect(verdict.ok).toBe(true);
  });

  it('resolves a legacy initials reference after the persona adopts a canonical code', () => {
    const personas = '## Safeword Maintainer (SWM)\n\n**Role:** Maintains safeword.\n';
    const verdict = evaluateJtbdGate(spec('### x.SM1 — t\n\n**Persona:** SM'), personas);

    expect(verdict.ok).toBe(true);
  });

  it('still denies an unknown persona after derivation (G9BXE9)', () => {
    const personas = '## Platform Operator\n\n**Role:** Owns infra.\n';
    const verdict = evaluateJtbdGate(spec('### a\n\n**Persona:** Ghost Persona'), personas);
    expect(verdict.ok).toBe(false);
  });

  it('denies a skip with an empty reason', () => {
    const verdict = evaluateJtbdGate(spec('skip:   '), PERSONAS);
    expect(verdict.ok).toBe(false);
    expect(verdict).toMatchObject({ reason: expect.stringContaining('no reason') });
  });

  it('denies the gate with an actionable error when canonical collision space is exhausted', () => {
    const personas = Array.from(
      { length: 1000 },
      (_, index) => `## Pl${index} Operator\n\n**Role:** Owns platform ${index}.`,
    ).join('\n\n');
    const verdict = evaluateJtbdGate(
      spec('### x.PLO1 — t\n\n**Persona:** Pl999 Operator'),
      personas,
    );

    expect(verdict.ok).toBe(false);
    expect(verdict).toMatchObject({
      reason: expect.stringMatching(/collision.*exhausted.*explicit.*3[–-]4/i),
    });
  });

  it('still resolves personas when a later JTBD carries an AC skip (31W8M3)', () => {
    // A per-JTBD AC `skip:` (after a `###`) must NOT leak into the section-level
    // skip and short-circuit persona resolution for an unresolved JTBD.
    const body =
      '### good.PO1 — t\n\n**Persona:** Platform Operator (PO)\n\n#### good.PO1.AC1 — cap\n\n### bad.XX1 — t2\n\n**Persona:** Ghost Persona\n\nskip: no AC needed';
    const verdict = evaluateJtbdGate(spec(body), PERSONAS);
    expect(verdict.ok).toBe(false);
    expect(verdict).toMatchObject({ reason: expect.stringContaining('Ghost Persona') });
  });
});
