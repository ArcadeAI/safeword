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
const identities: Record<string, { suffix: string; ideSuffix?: string; expectedFailure?: string }> =
  {
    'A denied action has no side effect': {
      suffix: 'denied-write',
      ideSuffix: 'native-denied-write',
      expectedFailure: 'NATIVE_GUARD_DISPATCH_MISSING',
    },
    'An allowed action reaches the side-effect boundary': {
      suffix: 'allowed-write',
      ideSuffix: 'native-allowed-write',
    },
    'Native delivery exposes the contracted catalogue': {
      suffix: 'catalogue-helper',
      expectedFailure: 'NATIVE_HELPER_ORIGIN_MISMATCH',
    },
    'A supported completion guard actually continues the conversation': {
      suffix: 'bounded-continuation',
      expectedFailure: 'HOST_CONTINUATION_MISSING',
    },
  };
const slug = (value: string): string =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-|-$/gu, '');

/** Feature rows own coverage; this map preserves existing diagnostic IDs only. */
function cursorCases(runtime: 'CLI' | 'IDE', source: string) {
  const matrix = JSON.parse(
    readFileSync(nodePath.join(import.meta.dirname, 'targets.json'), 'utf8'),
  ) as {
    targets: { agent: string; version: string; runtimes: string[]; delivery_variants?: string[] }[];
  };
  const target = matrix.targets.find(
    row =>
      row.agent === 'cursor' &&
      row.runtimes.includes(runtime) &&
      row.delivery_variants?.includes('native'),
  );
  assert.ok(target, `Missing independently pinned Cursor ${runtime} target`);
  const prefix = runtime === 'CLI' ? 'cursor-cli' : 'cursor';
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
          (values.runtime ?? runtime) !== runtime
        )
          return [];
        assert.ok(scenario.steps.length, 'Empty contracted Cursor CLI scenario');
        const identity: { suffix: string; ideSuffix?: string; expectedFailure?: string } =
          identities[scenario.name] ?? { suffix: slug(scenario.name) };
        const suffix =
          runtime === 'IDE' ? (identity.ideSuffix ?? identity.suffix) : identity.suffix;
        const qualifiers = Object.entries(values)
          .filter(([key]) => !['host', 'version', 'runtime'].includes(key))
          .map(([key, value]) => `${key}-${value}`)
          .join('-');
        const qualifierSuffix = qualifiers ? `-${slug(qualifiers)}` : '';
        return [
          {
            id: `${prefix}-${target.version}-${suffix}${qualifierSuffix}`,
            scenario: scenario.name,
            version: target.version,
            runtime,
            line: row.location.line,
            stepCount: scenario.steps.length,
            expectedFailure: identity.expectedFailure,
          },
        ];
      });
    }),
  );
  assert.ok(cases.length, `No contracted Cursor ${runtime} cases`);
  assert.equal(
    new Set(cases.map(row => row.id)).size,
    cases.length,
    `Duplicate Cursor ${runtime} case identity`,
  );
  return cases;
}

export function cursorCliCases(source = readFileSync(cursorContractFeature, 'utf8')) {
  return cursorCases('CLI', source);
}

export function cursorIdeCases(source = readFileSync(cursorContractFeature, 'utf8')) {
  return cursorCases('IDE', source);
}
