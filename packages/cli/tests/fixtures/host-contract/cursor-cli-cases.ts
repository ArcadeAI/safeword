import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../../..');
export const cursorContractFeature = nodePath.join(
  repoRoot,
  'features/consistent-host-contract.feature',
);
const identities: Record<string, { suffix: string; expectedFailure?: string }> = {
  'A denied action has no side effect': {
    suffix: 'denied-write',
    expectedFailure: 'NATIVE_GUARD_DISPATCH_MISSING',
  },
  'An allowed action reaches the side-effect boundary': { suffix: 'allowed-write' },
  'Native delivery exposes the contracted catalogue': {
    suffix: 'catalogue-helper',
    expectedFailure: 'NATIVE_HELPER_ORIGIN_MISMATCH',
  },
};
const slug = (value: string): string =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-|-$/gu, '');

/** Feature rows own coverage; this map preserves existing diagnostic IDs only. */
export function cursorCliCases(source = readFileSync(cursorContractFeature, 'utf8')) {
  const matrix = JSON.parse(
    readFileSync(nodePath.join(import.meta.dirname, 'targets.json'), 'utf8'),
  ) as {
    targets: { agent: string; version: string; runtimes: string[] }[];
  };
  const target = matrix.targets.find(row => row.agent === 'cursor' && row.runtimes.includes('CLI'));
  assert.ok(target, 'Missing independently pinned Cursor CLI target');
  const document = new Parser(
    new AstBuilder(IdGenerator.incrementing()),
    new GherkinClassicTokenMatcher(),
  ).parse(source);
  const scenarios =
    document.feature?.children
      .flatMap(child => child.rule?.children ?? [child])
      .flatMap(child => (child.scenario ? [child.scenario] : [])) ?? [];
  const cases = scenarios.flatMap(scenario =>
    scenario.examples.flatMap(example => {
      const headers = example.tableHeader?.cells.map(cell => cell.value) ?? [];
      return example.tableBody.flatMap(row => {
        const values = Object.fromEntries(
          headers.map((header, index) => [header, row.cells[index]?.value]),
        );
        if (
          values.host !== 'Cursor' ||
          values.version !== target.version ||
          (values.runtime ?? 'CLI') !== 'CLI'
        )
          return [];
        assert.ok(scenario.steps.length, 'Empty contracted Cursor CLI scenario');
        const identity: { suffix: string; expectedFailure?: string } = identities[
          scenario.name
        ] ?? { suffix: slug(scenario.name) };
        const qualifiers = Object.entries(values)
          .filter(([key]) => !['host', 'version', 'runtime'].includes(key))
          .map(([key, value]) => `${key}-${value}`)
          .join('-');
        const qualifierSuffix = qualifiers ? `-${slug(qualifiers)}` : '';
        return [
          {
            id: `cursor-cli-${target.version}-${identity.suffix}${qualifierSuffix}`,
            scenario: scenario.name,
            version: target.version,
            runtime: 'CLI',
            line: row.location.line,
            stepCount: scenario.steps.length,
            expectedFailure: identity.expectedFailure,
          },
        ];
      });
    }),
  );
  assert.ok(cases.length, 'No contracted Cursor CLI cases');
  assert.equal(
    new Set(cases.map(row => row.id)).size,
    cases.length,
    'Duplicate Cursor CLI case identity',
  );
  return cases;
}
