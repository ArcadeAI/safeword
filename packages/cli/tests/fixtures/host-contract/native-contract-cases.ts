import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';

import hostReleases from '../../../src/lifecycle/host-releases.json' with { type: 'json' };

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../../..');
export const hostContractFeature = nodePath.join(
  repoRoot,
  'features/consistent-host-contract.feature',
);
interface NativeCaseIdentity {
  suffix: string;
  ideSuffix?: string;
  expectedFailure?: string;
  opencodeFailure?: string;
}
const identities: Record<string, NativeCaseIdentity> = {
  'Portable package loading proves only its portable components': {
    suffix: 'portable-components',
    expectedFailure: 'CODEX_COMPATIBILITY_OVERLAY_FALLBACK',
  },
  'A denied action has no side effect': {
    suffix: 'denied-write',
    ideSuffix: 'native-denied-write',
    expectedFailure: 'NATIVE_GUARD_DISPATCH_MISSING',
    opencodeFailure: 'NATIVE_OPENCODE_V2_GUARD_MISSING',
  },
  'An allowed action reaches the side-effect boundary': {
    suffix: 'allowed-write',
    ideSuffix: 'native-allowed-write',
  },
  'Native delivery exposes the contracted catalogue': {
    suffix: 'catalogue-helper',
    expectedFailure: 'NATIVE_HELPER_ORIGIN_MISMATCH',
    opencodeFailure: 'NATIVE_OPENCODE_V2_CATALOGUE_MISSING',
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

function expectedFailureForHost(
  host: string,
  identity: NativeCaseIdentity,
  portableOnly = false,
): string | undefined {
  if (portableOnly) return 'PORTABLE_COMPONENTS_NOT_LOADED';
  return host === 'OpenCode V2'
    ? (identity.opencodeFailure ?? identity.expectedFailure)
    : identity.expectedFailure;
}

function nativeLane(host: string, runtime: string, version: string, portableOnly: boolean) {
  let prefix = host === 'Claude Code' ? 'claude' : host.toLowerCase();
  if (host === 'Cursor' && runtime === 'CLI') prefix += '-cli';
  if (host === 'Cursor' && runtime === 'IDE' && portableOnly) prefix += '-ide';
  return host.startsWith('OpenCode ')
    ? `opencode-v${version.split('.', 1)[0]}-${version}-${runtime.toLowerCase()}`
    : `${prefix}-${version}`;
}

/** Feature rows own coverage; this map preserves existing diagnostic IDs only. */
export function nativeCases(
  host: 'Cursor' | 'Codex' | 'OpenCode V2' | 'Claude Code',
  runtime: 'CLI' | 'IDE' | 'TUI',
  source: string,
  portableOnly = false,
) {
  const openCodeMajor = '2.';
  const agent = host === 'Claude Code' ? 'claude' : host.toLowerCase();
  const target = Object.values(hostReleases).find(
    row =>
      (host.startsWith('OpenCode ')
        ? row.agent === 'opencode' && row.version.startsWith(openCodeMajor)
        : row.agent === agent) &&
      row.runtimes.includes(runtime) &&
      (host !== 'Cursor' || row.delivery_variants?.includes('native')),
  );
  assert.ok(target, `Missing integration release for ${host} ${runtime}`);
  const lane = nativeLane(host, runtime, target.version, portableOnly);
  const defaultVersion = host === 'Codex' || portableOnly ? target.version : undefined;
  const document = new Parser(
    new AstBuilder(IdGenerator.incrementing()),
    new GherkinClassicTokenMatcher(),
  ).parse(source);
  const scenarios =
    document.feature?.children
      .flatMap(child => child.rule?.children ?? [child])
      .flatMap(child => (child.scenario ? [child.scenario] : [])) ?? [];
  const selected = scenarios.filter(
    scenario =>
      !portableOnly ||
      scenario.name === 'Portable package loading proves only its portable components',
  );
  const cases = selected.flatMap(scenario =>
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
        const identity: NativeCaseIdentity = identities[scenario.name] ?? {
          suffix: slug(scenario.name),
        };
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
            host,
            scenario: scenario.name,
            version: target.version,
            runtime,
            line: row.location.line,
            stepCount: scenario.steps.length,
            expectedFailure: expectedFailureForHost(host, identity, portableOnly),
          },
        ];
      });
    }),
  );
  if (!portableOnly) assert.ok(cases.length, `No contracted ${host} ${runtime} cases`);
  assert.equal(
    new Set(cases.map(row => row.id)).size,
    cases.length,
    `Duplicate ${host} ${runtime} case identity`,
  );
  return cases;
}

