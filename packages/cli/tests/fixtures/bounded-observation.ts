import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  constants,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { compareText } from '../../src/bounded-observation/contract.js';

export const observerRepo = nodePath.resolve(import.meta.dirname, '../../../..');
const mappingPath =
  '.project/tickets/PPHQN5-observe-bounded-delivery-proof/evidence/proposed-assertion-map.json';

interface RequiredAssertion {
  file: string;
  full_name: string;
}

interface ReviewedMapping {
  cases: { case_id: string; required_assertions: RequiredAssertion[] }[];
  assertion_sources: { file: string; sha256: string }[];
}

export const reviewedObserverMapping = JSON.parse(
  readFileSync(nodePath.join(observerRepo, mappingPath), 'utf8'),
) as ReviewedMapping;

export const expectedObserverFiles = [
  'tests/bdd-proof-tags.test.ts',
  'tests/integration/planning-scope-review.test.ts',
  'tests/integration/planning-evidence-boundary.test.ts',
  'tests/integration/installed-planning-copy-admission.test.ts',
  'tests/integration/execution-upstream-planning-context.test.ts',
  'tests/integration/planning-review-route-order.test.ts',
  'tests/integration/execution-plan-checkpoint.test.ts',
  'tests/review/execution-plan-conformance.test.ts',
  'tests/review/execution-plan-contract-identity.test.ts',
  'tests/claude-plugin/catalogue.test.ts',
  'tests/codex-plugin-version.test.ts',
  'tests/integration/planning-documentation.test.ts',
];

export interface ObserverOutput {
  ok: boolean;
  errors?: { code: string; message: string }[];
  next_actions?: { command: string; mutates: boolean; requires_human: boolean }[];
  data?: {
    status: string;
    purpose: string;
    authority: string;
    ticket: string;
    attempt_id: string;
    candidate_commit: string;
    current?: boolean;
    profile_sha256: string;
    runtime_sha256: string;
    tools: Record<string, { path: string; sha256: string; version?: string }>;
    execution_environment: Record<string, string>;
    command: { public_argv: string[]; runner_argv: string[] };
    inputs: Record<string, string>;
    case_results: {
      case_id: string;
      assertions: (RequiredAssertion & { status: string })[];
    }[];
    report_path: string;
    report_sha256: string;
  };
}

export interface ObserverCommand {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  output: ObserverOutput;
}

export interface ObserverCandidate {
  directory: string;
  root: string;
  environment: NodeJS.ProcessEnv;
  commit: string;
  dispose(): void;
}

