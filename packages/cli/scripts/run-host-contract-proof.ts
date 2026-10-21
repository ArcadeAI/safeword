import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import {
  cursorCliCases,
  cursorIdeCases,
} from '../tests/fixtures/host-contract/cursor-cli-cases.js';

interface StepResult {
  result: { status: string; error_message?: string };
}

interface FeatureResult {
  uri: string;
  elements: { name: string; line: number; steps: StepResult[] }[];
}

function cursorTargetVersion(repoRoot: string, runtime: string): string {
  const matrix = JSON.parse(
    readFileSync(
      nodePath.join(repoRoot, 'packages/cli/tests/fixtures/host-contract/targets.json'),
      'utf8',
    ),
  ) as {
    targets: { agent: string; version: string; runtimes: string[]; delivery_variants?: string[] }[];
  };
  const target = matrix.targets.find(
    row =>
      row.agent === 'cursor' &&
      row.runtimes.includes(runtime) &&
      row.delivery_variants?.includes('native'),
  );
  assert.ok(target);
  return target.version;
}

function assertActualRow(
  repoRoot: string,
  line: number,
  cursor: boolean,
  runtime = 'IDE',
  expectedVersion?: string,
): void {
  const source = readFileSync(
    nodePath.join(repoRoot, 'features/consistent-host-contract.feature'),
    'utf8',
  ).split('\n');
  const row = source[line - 1];
  assert.ok(row);
  const cells = row.split('|').map(cell => cell.trim());
  if (expectedVersion) assert.equal(cells[2], expectedVersion);
  assert.equal(cells[1], cursor ? 'Cursor' : 'Codex');
  if (cursor) {
    assert.equal(cells[2], cursorTargetVersion(repoRoot, runtime));
    if (cells.length !== 4) assert.equal(cells[3], runtime);
  }
}

function isIntendedFailure(
  exitStatus: number | null,
  statuses: string[],
  scenario: FeatureResult['elements'][number],
  expectedFailure: string,
): boolean {
  return (
    exitStatus !== 0 &&
    statuses.slice(0, -1).every(status => status === 'passed') &&
    statuses.at(-1) === 'failed' &&
    scenario.steps.at(-1)?.result.error_message?.includes(expectedFailure) === true
  );
}

function cursorResult(
  repoRoot: string,
  report: string,
  scenarios: FeatureResult['elements'],
  status: number | null,
  population: { cases: ReturnType<typeof cursorCliCases>; runtime: string },
): number {
  const { cases, runtime } = population;
  assert.equal(scenarios.length, cases.length, `Expected every contracted ${runtime} scenario`);
  const intendedFailures: string[] = [];
  let unavailable = false;
  for (const [index, scenario] of scenarios.entries()) {
    const required = cases[index];
    assert.ok(required);
    assert.equal(scenario.name, required.scenario);
    assert.equal(scenario.line, required.line);
    assert.equal(scenario.steps.length, required.stepCount);
    assertActualRow(repoRoot, scenario.line, true, required.runtime, required.version);
    const statuses = scenario.steps.map(step => step.result.status);
    console.log(`Cursor ${runtime} ${scenario.name}: ${statuses.join(', ')}; report: ${report}`);
    const failure = required.expectedFailure;
    if (failure && isIntendedFailure(status, statuses, scenario, failure))
      intendedFailures.push(failure);
    else if (statuses.some(value => value !== 'passed')) unavailable = true;
  }
  if (unavailable) {
    console.error(
      `HOST_CONTRACT_PROOF_UNAVAILABLE: ${runtime} setup/action did not reach its assertion`,
    );
    return 3;
  }
  if (intendedFailures.length > 0) {
    console.error(`${intendedFailures.join(', ')}: observed real ${runtime} contract failure`);
    return 2;
  }
  if (status !== 0) {
    console.error(
      `HOST_CONTRACT_PROOF_UNAVAILABLE: ${runtime} runner failed outside scenario steps`,
    );
    return 3;
  }
  writeFileSync(
    nodePath.join(nodePath.dirname(report), 'completed-cases.json'),
    JSON.stringify(
      {
        purpose: 'diagnostic-only',
        admission_eligible: false,
        case_ids: cases.map(row => row.id),
        report,
      },
      undefined,
      2,
    ),
  );
  console.log(`Cursor ${runtime} required cases passed: ${cases.map(row => row.id).join(', ')}`);
  return 0;
}

function cursorGroupResult(
  proof: string | undefined,
  repoRoot: string,
  report: string,
  scenarios: FeatureResult['elements'],
  status: number | null,
): number | undefined {
  if (proof === 'native-cursor-cli')
    return cursorResult(repoRoot, report, scenarios, status, {
      cases: cursorCliCases(),
      runtime: 'CLI',
    });
  if (proof === 'native-cursor')
    return cursorResult(repoRoot, report, scenarios, status, {
      cases: cursorIdeCases(),
      runtime: 'IDE',
    });
  return undefined;
}