export function portableCases(source = readFileSync(hostContractFeature, 'utf8')) {
  const cases = Object.values(hostReleases).flatMap(target =>
    target.runtimes.flatMap(runtime => {
      const hosts = {
        claude: 'Claude Code',
        codex: 'Codex',
        cursor: 'Cursor',
        opencode: 'OpenCode V2',
      } as const;
      const host = hosts[target.agent as keyof typeof hosts];
      assert.ok(host, 'HOST_CONTRACT_PROOF_UNAVAILABLE: unknown host');
      const rows = nativeCases(host, runtime as 'CLI' | 'IDE' | 'TUI', source, true);
      if (target.agent === 'codex' || target.agent === 'cursor')
        assert.ok(
          rows.length,
          `HOST_CONTRACT_PROOF_UNAVAILABLE: missing portable ${host} ${runtime}`,
        );
      return rows;
    }),
  );
  assert.ok(cases.length, 'HOST_CONTRACT_PROOF_UNAVAILABLE: no portable cases');
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

/** The actual tagged Rule owns the invocation population, including new cases. */
export function codexInternalCases(source = readFileSync(hostContractFeature, 'utf8')) {
  const document = new Parser(
    new AstBuilder(IdGenerator.incrementing()),
    new GherkinClassicTokenMatcher(),
  ).parse(source);
  const rules =
    document.feature?.children
      .flatMap(child => (child.rule ? [child.rule] : []))
      .filter(rule => rule.tags.some(tag => tag.name === '@codex-internal-workflows')) ?? [];
  assert.equal(rules.length, 1, 'Expected one canonical internal-workflows Rule');
  const cases =
    rules[0]?.children.flatMap(child => {
      if (!child.scenario) return [];
      const scenario = child.scenario;
      assert.equal(
        scenario.examples.length,
        0,
        'Invocation outlines require explicit expanded-case support',
      );
      assert.ok(scenario.steps.length);
      return [
        {
          id: slug(scenario.name),
          scenario: scenario.name,
          line: scenario.location.line,
          stepCount: scenario.steps.length,
          preservationArms: scenario.steps.some(step =>
            step.text.includes('paired review projects'),
          )
            ? ['defective', 'covered']
            : ['single'],
        },
      ];
    }) ?? [];
  assert.ok(cases.length, 'No canonical internal-workflow cases');
  assert.equal(
    new Set(cases.map(row => row.id)).size,
    cases.length,
    'Duplicate internal-workflow case identity',
  );
  return cases;
}

export function claudeCases(source = readFileSync(hostContractFeature, 'utf8')) {
  return nativeCases('Claude Code', 'CLI', source);
}

/** Initial denied-action component only; this cannot certify the full V2 group. */
export function openCodeV2GuardCases(source = readFileSync(hostContractFeature, 'utf8')) {
  const cases = (['CLI', 'TUI'] as const).flatMap(runtime =>
    nativeCases('OpenCode V2', runtime, source).filter(
      row => row.scenario === 'A denied action has no side effect',
    ),
  );
  assert.ok(cases.length, 'No contracted OpenCode V2 guard cases');
  return cases;
}

/** Every applicable V2 row, ordered as Cucumber executes the shared feature. */
export function openCodeV2Cases(source = readFileSync(hostContractFeature, 'utf8')) {
  return (['CLI', 'TUI'] as const)
    .flatMap(runtime => nativeCases('OpenCode V2', runtime, source))
    .toSorted((left, right) => left.line - right.line);
}

/** The only static resource cases eligible for checker-only preservation. */
export function codexStaticResourceKind(id: string): 'closure' | 'missing' | undefined {
  if (id === 'internal-references-resolve-their-complete-installed-resource-closure')
    return 'closure';
  if (id === 'missing-internal-resources-prevent-a-clean-generated-delivery-check')
    return 'missing';
  return undefined;
}
