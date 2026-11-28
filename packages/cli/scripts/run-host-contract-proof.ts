import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import hostReleases from '../src/lifecycle/host-releases.json' with { type: 'json' };
import {
  claudeCases,
  codexCases,
  cursorCliCases,
  cursorIdeCases,
  portableCases,
} from '../tests/fixtures/host-contract/native-contract-cases.js';
import {
  assertHeadlessContinuation,
  runOriginalAuthorControl,
} from './lib/headless-completion-controls.js';
import {
  gradeOpenCodePopulation,
  openCodePopulation,
  type OpenCodeResult,
} from './lib/opencode-population.js';
import { propagationLanes } from './lib/resource-propagation.js';

interface CompletedNativeCases {
  directory: string;
  ids: string[];
  reports: Record<string, string>;
}

function reportDigest(report: string): string {
  return createHash('sha256').update(readFileSync(report)).digest('hex');
}

interface StepResult {
  result: { status: string; error_message?: string };
}

interface FeatureResult {
  uri: string;
  elements: { name: string; line: number; steps: StepResult[] }[];
}

function nativeTargetVersion(agent: string, runtime: string): string {
  const target = Object.values(hostReleases).find(
    row =>
      row.agent === agent &&
      row.runtimes.includes(runtime) &&
      (row.delivery_variants ?? ['native']).includes('native'),
  );
  assert.ok(target);
  return target.version;
}

function assertActualRow(
  repoRoot: string,
  line: number,
  host: 'Cursor' | 'Codex' | 'OpenCode V2' | 'Claude Code',
  runtime = 'IDE',
  expectedVersion?: string,
): void {
  const source = readFileSync(
    nodePath.join(repoRoot, 'features/consistent-host-contract.feature'),
    'utf8',
  ).split('\n');
  const row = source[line - 1];
  assert.ok(row);
  const cells = row
    .split('|')
    .slice(1, -1)
    .map(cell => cell.trim());
  assert.equal(cells[0], host);
  let agent = host.toLowerCase();
  if (host === 'Claude Code') agent = 'claude';
  else if (host === 'OpenCode V2') agent = 'opencode';
  const version = expectedVersion ?? nativeTargetVersion(agent, runtime);
  assert.equal(cells[1] ?? version, version);
  if (cells.length > 2) assert.equal(cells[2], runtime);
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

function expectedNativeFailures(required: { id: string; expectedFailure?: string }): string[] {
  const failures = required.expectedFailure ? [required.expectedFailure] : [];
  if (required.id.endsWith('-denied-write')) failures.push('DENIED_SIDE_EFFECT_OBSERVED');
  if (required.id.endsWith('-allowed-write')) failures.push('ALLOWED_SIDE_EFFECT_MISSING');
  if (required.id.endsWith('-catalogue-helper')) failures.push('NATIVE_HELPER_ORIGIN_MISMATCH');
  if (required.id.endsWith('-bounded-continuation')) failures.push('CONTINUATION_BOUND_EXCEEDED');
  if (required.id.endsWith('-portable-components')) failures.push('PORTABLE_COMPONENTS_NOT_LOADED');
  return failures;
}

export function nativeResult(
  repoRoot: string,
  report: string,
  scenarios: FeatureResult['elements'],
  status: number | null,
  population: {
    cases: ReturnType<typeof cursorCliCases>;
    runtime: string;
    host: 'Cursor' | 'Codex' | 'OpenCode V2' | 'Claude Code';
    completed?: CompletedNativeCases;
  },
): number {
  const { cases, runtime, host, completed } = population;
  assert.equal(scenarios.length, cases.length, `Expected every contracted ${runtime} scenario`);
  const intendedFailures: string[] = [];
  let unavailable = false;
  for (const [index, scenario] of scenarios.entries()) {
    const required = cases[index];
    assert.ok(required);
    assert.equal(scenario.name, required.scenario);
    assert.equal(scenario.line, required.line);
    assert.equal(scenario.steps.length, required.stepCount);
    assertActualRow(repoRoot, scenario.line, host, required.runtime, required.version);
    const statuses = scenario.steps.map(step => step.result.status);
    console.log(`${host} ${runtime} ${scenario.name}: ${statuses.join(', ')}; report: ${report}`);
    const failures = expectedNativeFailures(required);
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
        scope: 'feature-rows-only',
        admission_eligible: false,
        case_ids: cases.map(row => row.id),
        report,
      },
      undefined,
      2,
    ),
  );
  if (completed) {
    completed.ids.push(...cases.map(row => row.id));
    const name = `${nodePath.basename(nodePath.dirname(report))}-cucumber.json`;
    const bytes = readFileSync(report);
    writeFileSync(nodePath.join(completed.directory, name), bytes, { flag: 'wx' });
    completed.reports[name] = createHash('sha256').update(bytes).digest('hex');
  }
  console.log(`${host} ${runtime} feature cases passed: ${cases.map(row => row.id).join(', ')}`);
  return 0;
}

