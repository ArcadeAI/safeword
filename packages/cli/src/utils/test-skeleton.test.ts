/**
 * Unit tests for the `safeword codify` emitter (ticket CS86B0).
 *
 * Pure function — no filesystem. Covers AC1 (faithful scenario→test mapping +
 * valid-module robustness) and AC2 (pending default vs --red throwing body) from
 * `.safeword-project/tickets/CS86B0/test-definitions.md`. The command layer
 * (AC3 — stdout / --out / bad-input) is covered by tests/commands/codify.test.ts.
 */

import { describe, expect, it } from 'vitest';

import { emitVitestSkeleton } from './test-skeleton.js';

/** A `### Scenario:` block with R/G/R checkboxes, as saved on disk. */
function scenario(title: string, body = 'Given a\nWhen b\nThen c'): string {
  const steps = body === '' ? '' : `${body}\n\n`;
  return `### Scenario: ${title}\n\n${steps}- [ ] RED\n- [ ] GREEN\n- [ ] REFACTOR`;
}

/** A `## Rule:` heading wrapping one or more scenario blocks. */
function rule(name: string, ...scenarios: string[]): string {
  return `## Rule: ${name}\n\n${scenarios.join('\n\n')}`;
}

/** Wrap rule blocks into a full test-definitions.md document. */
function definitions(...blocks: string[]): string {
  return `# Test Definitions\n\n${blocks.join('\n\n')}\n`;
}

/** Count emitted test calls (plain `it` plus pending stubs). */
function countTests(emitted: string): number {
  return (emitted.match(/\bit(?:\.todo)?\(/g) ?? []).length;
}

/** Count `describe(` calls in emitted output. */
function countDescribes(emitted: string): number {
  return (emitted.match(/\bdescribe\(/g) ?? []).length;
}

describe('emitVitestSkeleton — AC1: faithful scenario→test mapping', () => {
  it('codify.DEV1.AC1.scenario_emits_one_named_it', () => {
    const defs = definitions(rule('a rule', scenario('codify.DEV1.AC1.example')));
    const out = emitVitestSkeleton(defs);
    expect(countTests(out)).toBe(1);
    expect(out).toContain('"codify.DEV1.AC1.example"');
  });

  it('codify.DEV1.AC1.given_when_then_and_render_as_comments', () => {
    const defs = definitions(
      rule(
        'a rule',
        scenario(
          'codify.DEV1.AC1.commented',
          'Given a cart\nWhen I pay\nThen it clears\nAnd a receipt prints',
        ),
      ),
    );
    const out = emitVitestSkeleton(defs);
    const gIndex = out.indexOf('// Given a cart');
    const wIndex = out.indexOf('// When I pay');
    const tIndex = out.indexOf('// Then it clears');
    const aIndex = out.indexOf('// And a receipt prints');
    expect(gIndex).toBeGreaterThan(-1);
    expect(wIndex).toBeGreaterThan(gIndex);
    expect(tIndex).toBeGreaterThan(wIndex);
    expect(aIndex).toBeGreaterThan(tIndex);
  });

  it('codify.DEV1.AC1.scenario_without_body_still_emits_a_stub', () => {
    const defs = definitions(rule('a rule', scenario('codify.DEV1.AC1.bodyless', '')));
    const out = emitVitestSkeleton(defs);
    expect(countTests(out)).toBe(1);
    expect(out).toContain('"codify.DEV1.AC1.bodyless"');
    // No step comments in the generated body (the only `//` is the file header).
    const generatedBody = out.split("from 'vitest';", 2)[1] ?? '';
    expect(generatedBody).not.toContain('//');
  });

  it('codify.DEV1.AC1.scenarios_group_under_their_rule_describe', () => {
    const defs = definitions(
      rule(
        'emits one test per scenario',
        scenario('codify.DEV1.AC1.one'),
        scenario('codify.DEV1.AC1.two'),
      ),
    );
    const out = emitVitestSkeleton(defs);
    expect(countDescribes(out)).toBe(1);
    expect(out).toContain('describe("emits one test per scenario"');
    expect(countTests(out)).toBe(2);
  });

  it('codify.DEV1.AC1.rule_heading_with_special_chars_emits_valid_module', () => {
    const heading = "`check` reports gaps (three buckets) — don't break";
    const defs = definitions(rule(heading, scenario('codify.DEV1.AC1.special')));
    const out = emitVitestSkeleton(defs);
    // The describe name is JSON-encoded, so any heading — backticks, quotes,
    // parens — becomes a valid JS string literal and the module parses.
    expect(out).toContain(`describe(${JSON.stringify(heading)}`);
  });

  it('codify.DEV1.AC1.rules_and_scenarios_map_one_to_one', () => {
    const defs = definitions(
      rule('first rule', scenario('codify.DEV1.AC1.r1s1'), scenario('codify.DEV1.AC1.r1s2')),
      rule('second rule', scenario('codify.DEV1.AC1.r2s1')),
    );
    const out = emitVitestSkeleton(defs);
    expect(countDescribes(out)).toBe(2);
    expect(countTests(out)).toBe(3);
  });

  it('codify.DEV1.AC1.free_text_scenario_still_emits_a_test', () => {
    const defs = definitions(rule('a rule', scenario('plain words with no lineage')));
    const out = emitVitestSkeleton(defs);
    expect(countTests(out)).toBe(1);
    expect(out).toContain('"plain words with no lineage"');
  });

  it('codify.DEV1.AC1.fenced_and_commented_scenarios_are_skipped', () => {
    const fenced = '```\n### Scenario: codify.DEV1.AC1.fenced\n```';
    const commented = '<!--\n### Scenario: codify.DEV1.AC1.commented_out\n-->';
    const defs = definitions(
      rule('a rule', scenario('codify.DEV1.AC1.real'), `${fenced}\n\n${commented}`),
    );
    const out = emitVitestSkeleton(defs);
    expect(countTests(out)).toBe(1);
    expect(out).not.toContain('fenced');
    expect(out).not.toContain('commented_out');
  });

  it('codify.DEV1.AC1.non_rule_section_scenarios_are_excluded', () => {
    const out = emitVitestSkeleton(
      `# Test Definitions\n\n## Invariants\n\n### Scenario: codify.DEV1.AC1.under_invariants\n\nGiven a\nWhen b\nThen c\n\n- [ ] RED\n`,
    );
    expect(countTests(out)).toBe(0);
    expect(out).not.toContain('under_invariants');
  });
});

describe('emitVitestSkeleton — AC2: pending by default, --red throws', () => {
  it('codify.DEV1.AC2.default_emits_pending_it_todo', () => {
    const defs = definitions(rule('a rule', scenario('codify.DEV1.AC2.pending')));
    const out = emitVitestSkeleton(defs);
    expect(out).toContain('it.todo("codify.DEV1.AC2.pending")');
    expect(out).not.toContain('throw new Error');
  });

  it('codify.DEV1.AC2.red_flag_emits_throwing_body', () => {
    const defs = definitions(rule('a rule', scenario('codify.DEV1.AC2.red')));
    const out = emitVitestSkeleton(defs, {
      red: true,
    });
    expect(out).toContain('it("codify.DEV1.AC2.red"');
    expect(out).toContain('throw new Error');
    expect(out).not.toContain('it.todo(');
  });
});
