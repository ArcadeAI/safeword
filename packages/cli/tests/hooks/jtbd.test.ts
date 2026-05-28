/**
 * Unit tests for the JTBD parser + gate-level persona resolution + gate
 * decision (ticket Y2HCNJ, slice C). Covers test-definitions.md Rules 4-6.
 * Pure functions — no filesystem.
 */

import { describe, expect, it } from 'vitest';

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
});

describe('knownPersonaRefs (Rule 5)', () => {
  it('contributes name, code, and combined form', () => {
    const references = knownPersonaReferences('## Platform Operator (PO)\n');
    expect(references.has('Platform Operator (PO)')).toBe(true);
    expect(references.has('Platform Operator')).toBe(true);
    expect(references.has('PO')).toBe(true);
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

  it('denies a skip with an empty reason', () => {
    const verdict = evaluateJtbdGate(spec('skip:   '), PERSONAS);
    expect(verdict.ok).toBe(false);
    expect(verdict).toMatchObject({ reason: expect.stringContaining('no reason') });
  });
});