const nativeGroups = {
  'native-cursor-cli': { cases: cursorCliCases, runtime: 'CLI', host: 'Cursor' },
  'native-cursor': { cases: cursorIdeCases, runtime: 'IDE', host: 'Cursor' },
  'native-codex': { cases: codexCases, runtime: 'CLI', host: 'Codex' },
  'native-claude': { cases: claudeCases, runtime: 'CLI', host: 'Claude Code' },
} as const;

function nativeProofTimeout(proof: string | undefined): number {
  if (
    [
      'native-cursor',
      'native-cursor-cli',
      'native-codex',
      'native-opencode',
      'native-claude',
    ].includes(proof ?? '')
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
    assertActualRow(repoRoot, line, 'Codex', 'CLI', nativeTargetVersion('codex', 'CLI'));
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
  assert.deepEqual(cells, ['', 'Cursor', nativeTargetVersion('cursor', 'IDE'), '']);
}

function readNativeScenarios(repoRoot: string, report: string): FeatureResult['elements'] {
  const features = JSON.parse(readFileSync(report, 'utf8')) as FeatureResult[];
  assert.equal(features.length, 1);
  const [feature] = features;
  assert.ok(feature);
  assert.equal(
    nodePath.resolve(repoRoot, feature.uri),
    nodePath.join(repoRoot, 'features/consistent-host-contract.feature'),
  );
  return feature.elements;
}

function parseNativeProof(args: readonly string[], codexActionsOnly?: boolean): string {
  const proof = args[1];
  assert.ok(
    proof &&
      [
        'native-cursor',
        'native-codex',
        'native-claude',
        'native-cursor-cli',
        'native-cursor-continuation',
        'native-codex-continuation',
        'native-opencode',
      ].includes(proof),
  );
  assert.deepEqual(args, ['--proof', proof, '--require-targets']);
  assert.ok(!codexActionsOnly || proof === 'native-codex');
  return proof;
}

/** Required pilot: preserve the actual Cucumber failure, never equate setup with RED. */
function runNativeProof(
  args: readonly string[],
  options: { codexActionsOnly?: boolean; completed?: CompletedNativeCases } = {},
): number {
  const { codexActionsOnly, completed } = options;
  const proof = parseNativeProof(args, codexActionsOnly);
  const actions = codexActionsOnly
    ? codexCases().filter(row => /-(?:allowed|denied)-write$/u.test(row.id))
    : undefined;
  if (actions) assert.equal(actions.length, 2);

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
      ...(actions?.flatMap(row => ['--name', `^${row.scenario}$`]) ?? []),
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
  const scenarios = readNativeScenarios(repoRoot, report).toSorted(
    (left, right) => left.line - right.line,
  );
  const group = nativeGroups[proof as keyof typeof nativeGroups];
  if (actions || group) {
    const population = actions
      ? { cases: actions, runtime: 'CLI', host: 'Codex' as const }
      : { cases: group.cases(), runtime: group.runtime, host: group.host };
    return nativeResult(repoRoot, report, scenarios, result.status, { ...population, completed });
  }
  return standaloneNativeResult(proof, {
    repoRoot,
    report,
    scenarios,
    status: result.status,
  });
}

function standaloneNativeResult(
  proof: string,
  observation: {
    repoRoot: string;
    report: string;
    scenarios: FeatureResult['elements'];
    status: number | null;
  },
): number {
  const { repoRoot, report, scenarios, status } = observation;
  const selected = nativeCases[proof as keyof typeof nativeCases];
  assert.ok(selected);
  assert.equal(scenarios.length, 1, 'Expected exactly the selected native example row');
  const [scenario] = scenarios;
  assert.ok(scenario);
  assert.equal(scenario.name, selected.title);
  assert.equal(scenario.steps.length, selected.steps);
  assertNativeRow(repoRoot, scenario.line, proof);
  const statuses = scenario.steps.map(step => step.result.status);
  console.log(`Native ${proof} catalogue statuses: ${statuses.join(', ')}; report: ${report}`);
  const failures = [selected.failure];
  if (proof === 'native-codex-continuation') failures.push('CONTINUATION_BOUND_EXCEEDED');
  const intendedFailure = failures.find(failure =>
    isIntendedFailure(status, statuses, scenario, failure),
  );
  if (intendedFailure) {
    console.error(`${intendedFailure}: observed native contract failure`);
    return 2;
  }
  if (status !== 0 || statuses.some(stepStatus => stepStatus !== 'passed')) {
    console.error('HOST_CONTRACT_PROOF_UNAVAILABLE: scenario did not reach the intended failure');
    return 3;
  }
  // The catalogue is one obligation. Guard, continuation and identity cases must
  // join this group before it can admit a native package or report conformance.
  console.error(`HOST_CONTRACT_PROOF_INCOMPLETE: remaining ${proof} obligations are unwired`);
  return 3;
}

function runOpenCodeProof(completed?: CompletedNativeCases, directory?: string): number {
  const result = spawnSync(
    process.execPath,
    [
      nodePath.join(import.meta.dirname, 'lib/opencode-population-run.ts'),
      ...(directory ? [directory] : []),
    ],
    {
      cwd: nodePath.resolve(import.meta.dirname, '../../..'),
      stdio: 'inherit',
      timeout: nativeProofTimeout('native-opencode'),
    },
  );
  const exit = result.error || result.signal ? 3 : (result.status ?? 3);
  if (exit !== 0 || !directory || !completed) return exit;
  const report = JSON.parse(
    readFileSync(nodePath.join(directory, 'opencode-cases.json'), 'utf8'),
  ) as {
    exit: number;
    results: OpenCodeResult[];
    candidate_payload_sha256: string;
  };
  assert.equal(report.exit, 0);
  assert.match(report.candidate_payload_sha256, /^[a-f0-9]{64}$/u);
  const grade = gradeOpenCodePopulation(openCodePopulation(), report.results);
  if (grade !== 0) return grade;
  completed.ids.push(...report.results.map(row => row.id));
  return 0;
}

function runProof(): number {
  try {
    if (process.argv[3] === 'portable-components') {
      assert.deepEqual(process.argv.slice(2), [
        '--proof',
        'portable-components',
        '--require-targets',
      ]);
      return runPortableProof();
    }
    if (
      ['propagation', 'headless-propagation', 'headless-qualification'].includes(
        String(process.argv[3]),
      )
    )
      return runPropagationComponent();
    if (process.argv[3] === 'native-opencode') {
      assert.deepEqual(process.argv.slice(2), ['--proof', 'native-opencode', '--require-targets']);
      return runOpenCodeProof();
    }
    if (process.argv[3] === 'native-codex-internal-workflows') {
      assert.deepEqual(process.argv.slice(2), [
        '--proof',
        'native-codex-internal-workflows',
        '--require-targets',
      ]);
      const result = spawnSync(
        process.execPath,
        [
          nodePath.join(import.meta.dirname, 'check-codex-internal-workflows.ts'),
          '--require-targets',
        ],
        {
          cwd: nodePath.resolve(import.meta.dirname, '../../..'),
          stdio: 'inherit',
          timeout: 1_240_000,
        },
      );
      return result.error || result.signal ? 3 : (result.status ?? 3);
    }
    return runNativeProof(process.argv.slice(2));
  } catch (error) {
    console.error(
      `HOST_CONTRACT_PROOF_UNAVAILABLE: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 3;
  }
}

function runPortableProof(codexOnly = false, completed?: CompletedNativeCases): number {
  const cases = portableCases()
    .filter(row => !codexOnly || row.host === 'Codex')
    .toSorted((a, b) => a.id.localeCompare(b.id));
  console.log(`PORTABLE_REQUIRED_CASES: ${JSON.stringify(cases.map(row => row.id))}`);
  for (const key of [
    'SAFEWORD_CODEX_TEST_CONFIG',
    ...(codexOnly ? [] : ['SAFEWORD_CURSOR_CLI', 'SAFEWORD_CURSOR_TEST_CONFIG']),
  ])
    assert.ok(process.env[key], `HOST_CONTRACT_PROOF_UNAVAILABLE: ${key} required`);
  const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
  const outcomes = new Set(
    cases.map(row => {
      const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-portable-proof-'));
      const report = nodePath.join(directory, 'cucumber.json');
      const result = spawnSync(
        nodePath.join(repoRoot, 'scripts/dev'),
        [
          'node',
          '--import',
          'tsx',
          'node_modules/@cucumber/cucumber/bin/cucumber.js',
          '--config',
          'packages/cli/tests/fixtures/host-contract/cucumber.portable-components.mjs',
          '--profile',
          row.id,
          '--format',
          'progress',
          '--format',
          `json:${report}`,
        ],
        { cwd: repoRoot, stdio: 'inherit', timeout: nativeProofTimeout('native-cursor') },
      );
      if (result.error || result.signal) return 3;
      return nativeResult(repoRoot, report, readNativeScenarios(repoRoot, report), result.status, {
        cases: [row],
        host: row.host,
        runtime: row.runtime,
        completed,
      });
    }),
  );
  if (outcomes.has(3)) return 3;
  return outcomes.has(2) ? 2 : 0;
}

export function assertHeadlessPropagationReport(path: string): void {
  const result = JSON.parse(readFileSync(path, 'utf8')) as {
    exit: number;
    admission_eligible: boolean;
    required: { id: string }[];
    baseline: { lane: string; installation: string }[];
    settings: { lane: string; installation: string }[];
    continuation: { installation: string; raw: string };
    claudeContinuation: { installation: string; raw: string };
  };
  assert.equal(result.exit, 0);
  assert.equal(result.admission_eligible, false);
  const lanes = propagationLanes({ headless: true })
    .map(lane => lane.id)
    .toSorted((left, right) => left.localeCompare(right));
  assert.deepEqual(
    result.required.map(lane => lane.id).toSorted((left, right) => left.localeCompare(right)),
    lanes,
  );
  assert.deepEqual(
    result.baseline.map(row => row.lane).toSorted((left, right) => left.localeCompare(right)),
    lanes,
  );
  assert.deepEqual(
    result.settings.map(row => row.lane).toSorted((left, right) => left.localeCompare(right)),
    lanes,
  );
  const installations = new Map(result.baseline.map(row => [row.lane, row.installation]));
  for (const row of result.settings) assert.equal(row.installation, installations.get(row.lane));
  for (const [agent, continuation] of [
    ['codex', result.continuation],
    ['claude', result.claudeContinuation],
  ] as const) {
    const lane = lanes.find(id => id.startsWith(`${agent}@`));
    assert.ok(lane);
    assert.ok(continuation?.installation);
    assert.equal(continuation.installation, installations.get(lane));
    assertHeadlessContinuation(agent, continuation.raw);
  }
}

function runHeadlessQualification(): number {
  assert.deepEqual(process.argv.slice(2), [
    '--proof',
    'headless-qualification',
    '--require-targets',
  ]);
  const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
  const git = (args: string[]) =>
    execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
  const sourceHead = git(['rev-parse', 'HEAD']);
  const trackedChanges = () => git(['status', '--porcelain', '--untracked-files=no']);
  const initialChanges = trackedChanges();
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-headless-qualification-'));
  const propagation = runPropagation('headless-qualification', false, directory);
  if (propagation !== 0) return propagation;
  assertHeadlessPropagationReport(nodePath.join(directory, 'resource-results.json'));
  const completed: CompletedNativeCases = { directory, ids: [], reports: {} };
  // The Cursor CLI group already includes its portable row.
  for (const proof of ['native-claude', 'native-cursor-cli']) {
    const native = runNativeProof(['--proof', proof, '--require-targets'], { completed });
    if (native !== 0) return native;
  }
  const codex = runNativeProof(['--proof', 'native-codex', '--require-targets'], {
    codexActionsOnly: true,
    completed,
  });
  if (codex !== 0) return codex;
  const portable = runPortableProof(true, completed);
  if (portable !== 0) return portable;
  const expected = [
    ...claudeCases(),
    ...cursorCliCases(),
    ...codexCases().filter(row => /-(?:allowed|denied)-write$/u.test(row.id)),
    ...portableCases().filter(row => row.host === 'Codex'),
  ].map(row => row.id);
  assert.equal(new Set(expected).size, expected.length, 'Duplicate required Cucumber case');
  assert.deepEqual(
    completed.ids.toSorted((left, right) => left.localeCompare(right)),
    expected.toSorted((left, right) => left.localeCompare(right)),
    'Incomplete Cucumber case set',
  );
  console.log(
    `HEADLESS_CUCUMBER_CASES_COMPLETED ${JSON.stringify(completed.ids.toSorted((left, right) => left.localeCompare(right)))}`,
  );
  const opencode = runOpenCodeProof(completed, directory);
  if (opencode !== 0) return opencode;
  const featureCases = [...expected, ...openCodePopulation().map(row => row.id)];
  assert.equal(new Set(featureCases).size, featureCases.length, 'Duplicate required feature case');
  assert.deepEqual(
    completed.ids.toSorted((left, right) => left.localeCompare(right)),
    featureCases.toSorted((left, right) => left.localeCompare(right)),
    'Incomplete native feature cases',
  );
  console.log(
    `HEADLESS_NATIVE_FEATURE_CASES_COMPLETED ${JSON.stringify(completed.ids.toSorted((left, right) => left.localeCompare(right)))}`,
  );
  const inputs = JSON.parse(readFileSync(nodePath.join(directory, 'inputs.json'), 'utf8')) as {
    source_head: string;
  };
  assert.equal(initialChanges, '', 'Qualification started with uncommitted tracked changes');
  assert.equal(git(['rev-parse', 'HEAD']), sourceHead, 'Qualification source revision changed');
  assert.equal(trackedChanges(), '', 'Qualification ended with uncommitted tracked changes');
  assert.equal(inputs.source_head, sourceHead, 'Propagation used a different source revision');
  const authorReport = 'original-author-control.json';
  runOriginalAuthorControl(repoRoot, nodePath.join(directory, authorReport));
  assert.equal(git(['rev-parse', 'HEAD']), sourceHead, 'Qualification source revision changed');
  assert.equal(trackedChanges(), '', 'Original-author control changed tracked source');
  const reports = ['inputs.json', 'resource-results.json', 'opencode-cases.json', authorReport];
  const reportDigests = Object.fromEntries(
    reports.map(report => [report, reportDigest(nodePath.join(directory, report))]),
  );
  const summary = nodePath.join(directory, 'qualification-components.json');
  writeFileSync(
    summary,
    JSON.stringify(
      {
        source_head: sourceHead,
        purpose: 'diagnostic-only',
        admission_eligible: false,
        case_ids: completed.ids.toSorted((left, right) => left.localeCompare(right)),
        controls: {
          continuation_limits: ['claude', 'codex'],
          original_author: 'unknown-author-fails-closed',
        },
        report_sha256: { ...reportDigests, ...completed.reports },
      },
      undefined,
      2,
    ),
  );
  console.log(`HEADLESS_QUALIFICATION_COMPONENTS ${summary}`);
  console.error('HOST_CONTRACT_PROOF_UNAVAILABLE: HEADLESS_QUALIFICATION_EVIDENCE_INCOMPLETE');
  return 3;
}

export function runPropagationComponent(): number {
  if (process.argv[3] === 'headless-qualification') return runHeadlessQualification();
  if (process.argv[3] === 'headless-propagation') {
    const prepare = process.argv[5] === '--prepare';
    assert.deepEqual(process.argv.slice(2), [
      '--proof',
      'headless-propagation',
      '--require-targets',
      ...(prepare ? ['--prepare'] : []),
    ]);
    return runPropagation('headless', prepare);
  }
  if (process.argv.length === 5) {
    console.error(
      'HOST_CONTRACT_PROOF_UNAVAILABLE: propagation policy/options native probes remain unwired; resource component alone cannot complete task6',
    );
    return 3;
  }
  const component = process.argv[6];
  assert.ok(component === 'resources' || component === 'policy-resources');
  assert.deepEqual(process.argv.slice(2), [
    '--proof',
    'propagation',
    '--require-targets',
    '--component',
    component,
  ]);
  return runPropagation(component);
}

function runPropagation(
  component: 'resources' | 'policy-resources' | 'headless' | 'headless-qualification',
  prepare = false,
  reportDirectory?: string,
): number {
  const result = spawnSync(
    process.execPath,
    [
      nodePath.join(import.meta.dirname, 'lib/resource-propagation-run.ts'),
      component,
      ...(prepare ? ['--prepare'] : []),
      ...(reportDirectory ? [reportDirectory] : []),
    ],
    {
      cwd: nodePath.resolve(import.meta.dirname, '..'),
      stdio: 'inherit',
      timeout: nativeProofTimeout('native-cursor'),
      env: {
        ...process.env,
        SAFEWORD_PROPAGATION_DEADLINE: String(Date.now() + nativeProofTimeout('native-cursor')),
      },
    },
  );
  if (result.error || result.signal) return 3;
  return result.status === 0 || result.status === 2 ? result.status : 3;
}

if (import.meta.main) process.exitCode = runProof();