function nativeProofTimeout(proof: string | undefined): number {
  if (proof === 'native-cursor' || proof === 'native-cursor-cli') return 1_800_000;
  if (proof === 'native-cursor-continuation') return 1_020_000;
  return 540_000;
}

const nativeCases = {
  'native-cursor': {
    title: 'Native delivery exposes the contracted catalogue',
    failure: 'NATIVE_HELPER_ORIGIN_MISMATCH',
    steps: 4,
  },
  'native-codex': {
    title: 'Portable package loading proves only its portable components',
    failure: 'CODEX_COMPATIBILITY_OVERLAY_FALLBACK',
    steps: 3,
  },
  'native-cursor-continuation': {
    title: 'A supported completion guard actually continues the conversation',
    failure: 'HOST_CONTINUATION_MISSING',
    steps: 4,
  },
};

function assertNativeRow(repoRoot: string, line: number, proof: string): void {
  if (proof !== 'native-cursor-continuation') {
    assertActualRow(repoRoot, line, proof === 'native-cursor');
    return;
  }
  const cells = readFileSync(
    nodePath.join(repoRoot, 'features/consistent-host-contract.feature'),
    'utf8',
  )
    .split('\n')
    [line - 1]?.split('|')
    .map(cell => cell.trim());
  assert.deepEqual(cells, ['', 'Cursor', '3.24.18', '']);
}

/** Required pilot: preserve the actual Cucumber failure, never equate setup with RED. */
function main(): number {
  const args = process.argv.slice(2);
  const proof = args[1];
  assert.ok(
    ['native-cursor', 'native-codex', 'native-cursor-cli', 'native-cursor-continuation'].includes(
      proof ?? '',
    ),
  );
  assert.deepEqual(args, ['--proof', proof, '--require-targets']);
  const selected = nativeCases[proof as keyof typeof nativeCases] ?? nativeCases['native-codex'];
  const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
  const reportDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-host-contract-proof-'));
  const report = nodePath.join(reportDirectory, 'cucumber.json');
  const result = spawnSync(
    nodePath.join(repoRoot, 'scripts/dev'),
    [
      'node',
      '--import',
      'tsx',
      'node_modules/@cucumber/cucumber/bin/cucumber.js',
      '--config',
      `packages/cli/tests/fixtures/host-contract/cucumber.${proof}.mjs`,
      '--format',
      'progress',
      '--format',
      `json:${report}`,
    ],
    { cwd: repoRoot, stdio: 'inherit', timeout: nativeProofTimeout(proof) },
  );
  if (result.error) {
    console.error(`HOST_CONTRACT_PROOF_UNAVAILABLE: ${result.error.message}`);
    return 3;
  }
  const features = JSON.parse(readFileSync(report, 'utf8')) as FeatureResult[];
  const scenarios = features
    .flatMap(feature => feature.elements)
    .toSorted((left, right) => left.line - right.line);
  assert.equal(features.length, 1);
  const feature = features[0];
  assert.ok(feature);
  assert.equal(
    nodePath.resolve(repoRoot, feature.uri),
    nodePath.join(repoRoot, 'features/consistent-host-contract.feature'),
  );
  const groupResult = cursorGroupResult(proof, repoRoot, report, scenarios, result.status);
  if (groupResult !== undefined) return groupResult;
  assert.equal(scenarios.length, 1, 'Expected exactly the selected native example row');
  const [scenario] = scenarios;
  assert.ok(scenario);
  assert.equal(scenario.name, selected.title);
  assert.equal(scenario.steps.length, selected.steps);
  assertNativeRow(repoRoot, scenario.line, proof ?? '');
  const statuses = scenario.steps.map(step => step.result.status);
  console.log(`Native ${proof} catalogue statuses: ${statuses.join(', ')}; report: ${report}`);
  if (isIntendedFailure(result.status, statuses, scenario, selected.failure)) {
    console.error(`${selected.failure}: observed native contract failure`);
    return 2;
  }
  if (result.status !== 0 || statuses.some(status => status !== 'passed')) {
    console.error('HOST_CONTRACT_PROOF_UNAVAILABLE: scenario did not reach the intended failure');
    return 3;
  }
  // The catalogue is one obligation. Guard, continuation and identity cases must
  // join this group before it can admit a native package or report conformance.
  console.error(`HOST_CONTRACT_PROOF_INCOMPLETE: remaining ${proof} obligations are unwired`);
  return 3;
}

process.exitCode = main();
