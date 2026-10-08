import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { RETROSPECTIVE_TICKET } from './retrospective-history.js';

const TEST_TIMEOUT_MS = 180_000;
const REPORT = 'retrospective-proof-report.json';
const MAX_PROCESS_OUTPUT = 128 * 1024;
const VITEST_SUITE_SEPARATOR = String.raw`(?:\s*>\s*|\s+)`;

export interface RetrospectiveProofRequest {
  readonly ticketId: string;
  readonly scenario: string;
  readonly testFile: string;
  readonly testFullName: string;
  readonly implementationPath: string;
  readonly mutation: {
    readonly before: string;
    readonly after: string;
    readonly expectedFailure: string;
    readonly assertionLocation: string;
  };
  readonly supportFiles: readonly string[];
}

export interface RetrospectiveProofObservation {
  readonly commit: string;
  readonly request: RetrospectiveProofRequest;
  readonly argv: readonly string[];
  readonly cwd: 'packages/cli';
  readonly sourceSha256: string;
  readonly mutantSha256: string;
  readonly supportSha256: Readonly<Record<string, string>>;
  readonly mutatedSupportSha256: Readonly<Record<string, string>>;
  readonly passing: {
    readonly exitCode: 0;
    readonly test: string;
    readonly passedTests: 1;
    readonly failedTests: 0;
  };
  readonly mutated: {
    readonly exitCode: number;
    readonly test: string;
    readonly passedTests: 0;
    readonly failedTests: 1;
    readonly failure: string;
  };
}

interface JsonAssertion {
  readonly fullName?: unknown;
  readonly status?: unknown;
  readonly failureMessages?: unknown;
}

interface JsonReport {
  readonly numPassedTests?: unknown;
  readonly numFailedTests?: unknown;
  readonly testResults?: unknown;
}

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function hasNoControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.codePointAt(index) ?? 0;
    if (code < 32 || code === 127) return false;
  }
  return true;
}

function safePath(path: string): boolean {
  return (
    path !== '' &&
    !nodePath.isAbsolute(path) &&
    !path.includes('\\') &&
    path.split('/').every(part => !['', '.', '..'].includes(part)) &&
    hasNoControlCharacters(path)
  );
}

export function exactSelection(fullName: string): string {
  const escaped = fullName.replaceAll(/[.*+?^${}()|[\]\\]/gu, character => `\\${character}`);
  // Vitest 5 filters on `suite > test`, while its JSON report still names
  // `suite test`. The report identity check below remains the final authority.
  return `^${escaped.replaceAll(' ', () => VITEST_SUITE_SEPARATOR)}$`;
}

// eslint-disable-next-line complexity -- Every branch rejects an unsafe proof request.
function validateRequest(request: RetrospectiveProofRequest): void {
  if (request.ticketId !== RETROSPECTIVE_TICKET)
    throw new Error('Only CKWE2D may use retrospective proof.');
  if (request.scenario.trim() === '' || request.testFullName.trim() === '') {
    throw new Error('Retrospective proof needs one named scenario and test.');
  }
  if (
    !safePath(request.testFile) ||
    !request.testFile.startsWith('packages/cli/tests/') ||
    !request.testFile.endsWith('.test.ts') ||
    !safePath(request.implementationPath) ||
    !request.implementationPath.startsWith('packages/cli/src/')
  ) {
    throw new Error('Retrospective proof paths must name CLI source and a CLI test.');
  }
  if (
    request.mutation.before === '' ||
    request.mutation.after === request.mutation.before ||
    request.mutation.expectedFailure.trim() === '' ||
    request.mutation.assertionLocation.trim() === ''
  ) {
    throw new Error('Retrospective proof needs a specific behavior removal and assertion.');
  }
  if (
    request.supportFiles.length === 0 ||
    new Set(request.supportFiles).size !== request.supportFiles.length ||
    request.supportFiles.some(path => !safePath(path))
  ) {
    throw new Error('Retrospective proof needs distinct contained support files.');
  }
}

