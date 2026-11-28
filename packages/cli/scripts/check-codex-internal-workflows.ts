import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import {
  codexInternalCases,
  codexStaticResourceKind,
} from '../tests/fixtures/host-contract/native-contract-cases.js';

interface ResultStep {
  embeddings?: { mime_type: string; data: string }[];
  hidden?: boolean;
  keyword?: string;
  result: { status: string; error_message?: string };
}
export interface InvocationScenarioResult {
  name: string;
  line: number;
  steps: ResultStep[];
}
const menuScenario = 'Internal selector entries are hidden while public controls remain offered';

function visibleSteps(scenario: InvocationScenarioResult): ResultStep[] {
  return scenario.steps.filter(step => !step.hidden);
}

function isMenuRed(scenario: InvocationScenarioResult): boolean {
  const steps = visibleSteps(scenario);
  const last = steps.at(-1);
  return (
    scenario.name === menuScenario &&
    steps.length === 3 &&
    steps.slice(0, -1).every(step => step.result.status === 'passed') &&
    last?.result.status === 'failed' &&
    last.result.error_message?.includes('INTERNAL_WORKFLOW_VISIBLE') === true
  );
}

interface Preservation {
  kind: string;
  scenario: string;
  arm?: string;
  artifacts: string;
  file: string;
  observation: Record<string, unknown>;
}
function staticResourceIdentity(
  observation: Preservation['observation'],
  scenario: string,
): boolean {
  const id = codexInternalCases().find(row => row.scenario === scenario)?.id;
  return (
    id !== undefined &&
    codexStaticResourceKind(id) !== undefined &&
    observation.resourceCaseId === id &&
    observation.resourceCheckKind === codexStaticResourceKind(id)
  );
}
function staticResourceFacts(observation: Preservation['observation']): boolean {
  return (
    observation.fiveTrustedBindingsUnchanged === false &&
    observation.persistedHookTrustBypassed === false &&
    Array.isArray(observation.nativeBehaviorArgv) &&
    observation.nativeBehaviorArgv.length === 0 &&
    observation.resourceCheckCompleted === true &&
    observation.originalFiveTrustedBindingsUnchanged === true &&
    observation.fiveEnabledBindingsUnchanged === true
  );
}
function preservedObservation(
  observation: Preservation['observation'] | undefined,
  scenario: string,
): boolean {
  if (
    observation?.mode === 'isolated-behavior' &&
    observation.nativeModelInvocation === 'not-applicable'
  ) {
    return (
      staticResourceIdentity(observation, scenario) &&
      staticResourceFacts(observation) &&
      ['originalConfigUnchanged', 'originalRuntimeUnchanged', 'originalBundleUnchanged'].every(
        key => observation[key] === true,
      )
    );
  }
  return Boolean(
    observation &&
    ['originalConfigUnchanged', 'originalRuntimeUnchanged', 'originalBundleUnchanged'].every(
      key => observation[key] === true,
    ) &&
    (observation.persistedHookTrustBypassed === true
      ? observation.originalFiveTrustedBindingsUnchanged === true &&
        observation.fiveEnabledBindingsUnchanged === true
      : observation.fiveTrustedBindingsUnchanged === true),
  );
}

