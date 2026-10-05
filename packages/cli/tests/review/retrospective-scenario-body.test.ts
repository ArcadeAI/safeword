import { describe, expect, it } from 'vitest';

import { scenarioBodyDigest } from '../../src/review/retrospective-scenario-body.js';

const feature = [
  'Feature: review targets',
  '  Rule: generated targets',
  '    Scenario: nested project',
  '      Given a nested project',
  '      When the builder reviews a target',
  '      Then the generated target is excluded',
  '',
  '    Scenario Outline: alias resolution',
  '      Given alias <name>',
  '      Then one target remains',
  '      Examples:',
  '        | name |',
  '        | link |',
  '',
].join('\n');

describe('retrospective scenario source identity', () => {
  it('returns the same digest for the same scenario body', () => {
    expect(scenarioBodyDigest(feature, 'nested project')).toBe(
      scenarioBodyDigest(feature, 'nested project'),
    );
    expect(scenarioBodyDigest(feature, 'nested project')).toMatch(/^[a-f\d]{64}$/u);
  });

  it('changes when the named scenario behavior changes', () => {
    const changed = feature.replace(
      'Then the generated target is excluded',
      'Then every target is reviewed',
    );
    expect(scenarioBodyDigest(changed, 'nested project')).not.toBe(
      scenarioBodyDigest(feature, 'nested project'),
    );
  });

  it('leaves another scenario identity intact when one body changes', () => {
    const changed = feature.replace(
      'Then the generated target is excluded',
      'Then every target is reviewed',
    );
    expect(scenarioBodyDigest(changed, 'alias resolution')).toBe(
      scenarioBodyDigest(feature, 'alias resolution'),
    );
  });

  it('binds tags immediately before the selected scenario', () => {
    const tagged = feature.replace(
      '    Scenario: nested project',
      '    @wip\n    Scenario: nested project',
    );
    expect(scenarioBodyDigest(tagged, 'nested project')).not.toBe(
      scenarioBodyDigest(feature, 'nested project'),
    );
  });

  it('keeps the next scenario tags out of the preceding scenario identity', () => {
    const tagged = feature.replace(
      '    Scenario Outline: alias resolution',
      '    @manual\n    Scenario Outline: alias resolution',
    );
    expect(scenarioBodyDigest(tagged, 'nested project')).toBe(
      scenarioBodyDigest(feature, 'nested project'),
    );
  });

  it('includes Scenario Outline example rows', () => {
    const changed = feature.replace('| link |', '| other |');
    expect(scenarioBodyDigest(changed, 'alias resolution')).not.toBe(
      scenarioBodyDigest(feature, 'alias resolution'),
    );
  });

  it('refuses absent or duplicate headings', () => {
    expect(scenarioBodyDigest(feature, 'absent')).toBeUndefined();
    expect(
      scenarioBodyDigest(`${feature}\n    Scenario: nested project\n`, 'nested project'),
    ).toBeUndefined();
  });

  it('keeps a quoted Rule line inside the scenario body', () => {
    const quoted = [
      'Feature: quoted',
      '  Scenario: named',
      '    Given a docstring',
      '      """',
      'Rule: text inside the docstring',
      '      """',
      '    Then the result is visible',
      '',
    ].join('\n');
    expect(scenarioBodyDigest(quoted.replace('visible', 'hidden'), 'named')).not.toBe(
      scenarioBodyDigest(quoted, 'named'),
    );
  });

  it('recognizes the Example synonym as the next scenario boundary', () => {
    const examples = [
      'Feature: aliases',
      '  Scenario: first',
      '    Then first succeeds',
      '  Example: second',
      '    Then second succeeds',
    ].join('\n');
    expect(scenarioBodyDigest(examples.replace('second succeeds', 'second fails'), 'first')).toBe(
      scenarioBodyDigest(examples, 'first'),
    );
    expect(scenarioBodyDigest(examples, 'second')).toMatch(/^[a-f\d]{64}$/u);
  });
});
