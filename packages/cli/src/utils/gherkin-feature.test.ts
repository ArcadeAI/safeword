import { describe, expect, it } from 'vitest';

import {
  FeatureParseError,
  findFeatureLineageIssues,
  findGherkinLintIssues,
  parseFeatureAcReferences,
  parseFeatureRuleReferences,
  parseFeatureScenarios,
} from './gherkin-feature.js';

const FEATURE = [
  '@feature-files-as-source.SM1.AC1',
  'Feature: Feature files are source',
  '',
  '  @feature-files-as-source.SM1.AC2',
  '  Rule: Feature tags drive tools',
  '',
  '    @feature-files-as-source.SM1.AC3',
  '    Scenario: feature source one',
  '      Given a feature source',
  '      When codify runs',
  '      Then a Vitest skeleton is emitted',
  '',
  '    Scenario: feature source two',
  '      Given another feature source',
  '      When check runs',
  '      Then coverage is reported',
].join('\n');

describe('parseFeatureScenarios', () => {
  it('feature-files-as-source.SM1.AC2.parses_rule_scenario_steps_and_tags', () => {
    const scenarios = parseFeatureScenarios(FEATURE);

    expect(scenarios).toEqual([
      {
        rule: 'Feature tags drive tools',
        title: 'feature source one',
        steps: ['Given a feature source', 'When codify runs', 'Then a Vitest skeleton is emitted'],
        tags: [
          '@feature-files-as-source.SM1.AC1',
          '@feature-files-as-source.SM1.AC2',
          '@feature-files-as-source.SM1.AC3',
        ],
      },
      {
        rule: 'Feature tags drive tools',
        title: 'feature source two',
        steps: ['Given another feature source', 'When check runs', 'Then coverage is reported'],
        tags: ['@feature-files-as-source.SM1.AC1', '@feature-files-as-source.SM1.AC2'],
      },
    ]);
  });

  it('feature-files-as-source.SM1.AC2.expands_scenario_outline_examples', () => {
    const scenarios = parseFeatureScenarios(
      [
        'Feature: Feature files are source',
        '',
        '  Rule: Feature tags drive tools',
        '',
        '    @feature-files-as-source.SM1.AC1',
        '    Scenario Outline: generated rows preserve example inputs',
        '      Given a <source> feature file',
        '      Then codify emits <result>',
        '',
        '      @feature-files-as-source.SM1.AC2',
        '      Examples: source rows',
        '        | source | result       |',
        '        | valid  | a test stub  |',
        '        | tagged | coverage tag |',
      ].join('\n'),
    );

    expect(scenarios).toEqual([
      {
        rule: 'Feature tags drive tools',
        title: 'generated rows preserve example inputs (source=valid, result=a test stub)',
        steps: ['Given a valid feature file', 'Then codify emits a test stub'],
        tags: ['@feature-files-as-source.SM1.AC1', '@feature-files-as-source.SM1.AC2'],
      },
      {
        rule: 'Feature tags drive tools',
        title: 'generated rows preserve example inputs (source=tagged, result=coverage tag)',
        steps: ['Given a tagged feature file', 'Then codify emits coverage tag'],
        tags: ['@feature-files-as-source.SM1.AC1', '@feature-files-as-source.SM1.AC2'],
      },
    ]);
  });

  it('feature-files-as-source.SM1.AC2.wraps_parser_errors', () => {
    expect(() =>
      parseFeatureScenarios(
        ['Feature: Broken', '  Scenario: bad', '    Given ok', '    nope'].join('\n'),
      ),
    ).toThrow(FeatureParseError);
  });

  it('feature-files-as-source.SM1.AC2.preserves_backgrounds_doc_strings_and_data_tables', () => {
    const scenarios = parseFeatureScenarios(
      [
        '@demo.DEV1.AC1',
        'Feature: Demo',
        '',
        '  Background:',
        '    Given feature context',
        '      | name | value |',
        '      | tier | beta  |',
        '',
        '  Rule: lifecycle',
        '',
        '    Background:',
        '      Given rule context',
        '      """json',
        '      {"enabled": true}',
        '      """',
        '',
        '    Scenario: scenario keeps all arguments',
        '      When the user submits',
        '      Then the response is accepted',
        '',
      ].join('\n'),
    );

    expect(scenarios[0]?.steps).toEqual([
      'Given feature context',
      '| name | value |',
      '| tier | beta |',
      'Given rule context',
      '"""json',
      '{"enabled": true}',
      '"""',
      'When the user submits',
      'Then the response is accepted',
    ]);
  });
});

