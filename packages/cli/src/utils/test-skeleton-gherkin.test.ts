/**
 * Unit tests for the Gherkin renderer (ticket 102a — gherkin-typescript.TB1.AC1).
 *
 * Pure function — no filesystem. Parses a `test-definitions.md` and emits a
 * `.feature`; the emitted output is validated by the **official**
 * `@cucumber/gherkin` parser (stronger than string matching). AC2 (format
 * selection) is tested at the command layer; SM1.AC1 (the runner) is integration.
 */

import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { type FeatureChild, IdGenerator, type RuleChild } from '@cucumber/messages';
import { describe, expect, it } from 'vitest';

import { emitGherkinFeature } from './test-skeleton.js';

interface ScenarioAst {
  name: string;
  tags: string[];
  stepKeywords: string[];
  stepTexts: string[];
}

function parseFeature(feature: string) {
  const parser = new Parser(new AstBuilder(IdGenerator.uuid()), new GherkinClassicTokenMatcher());
  return parser.parse(feature); // throws CompositeParserException on invalid input
}

function parsesAsGherkin(feature: string): boolean {
  try {
    parseFeature(feature);
    return true;
  } catch {
    return false;
  }
}

/** Flatten every scenario across rules (and any top-level) into a simple shape. */
function collect(children: readonly (FeatureChild | RuleChild)[]): ScenarioAst[] {
  const out: ScenarioAst[] = [];
  for (const child of children) {
    if (child.scenario) {
      out.push({
        name: child.scenario.name,
        tags: child.scenario.tags.map(tag => tag.name),
        stepKeywords: child.scenario.steps.map(step => step.keyword.trim()),
        stepTexts: child.scenario.steps.map(step => step.text),
      });
    }
    if ('rule' in child && child.rule) out.push(...collect(child.rule.children));
  }
  return out;
}

function scenariosOf(feature: string): ScenarioAst[] {
  return collect(parseFeature(feature).feature?.children ?? []);
}

/** A `### Scenario:` block with R/G/R checkboxes, as saved on disk. */
function scenario(title: string, body = 'Given a\nWhen b\nThen c'): string {
  const steps = body === '' ? '' : `${body}\n\n`;
  return `### Scenario: ${title}\n\n${steps}- [ ] RED\n- [ ] GREEN\n- [ ] REFACTOR`;
}

function rule(name: string, ...scenarios: string[]): string {
  return `## Rule: ${name}\n\n${scenarios.join('\n\n')}`;
}

function definitions(title: string, ...blocks: string[]): string {
  return `# ${title}\n\n${blocks.join('\n\n')}\n`;
}

describe('emitGherkinFeature — AC1: faithful Gherkin emission', () => {
  it('gherkin-typescript.TB1.AC1.doc_becomes_a_feature_with_rules', () => {
    const firstRule = rule('first rule', scenario('demo.TB1.AC1.one'));
    const secondRule = rule('second rule', scenario('demo.TB1.AC1.two'));
    const out = emitGherkinFeature(definitions('My Feature', firstRule, secondRule));
    const parsed = parseFeature(out);
    expect(parsed.feature?.name).toBe('My Feature');
    const ruleNames = (parsed.feature?.children ?? [])
      .filter(child => child.rule)
      .map(child => child.rule?.name);
    expect(ruleNames).toEqual(['first rule', 'second rule']);
  });

  it('gherkin-typescript.TB1.AC1.scenario_becomes_a_named_scenario', () => {
    const oneRule = rule('r', scenario('demo.TB1.AC1.example'));
    const out = emitGherkinFeature(definitions('F', oneRule));
    expect(scenariosOf(out).map(s => s.name)).toContain('demo.TB1.AC1.example');
  });

  it('gherkin-typescript.TB1.AC1.steps_render_as_given_when_then_and', () => {
    const stepScenario = scenario(
      'demo.TB1.AC1.s',
      'Given a cart\nWhen I pay\nThen it clears\nAnd a receipt prints',
    );
    const out = emitGherkinFeature(definitions('F', rule('r', stepScenario)));
    const [s] = scenariosOf(out);
    expect(s?.stepKeywords).toEqual(['Given', 'When', 'Then', 'And']);
    expect(s?.stepTexts).toEqual(['a cart', 'I pay', 'it clears', 'a receipt prints']);
  });

  it('gherkin-typescript.TB1.AC1.lineage_becomes_a_tag', () => {
    const taggedRule = rule('r', scenario('gherkin-typescript.TB1.AC1.example'));
    const out = emitGherkinFeature(definitions('F', taggedRule));
    expect(scenariosOf(out)[0]?.tags).toEqual(['@gherkin-typescript.TB1.AC1']);
    // Placement: the line directly above `Scenario:` is exactly the tag token.
    const lines = out.split('\n');
    const scenarioIndex = lines.findIndex(line => line.trim().startsWith('Scenario:'));
    expect(lines[scenarioIndex - 1]?.trim()).toBe('@gherkin-typescript.TB1.AC1');
  });

  it('gherkin-typescript.TB1.AC1.free_text_scenario_emits_untagged', () => {
    const plainRule = rule('r', scenario('plain words here'));
    const out = emitGherkinFeature(definitions('F', plainRule));
    const [s] = scenariosOf(out);
    expect(s?.name).toBe('plain words here');
    expect(s?.tags).toEqual([]);
  });

  it('gherkin-typescript.TB1.AC1.hostile_title_emits_a_valid_feature', () => {
    const hostile = 'gherkin-typescript.TB1.AC1.has spaces (parens) and @at';
    const hostileRule = rule('r', scenario(hostile));
    const out = emitGherkinFeature(definitions('F', hostileRule));
    expect(parsesAsGherkin(out)).toBe(true);
    const [s] = scenariosOf(out);
    // Tag comes from the parsed AC ref (whitespace-free), never the raw title.
    expect(s?.tags).toEqual(['@gherkin-typescript.TB1.AC1']);
    expect(s?.name).toBe(hostile);
  });

  it('gherkin-typescript.TB1.AC1.bodyless_scenario_emits_a_stepless_scenario', () => {
    const bodylessRule = rule('r', scenario('demo.TB1.AC1.bodyless', ''));
    const out = emitGherkinFeature(definitions('F', bodylessRule));
    expect(parsesAsGherkin(out)).toBe(true);
    expect(scenariosOf(out)[0]?.stepKeywords).toEqual([]);
  });

  it('gherkin-typescript.TB1.AC1.emitted_feature_parses_with_official_parser', () => {
    const twoScenarioRule = rule('r', scenario('demo.TB1.AC1.one'), scenario('demo.TB1.AC1.two'));
    const out = emitGherkinFeature(definitions('F', twoScenarioRule));
    expect(parsesAsGherkin(out)).toBe(true);
  });
});
