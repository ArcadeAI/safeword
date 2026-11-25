import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

it('binds every internal workflow step exactly once without running native callbacks', () => {
  // Load real Cucumber support only: no runCucumber, hooks, worlds or step callbacks execute.
  const result = spawnSync(
    'bun',
    [
      '--eval',
      `
    import { readFileSync } from 'node:fs';
    import { loadSupport } from '@cucumber/cucumber/api';
    import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
    import { IdGenerator } from '@cucumber/messages';
    const path = '../../features/consistent-host-contract.feature';
    const support = await loadSupport({
      sources: { paths: [path] },
      support: { importPaths: ['tests/fixtures/host-contract/codex-workflow-runtime.steps.ts',
        '../../steps/consistent-host-contract.steps.ts'] },
    });
    const document = new Parser(new AstBuilder(IdGenerator.incrementing()),
      new GherkinClassicTokenMatcher()).parse(readFileSync(path, 'utf8'));
    const rule = document.feature.children.find(child =>
      child.rule?.name.startsWith('consistent-host-contract.TBU2.R3')).rule;
    const scenarios = rule.children.flatMap(child => child.scenario ? [child.scenario] : []);
    const mismatches = scenarios.flatMap(scenario => scenario.steps.flatMap(step => {
      const count = support.stepDefinitions.filter(definition =>
        definition.matchesStepName(step.text)).length;
      return count === 1 ? [] : [{ scenario: scenario.name, step: step.text, count }];
    }));
    console.log(JSON.stringify({ scenarios: scenarios.length,
      definitions: support.stepDefinitions.length, mismatches }));
  `,
    ],
    { cwd: nodePath.resolve(import.meta.dirname, '../..'), encoding: 'utf8' },
  );
  expect(result.status, result.stderr).toBe(0);
  const observed = JSON.parse(result.stdout) as {
    scenarios: number;
    definitions: number;
    mismatches: { scenario: string; step: string; count: number }[];
  };
  expect(observed.scenarios).toBe(10);
  expect(observed.definitions).toBeGreaterThan(0);
  expect(observed.mismatches, 'CURRENT_CODEX_WORKFLOW_BINDING_MISSING').toEqual([]);
});
