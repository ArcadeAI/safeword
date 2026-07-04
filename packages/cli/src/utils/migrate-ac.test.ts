/**
 * Unit tests for the `.AC` -> `.R` codemod core (ticket 1SVCB9, TB1).
 * Pure string transforms — no filesystem. Two entry points:
 *   - migrateSpecAc: rewrites `#### <id>.AC<n>` declaration headings, collision-aware.
 *   - migrateReferencesAc: rewrites `@<id>.AC<n>` feature tags and `### Scenario: <id>.AC<n>`
 *     ledger titles (references, never collision-checked).
 */

import { describe, expect, it } from 'vitest';

import { migrateReferencesAc as migrateReferencesAc, migrateSpecAc } from './migrate-ac.js';

const SPEC = (body: string): string =>
  `# Spec\n\n## Jobs To Be Done\n\n### demo.SM1 — Trace\n\n**Persona:** SM\n\n${body}\n`;

describe('migrateSpecAc (TB1.R1 — rewrite AC declaration headings)', () => {
  it('rewrites an AC heading to the same-numbered Rule heading', () => {
    const result = migrateSpecAc(SPEC('#### demo.SM1.AC3 — a capability'));
    expect(result.changed).toBe(true);
    expect(result.content).toContain('#### demo.SM1.R3 — a capability');
    expect(result.content).not.toContain('demo.SM1.AC3');
    expect(result.collisions).toEqual([]);
  });

  it('rewrites every AC under a JTBD with several criteria in one pass', () => {
    const result = migrateSpecAc(
      SPEC('#### demo.SM1.AC1 — one\n\n#### demo.SM1.AC2 — two\n\n#### demo.SM1.AC3 — three'),
    );
    expect(result.content).toContain('#### demo.SM1.R1 — one');
    expect(result.content).toContain('#### demo.SM1.R2 — two');
    expect(result.content).toContain('#### demo.SM1.R3 — three');
    expect(result.content).not.toMatch(/\.AC\d/);
  });

  it('TB1.R2 — refuses the whole file when an AC would collide with an existing Rule number', () => {
    const spec = SPEC('#### demo.SM1.AC1 — cap\n\n#### demo.SM1.R1 — invariant');
    const result = migrateSpecAc(spec);
    expect(result.changed).toBe(false);
    expect(result.content).toBe(spec);
    expect(result.collisions).toContain('demo.SM1');
  });

  it('TB1.R1 — leaves non-AC tokens (Rule ids, persona-code-R JTBD ids) untouched', () => {
    const spec = SPEC('#### demo.SM1.R1 — an invariant');
    const result = migrateSpecAc(spec);
    expect(result.changed).toBe(false);
    expect(result.content).toBe(spec);
  });

  it('is idempotent — a second run over migrated content is a no-op', () => {
    const once = migrateSpecAc(SPEC('#### demo.SM1.AC1 — cap')).content;
    const twice = migrateSpecAc(once);
    expect(twice.changed).toBe(false);
    expect(twice.content).toBe(once);
  });
});

describe('migrateReferencesAc (TB1.R1 — rewrite AC references)', () => {
  it('rewrites a feature-file AC tag to the same-numbered Rule tag', () => {
    const result = migrateReferencesAc('    @demo.SM1.AC3\n    Scenario: x\n');
    expect(result.changed).toBe(true);
    expect(result.content).toContain('@demo.SM1.R3');
    expect(result.content).not.toContain('@demo.SM1.AC3');
  });

  it('rewrites a test-definitions scenario-title AC ref', () => {
    const result = migrateReferencesAc('### Scenario: demo.SM1.AC3.happy_path\n');
    expect(result.content).toContain('### Scenario: demo.SM1.R3.happy_path');
    expect(result.content).not.toContain('AC3');
  });

  it('rewrites an AC tag carried on a Gherkin Rule block like any other tag', () => {
    const result = migrateReferencesAc('  @demo.SM1.AC1\n  Rule: demo.SM1.R1 — grouped\n');
    expect(result.content).toContain('@demo.SM1.R1');
    expect(result.content).not.toContain('@demo.SM1.AC1');
  });

  it('leaves a persona-code-R rule ref untouched and is idempotent', () => {
    const input = '    @feat.R1.R2\n    Scenario: persona-code-R rule\n';
    const result = migrateReferencesAc(input);
    expect(result.changed).toBe(false);
    expect(result.content).toBe(input);
  });

  it('rewrites tags but never `.AC` inside step text or Examples data', () => {
    const input = [
      '    @demo.SM1.AC1',
      '    Scenario: a scenario tagged "@feat.R1.AC1" in its own step text',
      '      Given a feature scenario tagged "@feat.R1.AC1"',
      '      Then the ref is "demo.SM1.AC2"',
      '',
      '      Examples:',
      '        | ref          |',
      '        | demo.SM1.AC9 |',
    ].join('\n');
    const result = migrateReferencesAc(input);
    // The real tag line migrates...
    expect(result.content).toContain('    @demo.SM1.R1');
    // ...but quoted `.AC` in step text and Examples data is left verbatim.
    expect(result.content).toContain('tagged "@feat.R1.AC1"');
    expect(result.content).toContain('"demo.SM1.AC2"');
    expect(result.content).toContain('| demo.SM1.AC9 |');
  });
});