function git(root: string, args: readonly string[]): Buffer {
  const result = spawnSync(
    proofExecutable(root, 'git', 'Git'),
    ['--no-replace-objects', '-C', root, ...args],
    {
      encoding: 'buffer',
      timeout: 30_000,
      maxBuffer: 128 * 1024 * 1024,
      env: Object.fromEntries(
        Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
      ),
    },
  );
  if (result.error !== undefined || result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    throw new Error('Retrospective proof could not inspect committed Git source.');
  }
  return result.stdout;
}

function snapshot(root: string, destination: string, commit: string): void {
  const archive = git(root, ['archive', '--format=tar', commit]);
  const extract = spawnSync(proofExecutable(root, 'tar', 'Tar'), ['-xf', '-', '-C', destination], {
    input: archive,
    encoding: 'buffer',
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
  if (extract.error !== undefined || extract.status !== 0) {
    throw new Error('Retrospective proof could not create an isolated source copy.');
  }
}

/** Bootstrap once from archived manifests; never borrow checkout node_modules. */
function installProofDependencies(passing: string, mutated: string, executable: string): void {
  const result = spawnSync(executable, ['install', '--frozen-lockfile', '--ignore-scripts'], {
    cwd: passing,
    env: proofEnvironment(executable),
    encoding: 'utf8',
    timeout: TEST_TIMEOUT_MS,
    maxBuffer: MAX_PROCESS_OUTPUT,
    windowsHide: true,
  });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error('Could not install retrospective proof dependencies from the frozen lockfile.');
  }
  for (const relative of ['node_modules', 'packages/cli/node_modules']) {
    const dependencyRoot = nodePath.join(passing, relative);
    if (!existsSync(dependencyRoot)) {
      if (relative === 'node_modules') throw new Error(`Missing proof dependency: ${relative}`);
      continue;
    }
    symlinkSync(dependencyRoot, nodePath.join(mutated, relative), 'dir');
  }
}

function proofEnvironment(executable: string): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env)
      .filter(([name]) => !name.startsWith('SAFEWORD_REVIEW_') && !name.startsWith('GIT_'))
      .map(([name, value]) => [
        name,
        name === 'PATH'
          ? `${nodePath.dirname(executable)}${nodePath.delimiter}${value ?? ''}`
          : value,
      ]),
  );
}

function assertionFromReport(
  path: string,
  fullName: string,
  expectedStatus: 'passed' | 'failed',
): { report: JsonReport; assertion: JsonAssertion } {
  const report = JSON.parse(readFileSync(path, 'utf8')) as JsonReport;
  if (!Array.isArray(report.testResults)) throw new Error('Proof has no test report.');
  const assertions = report.testResults.flatMap(result => {
    if (typeof result !== 'object' || result === null) return [];
    const values = (result as { assertionResults?: unknown }).assertionResults;
    return Array.isArray(values) ? (values as JsonAssertion[]) : [];
  });
  const selected = assertions.filter(
    value => value.status !== 'skipped' && value.status !== 'pending',
  );
  if (
    selected.length !== 1 ||
    selected[0]?.fullName !== fullName ||
    selected[0].status !== expectedStatus
  ) {
    throw new Error(`Proof did not execute exactly the named ${expectedStatus} test.`);
  }
  return { report, assertion: selected[0] };
}