describe('parseFeatureAcReferences', () => {
  it('feature-files-as-source.SM1.AC1.extracts_unique_lineage_refs_from_inherited_tags', () => {
    expect(parseFeatureAcReferences(FEATURE)).toEqual([
      'feature-files-as-source.SM1.AC1',
      'feature-files-as-source.SM1.AC2',
      'feature-files-as-source.SM1.AC3',
    ]);
  });
});

describe('findGherkinLintIssues', () => {
  it('gherkin-linting.DEV1.AC1.flags_parser_and_style_errors_without_legacy_dependency', () => {
    const issues = findGherkinLintIssues(
      ['Feature: Broken', '  Scenario: bad ', '    Given ok', '    nope'].join('\n'),
      { filePath: 'features/bad_name.feature' },
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'file-name' }),
        expect.objectContaining({ rule: 'new-line-at-eof' }),
        expect.objectContaining({ line: 2, rule: 'no-trailing-spaces' }),
        expect.objectContaining({ rule: 'parse' }),
      ]),
    );
  });

  it('gherkin-linting.DEV1.AC1.flags_duplicate_scenario_names', () => {
    const issues = findGherkinLintIssues(
      [
        'Feature: Demo',
        '',
        '  Scenario: duplicated',
        '    Given one',
        '',
        '  Scenario: duplicated',
        '    Given two',
        '',
      ].join('\n'),
      { filePath: 'features/demo.feature' },
    );

    expect(issues).toContainEqual(
      expect.objectContaining({ line: 6, rule: 'no-dupe-scenario-names' }),
    );
  });

  it('gherkin-linting.DEV1.AC1.flags_scenario_outline_placeholder_mismatches', () => {
    const issues = findGherkinLintIssues(
      [
        'Feature: Demo',
        '',
        '  Scenario Outline: <action> emits <result>',
        '    Given a <source> feature file',
        '    When codify runs',
        '    Then it emits <missing>',
        '      """json',
        '      {"mode": "<mode>"}',
        '      """',
        '    And metadata is preserved',
        '      | field | value  |',
        '      | owner | <owner> |',
        '',
        '    Examples: source rows',
        '      | action | result | source | mode | unused |',
        '      | codify | test   | valid  | red  | extra  |',
        '',
      ].join('\n'),
      { filePath: 'features/demo.feature' },
    );

    const usesMissing = expect.stringContaining('uses <missing>');
    const usesOwner = expect.stringContaining('uses <owner>');
    const definesUnused = expect.stringContaining('defines <unused>');
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: usesMissing,
          rule: 'no-unused-variables',
        }),
        expect.objectContaining({
          message: usesOwner,
          rule: 'no-unused-variables',
        }),
        expect.objectContaining({
          message: definesUnused,
          rule: 'no-unused-variables',
        }),
      ]),
    );
  });

  it('gherkin-linting.DEV1.AC2.leaves_safeword_lineage_to_check_command', () => {
    const content = [
      'Feature: Demo',
      '',
      '  Scenario: has no lineage tag',
      '    Given a',
      '    When b',
      '    Then c',
      '',
    ].join('\n');

    expect(findGherkinLintIssues(content, { filePath: 'features/demo.feature' })).toEqual([]);
    expect(findFeatureLineageIssues(content)).toEqual([
      'Scenario "has no lineage tag" is missing lineage; add exactly one @<jtbd>.AC# or @<jtbd>.R# tag.',
    ]);
  });
});

