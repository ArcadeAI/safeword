import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import {
  codexCases,
  cursorCliCases,
  cursorIdeCases,
  openCodeV2GuardCases,
} from '../tests/fixtures/host-contract/native-contract-cases.js';

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
  host: 'Cursor' | 'Codex' | 'OpenCode V2',
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
  assert.equal(cells[1], host);
  if (host === 'Cursor') {
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

function nativeResult(
  repoRoot: string,
  report: string,
  scenarios: FeatureResult['elements'],
  status: number | null,
  population: {
    cases: ReturnType<typeof cursorCliCases>;
    runtime: string;
    host: 'Cursor' | 'Codex' | 'OpenCode V2';
  },
): number {
  const { cases, runtime, host } = population;
  assert.equal(scenarios.length, cases.length, `Expected every contracted ${runtime} scenario`);
  const intendedFailures: string[] = [];
  let unavailable = false;
  for (const [index, scenario] of scenarios.entries()) {
    const required = cases[index];
    assert.ok(required);
    assert.equal(scenario.name, required.scenario);
    assert.equal(scenario.line, required.line);
    assert.equal(scenario.steps.length, required.stepCount);
    const portable =
      required.scenario === 'Portable package loading proves only its portable components';
    assertActualRow(
      repoRoot,
      scenario.line,
      host,
      required.runtime,
      portable ? undefined : required.version,
    );
    const statuses = scenario.steps.map(step => step.result.status);
    console.log(`${host} ${runtime} ${scenario.name}: ${statuses.join(', ')}; report: ${report}`);
    const failure = required.expectedFailure;
    const failures = failure ? [failure] : [];
    if (required.id.endsWith('-bounded-continuation')) failures.push('CONTINUATION_BOUND_EXCEEDED');
    const observed = failures.find(code => isIntendedFailure(status, statuses, scenario, code));
    if (observed) intendedFailures.push(observed);
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
  console.log(`${host} ${runtime} required cases passed: ${cases.map(row => row.id).join(', ')}`);
  return 0;
}

function nativeOpenCodeWorkers(repoRoot: string): number {
  const workers = spawnSync(
    process.execPath,
    [nodePath.join(repoRoot, 'packages/cli/scripts/probe-opencode-v2-workers.ts')],
    { cwd: repoRoot, env: process.env, stdio: 'inherit', timeout: 180_000 },
  );
  if (workers.error || workers.signal || (workers.status !== 0 && workers.status !== 2)) {
    console.error('HOST_CONTRACT_PROOF_UNAVAILABLE: native OpenCode worker probe did not complete');
    return 3;
  }
  return workers.status === 2 ? 2 : 0;
}

function nativeGroupResult(
  proof: string | undefined,
  repoRoot: string,
  report: string,
  scenarios: FeatureResult['elements'],
  status: number | null,
): number | undefined {
  if (proof === 'native-cursor-cli')
    return nativeResult(repoRoot, report, scenarios, status, {
      cases: cursorCliCases(),
      runtime: 'CLI',
      host: 'Cursor',
    });
  if (proof === 'native-cursor')
    return nativeResult(repoRoot, report, scenarios, status, {
      cases: cursorIdeCases(),
      runtime: 'IDE',
      host: 'Cursor',
    });
  if (proof === 'native-codex')
    return nativeResult(repoRoot, report, scenarios, status, {
      cases: codexCases(),
      runtime: 'CLI',
      host: 'Codex',
    });
  if (proof === 'native-opencode') {
    const result = nativeResult(repoRoot, report, scenarios, status, {
      cases: openCodeV2GuardCases(),
      runtime: 'CLI/TUI',
      host: 'OpenCode V2',
    });
    if (result !== 0) return result;
    const workers = nativeOpenCodeWorkers(repoRoot);
    if (workers !== 0) return workers;
    console.error(
      'HOST_CONTRACT_PROOF_INCOMPLETE: OpenCode catalogue and remaining runtime cases are required',
    );
    return 3;
  }
  return undefined;
}

function nativeProofTimeout(proof: string | undefined): number {
  if (
    ['native-cursor', 'native-cursor-cli', 'native-codex', 'native-opencode'].includes(proof ?? '')
  )
    return 1_800_000;
  if (proof === 'native-cursor-continuation') return 1_020_000;
  return 540_000;
}

const nativeCases = {
  'native-cursor-continuation': {
    title: 'A supported completion guard actually continues the conversation',
    failure: 'HOST_CONTINUATION_MISSING',
    steps: 4,
  },
  'native-codex-continuation': {
    title: 'A supported completion guard actually continues the conversation',
    failure: 'HOST_CONTINUATION_MISSING',
    steps: 4,
  },
};

function assertNativeRow(repoRoot: string, line: number, proof: string): void {
  if (proof === 'native-codex-continuation') {
    assertActualRow(repoRoot, line, 'Codex', 'CLI', '0.160.0');
    return;
  }
  if (proof !== 'native-cursor-continuation') {
    assertActualRow(repoRoot, line, proof === 'native-cursor' ? 'Cursor' : 'Codex');
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
    [
      'native-cursor',
      'native-codex',
      'native-cursor-cli',
      'native-cursor-continuation',
      'native-codex-continuation',
      'native-opencode',
    ].includes(proof ?? ''),
  );
  assert.deepEqual(args, ['--proof', proof, '--require-targets']);
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
  const groupResult = nativeGroupResult(proof, repoRoot, report, scenarios, result.status);
  if (groupResult !== undefined) return groupResult;
  const selected = nativeCases[proof as keyof typeof nativeCases];
  assert.ok(selected);
  assert.equal(scenarios.length, 1, 'Expected exactly the selected native example row');
  const [scenario] = scenarios;
  assert.ok(scenario);
  assert.equal(scenario.name, selected.title);
  assert.equal(scenario.steps.length, selected.steps);
  assertNativeRow(repoRoot, scenario.line, proof ?? '');
  const statuses = scenario.steps.map(step => step.result.status);
  console.log(`Native ${proof} catalogue statuses: ${statuses.join(', ')}; report: ${report}`);
  const failures = [selected.failure];
  if (proof === 'native-codex-continuation') failures.push('CONTINUATION_BOUND_EXCEEDED');
  const intendedFailure = failures.find(failure =>
    isIntendedFailure(result.status, statuses, scenario, failure),
  );
  if (intendedFailure) {
    console.error(`${intendedFailure}: observed native contract failure`);
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

function runProof(): number {
  try {
    return main();
  } catch (error) {
    console.error(
      `HOST_CONTRACT_PROOF_UNAVAILABLE: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 3;
  }
}

process.exitCode = runProof();