function projectPath(root: string, candidate: string): boolean {
  const relative = nodePath.relative(root, candidate);
  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${nodePath.sep}`) &&
      !nodePath.isAbsolute(relative))
  );
}

/** Resolve proof tooling outside the project; committed test scripts still require review. */
function proofExecutable(root: string, name: string, label: string): string {
  const project = realpathSync.native(root);
  const directories = (process.env.PATH ?? '').split(nodePath.delimiter);
  for (const directory of directories) {
    const candidate = nodePath.resolve(
      root,
      directory,
      process.platform === 'win32' ? `${name}.exe` : name,
    );
    if (!existsSync(candidate)) continue;
    const canonical = realpathSync.native(candidate);
    if (
      projectPath(root, candidate) ||
      projectPath(project, candidate) ||
      projectPath(project, canonical)
    ) {
      throw new Error(`${label} executable must be outside the project.`);
    }
    try {
      accessSync(canonical, constants.X_OK);
      return canonical;
    } catch {
      /* Continue past a non-executable PATH entry. */
    }
  }
  throw new Error(`An installed ${label} executable is required for retrospective proof.`);
}

// eslint-disable-next-line complexity -- Every branch validates a separate test outcome.
function runTest(
  copy: string,
  argv: readonly string[],
  fullName: string,
  expectedStatus: 'passed' | 'failed',
): { exitCode: number; failure: string } {
  const cwd = nodePath.join(copy, 'packages/cli');
  const executable = argv[0];
  if (executable === undefined) throw new Error('Proof command is empty.');
  rmSync(nodePath.join(cwd, REPORT), { force: true });
  const result = spawnSync(executable, argv.slice(1), {
    cwd,
    env: proofEnvironment(executable),
    encoding: 'utf8',
    timeout: TEST_TIMEOUT_MS,
    maxBuffer: MAX_PROCESS_OUTPUT,
    windowsHide: true,
  });
  if (result.error !== undefined || result.signal !== null || result.status === null) {
    throw new Error('Proof command failed to finish normally.');
  }
  const { report, assertion } = assertionFromReport(
    nodePath.join(cwd, REPORT),
    fullName,
    expectedStatus,
  );
  if (expectedStatus === 'passed') {
    if (result.status !== 0 || report.numPassedTests !== 1 || report.numFailedTests !== 0) {
      throw new Error('The named current test did not pass.');
    }
  } else if (result.status === 0 || report.numPassedTests !== 0 || report.numFailedTests !== 1) {
    throw new Error('The named mutated test did not fail.');
  }
  const messages = assertion.failureMessages;
  return {
    exitCode: result.status,
    failure: Array.isArray(messages)
      ? messages.filter(value => typeof value === 'string').join('\n')
      : '',
  };
}

function requireArchivedSource(copy: string, path: string, source: Buffer): void {
  if (!readProofInput(copy, path).equals(source)) {
    throw new Error('Archived implementation differs from the committed source.');
  }
}

export function readProofInput(root: string, path: string): Buffer {
  if (!safePath(path)) throw new Error('Proof input path escapes the project.');
  const parts = path.split('/');
  let candidate = root;
  for (const [index, part] of parts.entries()) {
    candidate = nodePath.join(candidate, part);
    const stat = lstatSync(candidate);
    if (
      stat.isSymbolicLink() ||
      (index === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())
    ) {
      throw new Error(`Proof input must be a regular file without symlink components: ${path}`);
    }
  }
  return readFileSync(candidate);
}

function archiveDigests(copy: string, paths: readonly string[]): Record<string, string> {
  return Object.fromEntries(paths.map(path => [path, sha256(readProofInput(copy, path))]));
}

function requireDigests(
  actual: Readonly<Record<string, string>>,
  expected: Readonly<Record<string, string>>,
  message: string,
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message);
}

/** Identify the clean committed source used to build the replay archives. */
export function currentProofCommit(root: string): string {
  const commit = git(root, ['rev-parse', '--verify', 'HEAD^{commit}']).toString('utf8').trim();
  const trackedChanges = git(root, ['status', '--porcelain', '--untracked-files=no']);
  if (trackedChanges.toString('utf8').trim() !== '') {
    throw new Error('Commit tracked changes before running retrospective proof.');
  }
  return commit;
}

/**
 * Observe both executions only. This result is not a receipt and cannot authorize VERIFIED.
 * The coordinator must bind it to independent reviews before either gate may consume it.
 */
export function runRetrospectiveProof(
  projectRoot: string,
  request: RetrospectiveProofRequest,
): RetrospectiveProofObservation {
  validateRequest(request);
  const root = nodePath.resolve(projectRoot);
  const repoRoot = git(root, ['rev-parse', '--show-toplevel']).toString('utf8').trim();
  if (nodePath.resolve(repoRoot) !== root) {
    throw new Error('Retrospective proof requires the Git repository root.');
  }
  const commit = currentProofCommit(root);
  const inputs = [
    ...new Set([
      request.testFile,
      request.implementationPath,
      ...request.supportFiles,
      'bun.lock',
      'package.json',
      'packages/cli/package.json',
    ]),
  ];
  const supportSha256: Record<string, string> = {};
  for (const path of inputs) {
    const bytes = readProofInput(root, path);
    const committed = git(root, ['show', `${commit}:${path}`]);
    if (!bytes.equals(committed)) throw new Error(`Proof input differs from HEAD: ${path}`);
    supportSha256[path] = sha256(bytes);
  }
  const sourceBytes = readProofInput(root, request.implementationPath);
  const source = sourceBytes.toString('utf8');
  if (!Buffer.from(source, 'utf8').equals(sourceBytes)) {
    throw new Error('Retrospective proof implementation must be valid UTF-8.');
  }
  if (source.split(request.mutation.before).length !== 2) {
    throw new Error('Behavior-removal anchor must occur exactly once in the implementation.');
  }
  const mutant = source.replace(request.mutation.before, () => request.mutation.after);
  const argv = [
    proofExecutable(root, 'bun', 'Bun'),
    'run',
    'test',
    request.testFile.slice('packages/cli/'.length),
    '--testNamePattern',
    exactSelection(request.testFullName),
    '--reporter=json',
    `--outputFile=${REPORT}`,
  ] as const;
  const temporary = mkdtempSync(nodePath.join(tmpdir(), 'safeword-retrospective-proof-'));
  try {
    const passingCopy = nodePath.join(temporary, 'passing');
    const mutatedCopy = nodePath.join(temporary, 'mutated');
    mkdirSync(passingCopy);
    mkdirSync(mutatedCopy);
    snapshot(root, passingCopy, commit);
    snapshot(root, mutatedCopy, commit);
    requireArchivedSource(passingCopy, request.implementationPath, sourceBytes);
    requireArchivedSource(mutatedCopy, request.implementationPath, sourceBytes);
    const passingDigests = archiveDigests(passingCopy, inputs);
    requireDigests(
      passingDigests,
      supportSha256,
      'Archived proof inputs differ from committed source.',
    );
    writeFileSync(nodePath.join(mutatedCopy, request.implementationPath), mutant);
    const mutatedSupportSha256 = archiveDigests(mutatedCopy, inputs);
    const expectedMutated = { ...supportSha256, [request.implementationPath]: sha256(mutant) };
    requireDigests(
      mutatedSupportSha256,
      expectedMutated,
      'Mutated proof inputs differ beyond the declared mutation.',
    );
    installProofDependencies(passingCopy, mutatedCopy, argv[0]);
    runTest(passingCopy, argv, request.testFullName, 'passed');
    const mutated = runTest(mutatedCopy, argv, request.testFullName, 'failed');
    if (
      !mutated.failure.includes(request.mutation.expectedFailure) ||
      !mutated.failure.includes(request.mutation.assertionLocation)
    ) {
      throw new Error(
        `The mutation did not fail at the declared scenario assertion: ${mutated.failure.slice(0, 1000)}`,
      );
    }
    return {
      commit,
      request,
      argv,
      cwd: 'packages/cli',
      sourceSha256: sha256(sourceBytes),
      mutantSha256: sha256(mutant),
      supportSha256,
      mutatedSupportSha256,
      passing: { exitCode: 0, test: request.testFullName, passedTests: 1, failedTests: 0 },
      mutated: {
        exitCode: mutated.exitCode,
        test: request.testFullName,
        passedTests: 0,
        failedTests: 1,
        failure: mutated.failure,
      },
    };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