describe('findGherkinLintIssues (rule tier — name-token/tag correspondence)', () => {
  function ruleFeature(tagLine: string, ruleName: string): string {
    return [
      'Feature: Demo',
      '',
      ...(tagLine === '' ? [] : [`  ${tagLine}`]),
      `  Rule: ${ruleName}`,
      '',
      '    Scenario: example',
      '      Given a',
      '      When b',
      '      Then c',
      '',
    ].join('\n');
  }

  it('rule-tier.TB2.AC1.rule_tag_matching_name_token_passes', () => {
    const issues = findGherkinLintIssues(
      ruleFeature('@demo.DEV1.R1', 'demo.DEV1.R1 — retries use exponential backoff'),
      { filePath: 'features/demo.feature' },
    );
    expect(issues).toEqual([]);
  });

  it('rule-tier.TB2.AC1.rule_tag_disagreeing_with_name_token_flagged', () => {
    const issues = findGherkinLintIssues(
      ruleFeature('@demo.DEV1.R1', 'demo.DEV1.R2 — renamed without retagging'),
      { filePath: 'features/demo.feature' },
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        line: 4,
        message:
          'Rule "demo.DEV1.R2 — renamed without retagging" is tagged @demo.DEV1.R1 but its name starts with a different id; make the name\'s first token match the tag.',
        rule: 'rule-name-tag-mismatch',
      }),
    );
  });

  it('rule-tier.TB2.AC1.rule_tag_with_plain_name_flagged', () => {
    const issues = findGherkinLintIssues(ruleFeature('@demo.DEV1.R1', 'plain grouping words'), {
      filePath: 'features/demo.feature',
    });
    expect(issues).toContainEqual(expect.objectContaining({ rule: 'rule-name-tag-mismatch' }));
  });

  it('rule-tier.TB2.AC1.name_token_glued_to_em_dash_still_matches', () => {
    const issues = findGherkinLintIssues(
      ruleFeature('@demo.DEV1.R1', 'demo.DEV1.R1—retries use exponential backoff'),
      { filePath: 'features/demo.feature' },
    );
    expect(issues.filter(issue => issue.rule === 'rule-name-tag-mismatch')).toEqual([]);
  });

  it('rule-tier.TB2.AC1.unnumbered_rule_block_exempt_from_mismatch', () => {
    const issues = findGherkinLintIssues(ruleFeature('', 'plain grouping words'), {
      filePath: 'features/demo.feature',
    });
    expect(issues).toEqual([]);
  });
});