function preservation(step: ResultStep, scenario: string): Preservation | undefined {
  const embeddings = step.embeddings ?? [];
  for (const embedding of embeddings) {
    if (embedding.mime_type !== 'application/json') continue;
    try {
      const value = JSON.parse(
        Buffer.from(embedding.data, 'base64').toString('utf8'),
      ) as Preservation;
      if (
        value.kind === 'codex-internal-preservation' &&
        value.scenario === scenario &&
        typeof value.artifacts === 'string' &&
        value.file === nodePath.join(value.artifacts, 'preservation.json') &&
        preservedObservation(value.observation, scenario)
      )
        return value;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function preservationReceipts(scenario: InvocationScenarioResult): Preservation[] {
  const embeddings = scenario.steps
    .filter(step => step.hidden && step.keyword === 'After')
    .flatMap(step => step.embeddings ?? [])
    .filter(item => item.mime_type === 'application/json');
  const expected = codexInternalCases().find(row => row.scenario === scenario.name)
    ?.preservationArms ?? ['single'];
  const receipts = embeddings.flatMap(
    embedding =>
      preservation({ result: { status: 'passed' }, embeddings: [embedding] }, scenario.name) ?? [],
  );
  if (receipts.length !== expected.length || embeddings.length !== expected.length) return [];
  if (new Set(receipts.map(receipt => receipt.artifacts)).size !== expected.length) return [];
  return expected.every(arm => receipts.some(receipt => (receipt.arm ?? 'single') === arm))
    ? receipts
    : [];
}

function hasPassedHooks(scenario: InvocationScenarioResult): boolean {
  return (
    preservationReceipts(scenario).length > 0 &&
    scenario.steps.filter(step => step.hidden).every(step => step.result.status === 'passed')
  );
}

export function verifyPreservationFiles(scenarios: InvocationScenarioResult[]): void {
  const fixture = JSON.parse(
    readFileSync(process.env.SAFEWORD_CODEX_GUARD_FIXTURE ?? '', 'utf8'),
  ) as { root: string };
  const root = realpathSync(fixture.root);
  for (const scenario of scenarios) {
    const receipts = preservationReceipts(scenario);
    assert.ok(
      receipts.length > 0,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: complete preservation receipts missing',
    );
    for (const receipt of receipts) {
      const directory = realpathSync(receipt.artifacts);
      assert.equal(nodePath.dirname(directory), root);
      assert.ok(nodePath.basename(directory).startsWith('internal-workflows-'));
      assert.equal(realpathSync(receipt.file), nodePath.join(directory, 'preservation.json'));
      assert.deepEqual(JSON.parse(readFileSync(receipt.file, 'utf8')), receipt.observation);
      const identity = JSON.parse(
        readFileSync(nodePath.join(directory, 'identity.json'), 'utf8'),
      ) as { profile: string };
      assert.equal(identity.profile, nodePath.join(directory, 'profile'));
      assert.equal(realpathSync(identity.profile), identity.profile);
      if (receipt.arm && receipt.arm !== 'single') {
        const armFixture = JSON.parse(
          readFileSync(nodePath.join(directory, 'wiring-fixture.json'), 'utf8'),
        ) as { arm: string };
        assert.equal(armFixture.arm, receipt.arm);
      }
    }
  }
}

function verifiedResult(scenarios: InvocationScenarioResult[], status: number | null): number {
  const code = invocationResult(scenarios, status);
  if (code !== 3) verifyPreservationFiles(scenarios);
  return code;
}

function hasUnmetBehavior(scenario: InvocationScenarioResult): boolean {
  const steps = visibleSteps(scenario);
  const failed = steps.length - 1;
  return (
    failed !== -1 &&
    steps[failed]?.result.error_message?.includes('INTERNAL_WORKFLOW_UNMET:') === true &&
    steps.slice(0, failed).every(step => step.result.status === 'passed') &&
    steps[failed]?.result.status === 'failed'
  );
}

function observedFailure(scenario: InvocationScenarioResult): boolean {
  return isMenuRed(scenario) || hasUnmetBehavior(scenario);
}

/** A failed setup or failed preservation hook never counts as product evidence. */
export function invocationResult(
  scenarios: InvocationScenarioResult[],
  status: number | null,
): number {
  if (scenarios.length === 0) return 3;
  let red = false;
  for (const scenario of scenarios) {
    const steps = visibleSteps(scenario);
    if (!hasPassedHooks(scenario) || steps.length === 0) return 3;
    if (steps.every(step => step.result.status === 'passed')) continue;
    if (!observedFailure(scenario)) return 3;
    red = true;
  }
  if (red) return status === 1 ? 2 : 3;
  return status === 0 ? 0 : 3;
}

function executeCases(report: string, selectedId?: string) {
  const repo = nodePath.resolve(import.meta.dirname, '../../..');
  const env = { ...process.env };
  delete env.SAFEWORD_CODEX_INTERNAL_CASE;
  if (selectedId !== undefined) env.SAFEWORD_CODEX_INTERNAL_CASE = selectedId;
  return spawnSync(
    nodePath.join(repo, 'scripts/dev'),
    [
      'node',
      '--import',
      'tsx',
      'node_modules/@cucumber/cucumber/bin/cucumber.js',
      '--config',
      'packages/cli/tests/fixtures/host-contract/cucumber.native-codex-internal-workflows.mjs',
      '--format',
      `json:${report}`,
    ],
    { cwd: repo, env, stdio: 'inherit', timeout: 3_600_000 },
  );
}

export function selectedInvocationCases(args: string[]) {
  const filtered = args[0] === '--case';
  if (filtered) assert.equal(args.length, 3);
  assert.equal(args.at(-1), '--require-targets');
  if (!filtered) assert.equal(args.length, 1);
  const population = codexInternalCases();
  const expected = filtered
    ? population.filter(row =>
        args[1] === 'menu' ? row.scenario === menuScenario : row.id === args[1],
      )
    : population;
  assert.ok(expected.length, 'HOST_CONTRACT_PROOF_UNAVAILABLE: unknown feature case ID');
  return { expected, filtered };
}

export function assertInvocationPopulation(
  scenarios: InvocationScenarioResult[],
  expected: ReturnType<typeof codexInternalCases>,
): void {
  assert.equal(
    scenarios.length,
    expected.length,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: incomplete case population',
  );
  for (const [index, scenario] of scenarios.entries()) {
    const row = expected[index];
    assert.ok(row);
    assert.equal(scenario.name, row.scenario);
    assert.equal(scenario.line, row.line);
    assert.equal(visibleSteps(scenario).length, row.stepCount);
  }
}

function invocationMode() {
  const fixtureFile = process.env.SAFEWORD_CODEX_GUARD_FIXTURE;
  if (!fixtureFile) return {};
  const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8')) as {
    mode?: string;
    normalTrustQualification?: boolean;
  };
  if (fixture.mode === 'isolated-behavior')
    return { mode: 'isolated-behavior', persisted_hook_trust_bypassed: true };
  if (fixture.normalTrustQualification)
    return { mode: 'normal-trust-invalidation', persisted_hook_trust_bypassed: false };
  return {};
}

function main(): number {
  const { expected, filtered } = selectedInvocationCases(process.argv.slice(2));
  const first = expected[0];
  assert.ok(first);
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-invocation-report-'));
  const report = nodePath.join(directory, 'cucumber.json');
  console.log(`Native invocation report: ${directory}`);
  const result = executeCases(report, filtered ? first.id : undefined);
  if (result.error || result.signal) return 3;
  const features = JSON.parse(readFileSync(report, 'utf8')) as {
    elements?: InvocationScenarioResult[];
  }[];
  const scenarios = features.flatMap(feature => feature.elements ?? []);
  assertInvocationPopulation(scenarios, expected);
  const code = verifiedResult(scenarios, result.status);
  const mode = invocationMode();
  writeFileSync(
    nodePath.join(directory, 'result.json'),
    `${JSON.stringify(
      {
        status: ({ 0: 'passed', 2: 'unmet', 3: 'unavailable' } as Record<number, string>)[code],
        code,
        complete_group: !filtered && code === 0,
        admission_eligible: false,
        method: 'native-installed-boundaries',
        ...mode,
        case_ids: expected.map(row => row.id),
        report,
      },
      undefined,
      2,
    )}\n`,
  );
  if (code === 2)
    console.error(
      filtered && expected[0]?.scenario === menuScenario
        ? 'INTERNAL_WORKFLOW_VISIBLE: actual native selector offers internal testing'
        : 'INTERNAL_WORKFLOW_UNMET: a completed native observation did not satisfy the required behavior',
    );
  else if (code === 3)
    console.error('HOST_CONTRACT_PROOF_UNAVAILABLE: native invocation proof incomplete');
  return code;
}

function run(): number {
  try {
    return main();
  } catch (error) {
    console.error(`HOST_CONTRACT_PROOF_UNAVAILABLE: ${String(error)}`);
    return 3;
  }
}
if (import.meta.main) process.exitCode = run();
