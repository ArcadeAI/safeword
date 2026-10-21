import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

interface StepResult {
  result: { status: string; error_message?: string };
}

interface FeatureResult {
  uri: string;
  elements: { name: string; line: number; steps: StepResult[] }[];
}

function assertActualRow(repoRoot: string, line: number, cursor: boolean, runtime = 'IDE'): void {
  const source = readFileSync(
    nodePath.join(repoRoot, 'features/consistent-host-contract.feature'),
    'utf8',
  ).split('\n');
  const cells = source[line - 1]?.split('|').map(cell => cell.trim());
  assert.equal(cells?.[1], cursor ? 'Cursor' : 'Codex');
  if (cursor) {
    const matrix = JSON.parse(
      readFileSync(
        nodePath.join(repoRoot, 'packages/cli/tests/fixtures/host-contract/targets.json'),
        'utf8',
      ),
    ) as {
      targets: {
        agent: string;
        version: string;
        runtimes: string[];
        delivery_variants?: string[];
      }[];
    };
    const target = matrix.targets.find(
      row =>
        row.agent === 'cursor' &&
        row.runtimes.includes(runtime) &&
        row.delivery_variants?.includes('native'),
    );
    assert.ok(target);
    assert.equal(cells?.[2], target.version);
    assert.equal(cells?.[3], runtime);
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

function cursorCliResult(
  repoRoot: string,
  report: string,
  scenarios: FeatureResult['elements'],
  status: number | null,
): number {
  const names = [
    'A denied action has no side effect',
    'An allowed action reaches the side-effect boundary',
  ];
  assert.equal(scenarios.length, names.length, 'Expected both exact CLI write rows');
  let intendedFailure = false;
  let unavailable = false;
  for (const [index, scenario] of scenarios.entries()) {
    assert.equal(scenario.name, names[index]);
    assert.equal(scenario.steps.length, 4);
    assertActualRow(repoRoot, scenario.line, true, 'CLI');
    const statuses = scenario.steps.map(step => step.result.status);
    console.log(`Cursor CLI ${scenario.name}: ${statuses.join(', ')}; report: ${report}`);
    if (isIntendedFailure(status, statuses, scenario, 'NATIVE_GUARD_DISPATCH_MISSING'))
      intendedFailure = true;
    else if (statuses.some(value => value !== 'passed')) unavailable = true;
  }
  if (unavailable) {
    console.error('HOST_CONTRACT_PROOF_UNAVAILABLE: CLI setup/action did not reach its assertion');
    return 3;
  }
  if (intendedFailure) {
    console.error('NATIVE_GUARD_DISPATCH_MISSING: observed real CLI write contract failure');
    return 2;
  }
  console.error('HOST_CONTRACT_PROOF_INCOMPLETE: CLI catalogue-helper case is not yet wired');
  return 3;
}

/** Required pilot: preserve the actual Cucumber failure, never equate setup with RED. */
function main(): number {
  const args = process.argv.slice(2);
  const proof = args[1];
  assert.ok(['native-cursor', 'native-codex', 'native-cursor-cli'].includes(proof ?? ''));
  assert.deepEqual(args, ['--proof', proof, '--require-targets']);
  const cursor = proof === 'native-cursor';
  const cursorCli = proof === 'native-cursor-cli';
  const title = cursor
    ? 'Native delivery exposes the contracted catalogue'
    : 'Portable package loading proves only its portable components';
  const expectedFailure = cursor
    ? 'NATIVE_HELPER_ORIGIN_MISMATCH'
    : 'CODEX_COMPATIBILITY_OVERLAY_FALLBACK';
  const stepCount = cursor ? 4 : 3;
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
    { cwd: repoRoot, stdio: 'inherit', timeout: 540_000 },
  );
  if (result.error) throw result.error;
  const features = JSON.parse(readFileSync(report, 'utf8')) as FeatureResult[];
  const scenarios = features.flatMap(feature => feature.elements);
  assert.equal(features.length, 1);
  const feature = features[0];
  assert.ok(feature);
  assert.equal(
    nodePath.resolve(repoRoot, feature.uri),
    nodePath.join(repoRoot, 'features/consistent-host-contract.feature'),
  );
  if (cursorCli) return cursorCliResult(repoRoot, report, scenarios, result.status);
  assert.equal(scenarios.length, 1, 'Expected exactly the selected native example row');
  const [scenario] = scenarios;
  assert.ok(scenario);
  assert.equal(scenario.name, title);
  assert.equal(scenario.steps.length, stepCount);
  assertActualRow(repoRoot, scenario.line, cursor);
  const statuses = scenario.steps.map(step => step.result.status);
  console.log(`Native ${proof} catalogue statuses: ${statuses.join(', ')}; report: ${report}`);
  if (isIntendedFailure(result.status, statuses, scenario, expectedFailure)) {
    console.error(`${expectedFailure}: observed native catalogue resource/selection failure`);
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
