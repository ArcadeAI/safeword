import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../../..');
export const hostContractFeature = nodePath.join(
  repoRoot,
  'features/consistent-host-contract.feature',
);
const identities: Record<string, { suffix: string; ideSuffix?: string; expectedFailure?: string }> =
  {
    'Portable package loading proves only its portable components': {
      suffix: 'portable-components',
      expectedFailure: 'CODEX_COMPATIBILITY_OVERLAY_FALLBACK',
    },
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
function nativeCases(
  host: 'Cursor' | 'Codex' | 'OpenCode V2',
  runtime: 'CLI' | 'IDE' | 'TUI',
  source: string,
) {
  const matrix = JSON.parse(
    readFileSync(nodePath.join(import.meta.dirname, 'targets.json'), 'utf8'),
  ) as {
    targets: { agent: string; version: string; runtimes: string[]; delivery_variants?: string[] }[];
  };
  const target = matrix.targets.find(
    row =>
      (host === 'OpenCode V2'
        ? row.agent === 'opencode' && row.version.startsWith('2.')
        : row.agent === host.toLowerCase()) &&
      row.runtimes.includes(runtime) &&
      (host !== 'Cursor' || row.delivery_variants?.includes('native')),
  );
  assert.ok(target, `Missing independently pinned ${host} ${runtime} target`);
  let prefix = host.toLowerCase();
  if (host === 'Cursor' && runtime === 'CLI') prefix += '-cli';
  const lane =
    host === 'OpenCode V2'
      ? `opencode-v2-${target.version}-${runtime.toLowerCase()}`
      : `${prefix}-${target.version}`;
  const defaultVersion = host === 'Codex' ? target.version : undefined;
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
        const rowVersion = values.version ?? defaultVersion;
        if (
          values.host !== host ||
          rowVersion !== target.version ||
          (values.runtime ?? runtime) !== runtime
        )
          return [];
        assert.ok(scenario.steps.length, `Empty contracted ${host} ${runtime} scenario`);
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
            id: `${lane}-${suffix}${qualifierSuffix}`,
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
  assert.ok(cases.length, `No contracted ${host} ${runtime} cases`);
  assert.equal(
    new Set(cases.map(row => row.id)).size,
    cases.length,
    `Duplicate ${host} ${runtime} case identity`,
  );
  return cases;
}

export function cursorCliCases(source = readFileSync(hostContractFeature, 'utf8')) {
  return nativeCases('Cursor', 'CLI', source);
}

export function cursorIdeCases(source = readFileSync(hostContractFeature, 'utf8')) {
  return nativeCases('Cursor', 'IDE', source);
}

export function codexCases(source = readFileSync(hostContractFeature, 'utf8')) {
  return nativeCases('Codex', 'CLI', source);
}

/** Initial denied-action component only; this cannot certify the full V2 group. */
export function openCodeV2GuardCases(source = readFileSync(hostContractFeature, 'utf8')) {
  const cases = (['CLI', 'TUI'] as const).flatMap(runtime =>
    nativeCases('OpenCode V2', runtime, source)
      .filter(row => row.scenario === 'A denied action has no side effect')
      .map(row => ({ ...row, expectedFailure: 'NATIVE_OPENCODE_V2_GUARD_MISSING' })),
  );
  assert.ok(cases.length, 'No contracted OpenCode V2 guard cases');
  return cases;
}
