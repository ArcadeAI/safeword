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
  buildCoverageReportFromFeature,
  buildSurfaceCoverageReportFromFeature,
  findMixedCriteriaJtbds,
  findRulesMissingRejectionPaths,
  parseAcIdsByJtbd,
  parseAcReferenceFromTitle,
  parseAffectedSurfaceReferences,
  parseCriteriaIdsByJtbd,
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
const ONE_RULE =
  '### demo.DEV2 — Retry\n\n**Persona:** DEV\n\n#### demo.DEV2.R1 — failed deliveries retry on backoff';
const MIXED = `${ONE_AC}\n\n#### demo.DEV1.R1 — an invariant slipped in beside the AC`;

describe('parseAcReferenceFromTitle (R1 — title parses to its AC reference, or none)', () => {
  it('cross-reference-numbering.DEV1.AC1.conformant_title_yields_ac_ref', () => {
    expect(parseAcReferenceFromTitle('oauth-flow.PO1.AC2.change_association_applies')).toBe(
      'oauth-flow.PO1.AC2',
    );
  });

  it('cross-reference-numbering.DEV1.AC1.free_text_title_yields_no_ref', () => {
    expect(parseAcReferenceFromTitle('A JTBD with at least one AC passes')).toBeUndefined();
  });

  it('a single-token title missing the AC segment yields no ref', () => {
    // Malformed conformant-looking title folds into the no-ref partition.
    expect(parseAcReferenceFromTitle('demo.DEV1.no_ac_here')).toBeUndefined();
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

describe('parseCriteriaIdsByJtbd (rule tier — AC vs R heading classification)', () => {
  it('rule-tier.TB3.AC1.groups_rule_ids_separately_from_ac_ids', () => {
    const byJtbd = parseCriteriaIdsByJtbd(spec(`${TWO_ACS}\n\n${ONE_RULE}`));
    expect(byJtbd.get('demo.DEV1')).toEqual({
      acIds: ['demo.DEV1.AC1', 'demo.DEV1.AC2'],
      ruleIds: [],
    });
    expect(byJtbd.get('demo.DEV2')).toEqual({ acIds: [], ruleIds: ['demo.DEV2.R1'] });
  });

  it('rule-tier.TB3.AC1.ac_shaped_heading_wins_over_rule_shaped_prefix', () => {
    // Persona code `R`: feat.R1 is the JTBD id, its heading declares an AC.
    const byJtbd = parseCriteriaIdsByJtbd(
      spec('### feat.R1 — Review\n\n**Persona:** R\n\n#### feat.R1.AC1 — reviewable'),
    );
    expect(byJtbd.get('feat.R1')).toEqual({ acIds: ['feat.R1.AC1'], ruleIds: [] });
  });

  it('rule-tier.TB1.AC3.parse_ac_ids_no_longer_counts_rule_headings', () => {
    const byJtbd = parseAcIdsByJtbd(spec(ONE_RULE));
    expect(byJtbd.get('demo.DEV2')).toEqual([]);
  });
});

describe('findMixedCriteriaJtbds (rule tier — one criteria kind per JTBD)', () => {
  it('rule-tier.TB1.AC4.mixed_jtbd_detected', () => {
    expect(findMixedCriteriaJtbds(spec(MIXED))).toEqual(['demo.DEV1']);
  });

  it('rule-tier.TB1.AC4.single_kind_jtbds_not_mixed', () => {
    expect(findMixedCriteriaJtbds(spec(`${TWO_ACS}\n\n${ONE_RULE}`))).toEqual([]);
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

describe('buildCoverageReportFromFeature (feature files as source)', () => {
  function feature(tags: readonly string[]): string {
    return [
      'Feature: Demo',
      '',
      '  Rule: r',
      '',
      ...tags.flatMap(tag => [
        `    @${tag}`,
        `    Scenario: ${tag}`,
        '      Given a',
        '      When b',
        '      Then c',
        '',
      ]),
    ].join('\n');
  }

  it('feature-files-as-source.SM1.AC1.covered_tag_not_flagged', () => {
    const report = buildCoverageReportFromFeature(spec(ONE_AC), feature(['demo.DEV1.AC1']));
    expect(report).toEqual({ uncovered: [], stale: [], orphan: [] });
  });

  it('feature-files-as-source.SM1.AC1.uncovered_ac_flagged_from_feature_tags', () => {
    const report = buildCoverageReportFromFeature(spec(TWO_ACS), feature(['demo.DEV1.AC1']));
    expect(report.uncovered).toEqual(['demo.DEV1.AC2']);
  });

  it('feature-files-as-source.SM1.AC1.stale_and_orphan_tags_flagged', () => {
    const report = buildCoverageReportFromFeature(
      spec(ONE_AC),
      feature(['demo.DEV1.AC5', 'ghost.SM1.AC1']),
    );
    expect(report.stale).toEqual(['demo.DEV1.AC5']);
    expect(report.orphan).toEqual(['ghost.SM1.AC1']);
  });

  it('rule-tier.TB3.AC1.uncovered_spec_rule_flagged', () => {
    const report = buildCoverageReportFromFeature(spec(ONE_RULE), feature(['other.SM1.AC1']));
    expect(report.uncovered).toEqual(['demo.DEV2.R1']);
  });

  it('rule-tier.TB3.AC1.stale_rule_ref_flagged', () => {
    const report = buildCoverageReportFromFeature(spec(ONE_RULE), feature(['demo.DEV2.R5']));
    expect(report.stale).toEqual(['demo.DEV2.R5']);
    expect(report.orphan).toEqual([]);
  });

  it('rule-tier.TB3.AC1.orphan_rule_ref_flagged', () => {
    const report = buildCoverageReportFromFeature(spec(ONE_RULE), feature(['ghost.SM1.R1']));
    expect(report.orphan).toEqual(['ghost.SM1.R1']);
    expect(report.stale).toEqual([]);
  });

  it('rule-tier.TB4.AC1.rule_numbered_corpus_fully_resolves', () => {
    const corpusSpec = spec(
      `${ONE_RULE}\n\n#### demo.DEV2.R2 — deliveries stop after the retry budget`,
    );
    const report = buildCoverageReportFromFeature(
      corpusSpec,
      feature(['demo.DEV2.R1', 'demo.DEV2.R2']),
    );
    expect(report).toEqual({ uncovered: [], stale: [], orphan: [] });
  });

  it('rule-tier.TB2.AC1.ac_segment_ref_attributed_to_ac_not_rule', () => {
    const personaRSpec = spec(
      '### feat.R1 — Review\n\n**Persona:** R\n\n#### feat.R1.AC1 — reviewable',
    );
    const report = buildCoverageReportFromFeature(personaRSpec, feature(['feat.R1.AC1']));
    expect(report).toEqual({ uncovered: [], stale: [], orphan: [] });
  });
});

describe('findRulesMissingRejectionPaths (rule tier — rejection-path visibility)', () => {
  function toTagLine(tags: readonly string[]): string {
    return tags.map(tag => `@${tag}`).join(' ');
  }

  function featureWithScenarios(
    scenarios: readonly { tags: readonly string[]; title: string }[],
    ruleLine = '  Rule: demo.DEV2.R1 — failed deliveries retry on backoff',
  ): string {
    return [
      'Feature: Demo',
      '',
      ruleLine,
      '',
      ...scenarios.flatMap(({ tags, title }) => [
        ...(tags.length > 0 ? [`    ${toTagLine(tags)}`] : []),
        `    Scenario: ${title}`,
        '      Given a',
        '      When b',
        '      Then c',
        '',
      ]),
    ].join('\n');
  }

  it('rule-tier.TB1.AC2.numbered_rule_without_rejection_scenario_flagged', () => {
    const missing = findRulesMissingRejectionPaths(
      spec(ONE_RULE),
      featureWithScenarios([{ tags: ['demo.DEV2.R1'], title: 'happy path only' }]),
    );
    expect(missing).toEqual(['demo.DEV2.R1']);
  });

  it('rule-tier.TB1.AC2.numbered_rule_with_rejection_scenario_silent', () => {
    const missing = findRulesMissingRejectionPaths(
      spec(ONE_RULE),
      featureWithScenarios([
        { tags: ['demo.DEV2.R1'], title: 'happy path' },
        { tags: ['demo.DEV2.R1', 'rejection'], title: 'refused when budget exhausted' },
      ]),
    );
    expect(missing).toEqual([]);
  });

  it('rule-tier.TB1.AC2.unnumbered_rule_block_exempt', () => {
    const missing = findRulesMissingRejectionPaths(
      spec(ONE_AC),
      featureWithScenarios(
        [{ tags: ['demo.DEV1.AC1'], title: 'flat lineage under a grouping header' }],
        '  Rule: plain grouping header',
      ),
    );
    expect(missing).toEqual([]);
  });

  it('rule-tier.TB1.AC2.rule_with_no_scenarios_left_to_uncovered_bucket', () => {
    const missing = findRulesMissingRejectionPaths(
      spec(ONE_RULE),
      featureWithScenarios([{ tags: ['other.SM1.AC1'], title: 'unrelated scenario' }]),
    );
    expect(missing).toEqual([]);
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

describe('parseAffectedSurfaceReferences', () => {
  it('reads affected surfaces from the Surfaces section', () => {
    const references = parseAffectedSurfaceReferences(
      [
        '# Spec',
        '',
        '## Surfaces',
        '',
        'Affected:',
        '- Claude Code',
        '- OpenAI Codex',
        '- Cursor',
        '',
        'Unaffected:',
        '- MCP — no protocol behavior changes',
        '',
        '## Jobs To Be Done',
        '',
      ].join('\n'),
    );

    expect(references).toEqual([
      { name: 'Claude Code', slug: 'claude-code', skipped: false },
      { name: 'OpenAI Codex', slug: 'openai-codex', skipped: false },
      { name: 'Cursor', slug: 'cursor', skipped: false },
    ]);
  });

  it('ignores commented template examples and records explicit affected-surface skips', () => {
    const references = parseAffectedSurfaceReferences(
      [
        '# Spec',
        '',
        '## Surfaces',
        '',
        '<!--',
        'Affected:',
        '- Claude Code',
        '-->',
        '',
        'Affected:',
        '- OpenAI Codex — skip: shared generated skill fixture covers Codex',
        '- Cursor',
        '',
      ].join('\n'),
    );

    expect(references).toEqual([
      { name: 'OpenAI Codex', slug: 'openai-codex', skipped: true },
      { name: 'Cursor', slug: 'cursor', skipped: false },
    ]);
  });
});

describe('buildSurfaceCoverageReportFromFeature', () => {
  function surfaceSpec(body: string): string {
    return ['# Spec', '', '## Surfaces', '', body, '', '## Jobs To Be Done', ''].join('\n');
  }

  function feature(tags: readonly string[]): string {
    return [
      'Feature: Demo',
      '',
      '  Rule: r',
      '',
      `    ${toTagLine(tags)}`,
      '    Scenario: covered surface',
      '      Given a',
      '      When b',
      '      Then c',
      '',
    ].join('\n');
  }

  function toTagLine(tags: readonly string[]): string {
    return tags.map(tag => `@${tag}`).join(' ');
  }

  it('reports affected surfaces that have no matching feature tag', () => {
    const report = buildSurfaceCoverageReportFromFeature(
      surfaceSpec(['Affected:', '- Claude Code', '- OpenAI Codex', '- Cursor'].join('\n')),
      feature(['surface.claude-code']),
    );

    expect(report).toEqual({
      missing: [
        { name: 'OpenAI Codex', slug: 'openai-codex' },
        { name: 'Cursor', slug: 'cursor' },
      ],
      stale: [],
    });
  });

  it('accepts one scenario carrying multiple surface tags', () => {
    const report = buildSurfaceCoverageReportFromFeature(
      surfaceSpec(['Affected:', '- Claude Code', '- OpenAI Codex', '- Cursor'].join('\n')),
      feature(['surface.claude-code', 'surface.openai-codex', 'surface.cursor']),
    );

    expect(report).toEqual({ missing: [], stale: [] });
  });

  it('does not require tags for explicitly skipped affected surfaces', () => {
    const report = buildSurfaceCoverageReportFromFeature(
      surfaceSpec(
        ['Affected:', '- Claude Code', '- OpenAI Codex — skip: not supported in this feature'].join(
          '\n',
        ),
      ),
      feature(['surface.claude-code']),
    );

    expect(report).toEqual({ missing: [], stale: [] });
  });

  it('reports a surface tag that is not listed as affected', () => {
    const report = buildSurfaceCoverageReportFromFeature(
      surfaceSpec(['Affected:', '- Claude Code'].join('\n')),
      feature(['surface.claude-code', 'surface.cursor']),
    );

    expect(report).toEqual({ missing: [], stale: ['cursor'] });
  });

  it('stays quiet when the spec has no affected surfaces or no feature source', () => {
    expect(buildSurfaceCoverageReportFromFeature(surfaceSpec('Affected:'), feature([]))).toEqual({
      missing: [],
      stale: [],
    });
    expect(buildSurfaceCoverageReportFromFeature(surfaceSpec('Affected:\n- Claude Code'))).toEqual({
      missing: [],
      stale: [],
    });
  });
});