describe('findFeatureLineageIssues', () => {
  it('gherkin-linting.DEV1.AC2.accepts_one_effective_ac_tag_after_inheritance', () => {
    const issues = findFeatureLineageIssues(
      [
        '@demo.DEV1.AC1',
        'Feature: Demo',
        '',
        '  Rule: r',
        '',
        '    Scenario: inherits the AC tag',
        '      Given a',
        '      When b',
        '      Then c',
      ].join('\n'),
    );

    expect(issues).toEqual([]);
  });

  it('gherkin-linting.DEV1.AC2.flags_missing_and_multiple_effective_ac_tags', () => {
    const issues = findFeatureLineageIssues(
      [
        'Feature: Demo',
        '',
        '  Rule: r',
        '',
        '    Scenario: has no AC tag',
        '      Given a',
        '      When b',
        '      Then c',
        '',
        '  @demo.DEV1.AC1',
        '  Rule: tagged rule',
        '',
        '    @demo.DEV1.AC2',
        '    Scenario: carries two AC tags',
        '      Given a',
        '      When b',
        '      Then c',
      ].join('\n'),
    );

    expect(issues).toEqual([
      'Scenario "has no AC tag" is missing lineage; add exactly one @<jtbd>.AC# or @<jtbd>.R# tag.',
      'Scenario "carries two AC tags" has multiple lineage tags after inheritance (@demo.DEV1.AC1, @demo.DEV1.AC2); keep exactly one @<jtbd>.AC# or @<jtbd>.R# tag.',
    ]);
  });

  it('rule-tier.TB2.AC1.accepts_inherited_rule_tag_as_single_lineage', () => {
    const issues = findFeatureLineageIssues(
      [
        'Feature: Demo',
        '',
        '  @demo.DEV1.R1',
        '  Rule: demo.DEV1.R1 — retries use exponential backoff',
        '',
        '    Scenario: inherits the rule tag',
        '      Given a',
        '      When b',
        '      Then c',
      ].join('\n'),
    );

    expect(issues).toEqual([]);
  });

  it('rule-tier.TB2.AC1.accepts_direct_rule_tag_on_scenario', () => {
    const issues = findFeatureLineageIssues(
      [
        'Feature: Demo',
        '',
        '  Rule: grouping only',
        '',
        '    @demo.DEV1.R2',
        '    Scenario: carries the rule tag directly',
        '      Given a',
        '      When b',
        '      Then c',
      ].join('\n'),
    );

    expect(issues).toEqual([]);
  });

  it('rule-tier.TB2.AC1.flags_second_lineage_ref_under_rule_tagged_block', () => {
    const issues = findFeatureLineageIssues(
      [
        'Feature: Demo',
        '',
        '  @demo.DEV1.R1',
        '  Rule: demo.DEV1.R1 — retries use exponential backoff',
        '',
        '    @demo.DEV1.AC1',
        '    Scenario: adds an AC ref under a rule-tagged block',
        '      Given a',
        '      When b',
        '      Then c',
      ].join('\n'),
    );

    expect(issues).toEqual([
      'Scenario "adds an AC ref under a rule-tagged block" has multiple lineage tags after inheritance (@demo.DEV1.R1, @demo.DEV1.AC1); keep exactly one @<jtbd>.AC# or @<jtbd>.R# tag.',
    ]);
  });
});

describe('parseFeatureRuleReferences', () => {
  it('rule-tier.TB2.AC1.extracts_unique_rule_refs_from_inherited_tags', () => {
    const references = parseFeatureRuleReferences(
      [
        'Feature: Demo',
        '',
        '  @demo.DEV1.R1',
        '  Rule: demo.DEV1.R1 — retries use exponential backoff',
        '',
        '    Scenario: first example',
        '      Given a',
        '',
        '    Scenario: second example',
        '      Given b',
        '',
        '  Rule: grouping only',
        '',
        '    @demo.DEV1.R2',
        '    Scenario: direct rule ref',
        '      Given c',
      ].join('\n'),
    );

    expect(references).toEqual(['demo.DEV1.R1', 'demo.DEV1.R2']);
  });

  it('rule-tier.TB2.AC1.terminal_rule_segment_keeps_whole_id', () => {
    // A persona code `R` JTBD (`feat.R1`) declaring rule R2: the tag's parsed id
    // must be the whole `feat.R1.R2`, matching the spec-side declaration, not a
    // lazy first-match `feat.R1`.
    const content = [
      'Feature: Demo',
      '',
      '  @feat.R1.R2',
      '  Rule: feat.R1.R2 — invariant under a persona-code-R job',
      '',
      '    Scenario: example',
      '      Given a',
      '      When b',
      '      Then c',
    ].join('\n');

    expect(parseFeatureRuleReferences(content)).toEqual(['feat.R1.R2']);
    expect(findFeatureLineageIssues(content)).toEqual([]);
  });

  it('rule-tier.TB2.AC1.ac_segment_wins_over_rule_shaped_prefix', () => {
    const content = [
      'Feature: Demo',
      '',
      '  Scenario: persona code R makes an AC tag look rule-shaped',
      '    Given a scenario tagged with an AC of JTBD feat.R1',
      '    When b',
      '    Then c',
    ].join('\n');
    const tagged = content.replace('  Scenario:', '  @feat.R1.AC1\n  Scenario:');

    expect(parseFeatureRuleReferences(tagged)).toEqual([]);
    expect(parseFeatureAcReferences(tagged)).toEqual(['feat.R1.AC1']);
    expect(findFeatureLineageIssues(tagged)).toEqual([]);
  });
});