function git(root: string, argv: string[]): string {
  return execFileSync('git', argv, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
  });
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Full contribution source, not a fixture which manufactures the required test names. */
export function createObserverCandidate(): ObserverCandidate {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-observer-proof-'));
  const root = nodePath.join(directory, 'candidate');
  mkdirSync(root);
  try {
    const files = [
      ...new Set(
        git(observerRepo, ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
          .split('\0')
          .filter(Boolean),
      ),
    ].toSorted((left, right) => left.localeCompare(right));
    const copiedFiles: string[] = [];
    for (const file of files) {
      const source = nodePath.join(observerRepo, file);
      if (!existsSync(source)) continue;
      const destination = nodePath.join(root, file);
      mkdirSync(nodePath.dirname(destination), { recursive: true });
      cpSync(source, destination, { verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE });
      copiedFiles.push(file);
    }
    for (const source of reviewedObserverMapping.assertion_sources) {
      const candidateFile = nodePath.join(root, source.file);
      const originalFile = nodePath.join(observerRepo, source.file);
      assert.equal(
        sha256(readFileSync(candidateFile)),
        sha256(readFileSync(originalFile)),
        `Candidate must use the real assertion source: ${source.file}`,
      );
    }
    git(root, ['init', '--quiet']);
    git(root, ['add', '--all', '--force']);
    const committedFiles = git(root, ['ls-files', '-z']).split('\0').filter(Boolean);
    assert.deepEqual(
      committedFiles.toSorted(compareText),
      copiedFiles.toSorted(compareText),
      'Retain every copied input, including tracked files matched by ignore rules',
    );
    git(root, [
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'user.name=SYNTHETIC_OBSERVER',
      '-c',
      'user.email=observer@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'Fixture snapshot of actual observer contribution',
    ]);
    const dependencyRoots = [
      'node_modules',
      ...files
        .filter(file => /^packages\/[^/]+\/package\.json$/u.test(file))
        .map(file => nodePath.join(nodePath.dirname(file), 'node_modules')),
    ];
    for (const relative of dependencyRoots) {
      const source = nodePath.join(observerRepo, relative);
      if (existsSync(source)) {
        cpSync(source, nodePath.join(root, relative), {
          recursive: true,
          verbatimSymlinks: true,
          mode: constants.COPYFILE_FICLONE,
        });
      }
    }
    assert.equal(git(root, ['status', '--porcelain']).trim(), '', 'Candidate must be clean');
    const home = nodePath.join(directory, 'home');
    mkdirSync(home);
    return {
      directory,
      root,
      commit: git(root, ['rev-parse', 'HEAD']).trim(),
      environment: {
        PATH: process.env.PATH,
        HOME: home,
        XDG_STATE_HOME: nodePath.join(directory, 'state'),
        TMPDIR: tmpdir(),
        SAFEWORD_NO_UPDATE_CHECK: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_NOSYSTEM: '1',
      },
      dispose: () => {
        rmSync(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

export function runObserverCli(candidate: ObserverCandidate, operands: string[]): ObserverCommand {
  const child = spawnSync(
    'bun',
    ['--no-env-file', 'packages/cli/src/cli.ts', ...operands, '--json', '--no-input'],
    {
      cwd: candidate.root,
      env: candidate.environment,
      encoding: 'utf8',
      timeout: 900_000,
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  assert.equal(child.error, undefined, `CLI process failed: ${String(child.error)}`);
  return {
    exitCode: child.status,
    stdout: child.stdout,
    stderr: child.stderr,
    output: JSON.parse(child.stdout) as ObserverOutput,
  };
}

export function runSubstitutedCommand(candidate: ObserverCandidate): ObserverCommand {
  const marker = nodePath.join(candidate.directory, 'caller-command-ran');
  return runObserverCli(candidate, [
    'proof',
    'observe-bounded-delivery',
    '--command',
    `touch ${marker}`,
  ]);
}

export function expectFixedRequestRefusal(
  result: ObserverCommand,
  candidate: ObserverCandidate,
): void {
  assert.notEqual(result.exitCode, 0, result.stdout);
  assert.ok(
    result.output.errors?.some(
      error => error.code === 'CLI_ARGUMENT_INVALID' && error.message.includes('--command'),
    ),
  );
  assert.equal(
    existsSync(nodePath.join(candidate.directory, 'caller-command-ran')),
    false,
    'A caller-selected command must never run',
  );
  assert.equal(
    result.output.data?.authority,
    'execution-only',
    `Unsupported overrides need execution-only fixed-request recovery: ${result.stdout}`,
  );
  assert.equal(result.output.data.purpose, 'bounded-delivery-observation:v1');
  assert.ok(
    result.output.next_actions?.some(
      action => action.command === 'safeword proof observe-bounded-delivery',
    ),
  );
}

export function expectCompleteObservation(
  result: ObserverCommand,
  candidate: ObserverCandidate,
): void {
  assert.equal(
    result.output.ok,
    true,
    `the public CLI cannot produce and verify a complete bounded observation: ${result.stdout}${result.stderr}`,
  );
  assert.equal(result.exitCode, 0, result.stdout + result.stderr);
  const data = result.output.data;
  assert.ok(data, 'The public CLI must emit the observation');
  assert.equal(data.status, 'observed');
  assert.equal(data.authority, 'execution-only');
  assert.equal(data.purpose, 'bounded-delivery-observation:v1');
  assert.equal(data.ticket, 'T3E4NS');
  assert.equal(data.candidate_commit, candidate.commit);
  assert.match(data.attempt_id, /^[\da-f-]{36}$/u);
  assert.match(data.profile_sha256, /^[\da-f]{64}$/u);
  assert.match(data.runtime_sha256, /^[\da-f]{64}$/u);
  expectResolvedTools(data);
  assert.deepEqual(data.command.public_argv, ['proof', 'observe-bounded-delivery']);
  assert.deepEqual(data.command.runner_argv, [
    'bun',
    'run',
    'test',
    ...expectedObserverFiles,
    '--no-cache',
    '--retry=0',
    '--reporter=json',
    `--outputFile=${data.report_path}`,
  ]);
  for (const file of [
    'bun.lock',
    'package.json',
    'packages/cli/package.json',
    ...reviewedObserverMapping.assertion_sources.map(source => source.file),
  ]) {
    const candidateFile = nodePath.join(candidate.root, file);
    assert.equal(data.inputs[`file:${file}`], sha256(readFileSync(candidateFile)), file);
  }
  for (const tool of ['node', 'bun', 'git', 'codex', 'mise', 'tar']) {
    assert.match(data.inputs[`tool:${tool}`] ?? '', /^[\da-f]{64}$/u, tool);
  }
  assert.match(data.inputs['source:tracked'] ?? '', /^[\da-f]{64}$/u);
  assert.equal(data.case_results.length, 37);
  assert.deepEqual(
    data.case_results.map(row => row.case_id).toSorted((left, right) => left.localeCompare(right)),
    reviewedObserverMapping.cases
      .map(row => row.case_id)
      .toSorted((left, right) => left.localeCompare(right)),
  );
  for (const expected of reviewedObserverMapping.cases) {
    const actual:
      { case_id: string; assertions: (RequiredAssertion & { status: string })[] } | undefined =
      data.case_results.find(row => row.case_id === expected.case_id);
    assert.ok(actual);
    assert.deepEqual(
      actual.assertions.map(({ file, full_name, status }) => ({ file, full_name, status })),
      expected.required_assertions.map(assertion => ({ ...assertion, status: 'passed' })),
    );
  }
  const report = readFileSync(data.report_path);
  assert.equal(sha256(report), data.report_sha256, 'Retain the actual full report bytes');
  const raw = JSON.parse(report.toString('utf8')) as {
    testResults: { name: string; assertionResults: { fullName: string; status: string }[] }[];
  };
  const unique = new Map(
    reviewedObserverMapping.cases
      .flatMap(row => row.required_assertions)
      .map(assertion => [`${assertion.file}\0${assertion.full_name}`, assertion]),
  );
  for (const required of unique.values()) {
    const results = raw.testResults
      .filter(file => file.name.endsWith(required.file))
      .flatMap(file =>
        file.assertionResults.filter(assertion => assertion.fullName === required.full_name),
      );
    assert.equal(results.length, 1, `Exact-once raw result: ${required.full_name}`);
    assert.equal(results[0]?.status, 'passed');
  }
}

function expectResolvedTools(data: NonNullable<ObserverOutput['data']>): void {
  assert.ok(
    data.tools,
    `Observation must retain inspectable resolved tool identities; emitted fields: ${Object.keys(data).join(', ')}`,
  );
  for (const name of ['node', 'bun', 'git', 'codex', 'mise', 'tar']) {
    const tool = data.tools[name];
    assert.ok(tool, `Retain the actual ${name} identity`);
    assert.equal(nodePath.isAbsolute(tool.path), true);
    assert.equal(sha256(readFileSync(tool.path)), tool.sha256, `Actual ${name} executable bytes`);
  }
  assert.equal(data.tools.node?.version, 'v24.18.1');
  assert.equal(data.tools.bun?.version, '1.3.14');
  assert.equal(
    realpathSync(data.execution_environment.TMPDIR ?? ''),
    realpathSync(tmpdir()),
    'Preserve the host shared-lock namespace',
  );
  assert.equal(data.execution_environment.LANG, 'C');
  assert.equal(data.execution_environment.TZ, 'UTC');
  assert.equal(data.execution_environment.GIT_CONFIG_GLOBAL, '/dev/null');
}
