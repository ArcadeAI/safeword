/**
 * Unit tests for scenario-lineage coverage (ticket XT1FFM).
 *
 * Pure functions — no filesystem. Covers the 9 scenarios in
 * `.safeword-project/tickets/XT1FFM/test-definitions.md`:
 *   - R1 (AC1): a scenario title parses to its AC reference, or to none.
 *   - R2 (AC2): `safeword check`'s report buckets gaps as uncovered / stale / orphan.
 *   - R3 (AC2): the report degrades quietly when inputs are absent.
 *
 * The check.ts integration (ticket scanning → advisory output) is covered by
 * tests/commands/check.test.ts; here we exercise the report contract directly.
 */

import { describe, expect, it } from 'vitest';

import {
  buildCoverageReport,
  parseAcIdsByJtbd,
  parseAcReferenceFromTitle,
} from './scenario-coverage.js';

/** Wrap a JTBD/AC body in a minimal spec.md with the required section heading. */
function spec(jtbdBody: string): string {
  return `# Spec\n\n## Intent\n\nWhy.\n\n## Jobs To Be Done\n\n${jtbdBody}\n\n## Outcomes\n\nDone.\n`;
}

/** Build a test-definitions.md from a list of `### Scenario:` titles. */
function testDefinitions(titles: readonly string[]): string {
  const body = titles
    .map(
      title =>
        `### Scenario: ${title}\n\nGiven a\nWhen b\nThen c\n\n- [ ] RED\n- [ ] GREEN\n- [ ] REFACTOR`,
    )
    .join('\n\n');
  return `# Test Definitions\n\n## Rule: r\n\n${body}\n`;
}

const ONE_AC = '### demo.DEV1 — Trace\n\n**Persona:** DEV\n\n#### demo.DEV1.AC1 — capability one';
const TWO_ACS = `${ONE_AC}\n\n#### demo.DEV1.AC2 — capability two`;

describe('parseAcReferenceFromTitle (R1 — title parses to its AC reference, or none)', () => {
  it('cross-reference-numbering.DEV1.AC1.conformant_title_yields_ac_ref', () => {
    expect(parseAcReferenceFromTitle('oauth-flow.PO1.AC2.change_association_applies')).toBe(
      'oauth-flow.PO1.AC2',
    );
  });

  it('cross-reference-numbering.DEV1.AC1.free_text_title_yields_no_ref', () => {
    expect(parseAcReferenceFromTitle('A JTBD with at least one AC passes')).toBeNull();
  });

  it('a single-token title missing the AC segment yields no ref', () => {
    // Malformed conformant-looking title folds into the no-ref partition.
    expect(parseAcReferenceFromTitle('demo.DEV1.no_ac_here')).toBeNull();
  });
});

describe('parseAcIdsByJtbd (supporting — AC ids grouped by JTBD)', () => {
  it('groups AC ids under their JTBD id', () => {
    const byJtbd = parseAcIdsByJtbd(spec(TWO_ACS));
    expect(byJtbd.get('demo.DEV1')).toEqual(['demo.DEV1.AC1', 'demo.DEV1.AC2']);
  });

  it('ignores an HTML-commented example AC', () => {
    const byJtbd = parseAcIdsByJtbd(spec('<!--\n### ex.DEV1 — t\n\n#### ex.DEV1.AC1 — a\n-->'));
    expect(byJtbd.size).toBe(0);
  });
});

describe('buildCoverageReport (R2 — three buckets)', () => {
  it('cross-reference-numbering.DEV1.AC2.covered_ac_not_flagged', () => {
    const report = buildCoverageReport(spec(ONE_AC), testDefinitions(['demo.DEV1.AC1.happy_path']));
    expect(report).toEqual({ uncovered: [], stale: [], orphan: [] });
  });

  it('cross-reference-numbering.DEV1.AC2.uncovered_ac_flagged', () => {
    const report = buildCoverageReport(
      spec(TWO_ACS),
      testDefinitions(['demo.DEV1.AC1.happy_path']),
    );
    expect(report.uncovered).toEqual(['demo.DEV1.AC2']);
  });

  it('cross-reference-numbering.DEV1.AC2.stale_ac_ref_flagged', () => {
    const report = buildCoverageReport(
      spec(ONE_AC),
      testDefinitions(['demo.DEV1.AC1.happy_path', 'demo.DEV1.AC5.renumbered']),
    );
    expect(report.stale).toEqual(['demo.DEV1.AC5']);
    expect(report.orphan).toEqual([]);
  });

  it('cross-reference-numbering.DEV1.AC2.orphan_scenario_flagged', () => {
    const report = buildCoverageReport(
      spec(ONE_AC),
      testDefinitions(['demo.DEV1.AC1.happy_path', 'ghost.SM1.AC1.absent_jtbd']),
    );
    expect(report.orphan).toEqual(['ghost.SM1.AC1']);
    expect(report.stale).toEqual([]);
  });

  it('cross-reference-numbering.DEV1.AC2.multiple_scenarios_per_ac_covered', () => {
    const report = buildCoverageReport(
      spec(ONE_AC),
      testDefinitions(['demo.DEV1.AC1.case_a', 'demo.DEV1.AC1.case_b']),
    );
    expect(report).toEqual({ uncovered: [], stale: [], orphan: [] });
  });
});

describe('buildCoverageReport (R3 — quiet degradation)', () => {
  it('cross-reference-numbering.DEV1.AC2.spec_acs_without_test_definitions_no_flags', () => {
    // No test-definitions.md → the content argument is omitted entirely.
    const report = buildCoverageReport(spec(TWO_ACS));
    expect(report).toEqual({ uncovered: [], stale: [], orphan: [] });
  });

  it('cross-reference-numbering.DEV1.AC2.no_acs_yields_empty_report', () => {
    const noAcs = spec('### demo.DEV1 — Trace\n\n**Persona:** DEV');
    const report = buildCoverageReport(noAcs, testDefinitions(['demo.DEV1.AC1.x']));
    expect(report).toEqual({ uncovered: [], stale: [], orphan: [] });
  });
});
