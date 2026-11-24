import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { executeNoShellCommand, type NoShellExecutionResult } from './red-execution.js';
import { evaluateElectronReport } from './retrospective-electron-report.js';
import {
  type ElectronProofRequest,
  parseElectronProofRequest,
} from './retrospective-electron-request.js';
import { SOULLESS_RETROSPECTIVE_POLICY } from './retrospective-policy.js';
import {
  archiveDigests,
  archiveProofSnapshot,
  currentProofCommit,
  proofEnvironment,
  proofExecutable,
  proofExecutableInvocation,
  proofGit,
  proofSha256,
  readProofInput,
  requireDigests,
  type RetrospectiveProofObservation,
} from './retrospective-proof.js';

interface ElectronIsolation {
  readonly snapshot: string;
  readonly build: string;
  readonly profileRoot: string;
  readonly rendererPort: number;
}

export interface ElectronProofObservation extends Omit<
  RetrospectiveProofObservation,
  'cwd' | 'request'
> {
  readonly request: ElectronProofRequest;
  readonly cwd: 'packages/desktop';
  readonly policyId: string;
  readonly policySha256: string;
  readonly isolation: { readonly original: ElectronIsolation; readonly mutated: ElectronIsolation };
}

const DESKTOP = 'packages/desktop';
const STAGE_TIMEOUT_MS = 180_000;

/** Fixed structural metadata, never an allowance for requested symlink inputs. */
function requireCompatibilityAliases(root: string, commit?: string): void {
  for (const [relative, target] of Object.entries(
    SOULLESS_RETROSPECTIVE_POLICY.compatibilityAliases,
  )) {
    const alias = path.join(root, relative);
    const parent = path.dirname(alias);
    if (
      realpathSync.native(parent) !== parent ||
      !lstatSync(alias).isSymbolicLink() ||
      readlinkSync(alias) !== target ||
      realpathSync.native(alias) !== path.resolve(parent, target)
    )
      throw new Error(`Electron compatibility alias changed: ${relative}`);
    if (
      commit !== undefined &&
      proofGit(root, ['show', `${commit}:${relative}`]).toString('utf8') !== target
    ) {
      throw new Error(
        `Electron compatibility alias differs from the committed policy: ${relative}`,
      );
    }
  }
}

function requireSnapshotInputs(
  copy: string,
  inputs: readonly string[],
  digests: Record<string, string>,
  message: string,
): void {
  requireCompatibilityAliases(copy);
  requireDigests(archiveDigests(copy, inputs), digests, message);
}

function executableInputs(
  root: string,
  commit: string,
  request: ElectronProofRequest,
  requestPath: string,
): string[] {
  const tracked = proofGit(root, ['ls-tree', '-r', '--name-only', '-z', commit])
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  const regular = tracked.filter(
    file => !Object.hasOwn(SOULLESS_RETROSPECTIVE_POLICY.compatibilityAliases, file),
  );
  const mandatory = regular.filter(
    file =>
      file.startsWith(`${DESKTOP}/`) ||
      file.startsWith('scripts/') ||
      /^packages\/[^/]+\/package\.json$/u.test(file) ||
      (!file.includes('/') &&
        (/\.(?:[cm]?js|ts|json)$/u.test(file) || file === '.npmrc' || file === '.pnpmfile.cjs')),
  );
  return [
    ...new Set([
      ...mandatory,
      requestPath,
      request.testFile,
      request.implementationPath,
      ...request.supportFiles,
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      `${DESKTOP}/package.json`,
    ]),
  ].toSorted((left, right) => left.localeCompare(right, 'en'));
}

function committedDigests(
  root: string,
  commit: string,
  inputs: readonly string[],
): Record<string, string> {
  return Object.fromEntries(
    inputs.map(input => {
      const bytes = readProofInput(root, input);
      let committed: Buffer;
      try {
        committed = proofGit(root, ['show', `${commit}:${input}`]);
      } catch (error: unknown) {
        throw new Error(`Could not verify committed Electron input: ${input}`, { cause: error });
      }
      if (!bytes.equals(committed)) {
        throw new Error(`Electron proof input differs from the committed view: ${input}`);
      }
      return [input, proofSha256(bytes)];
    }),
  );
}

function mutatedSource(root: string, request: ElectronProofRequest): string {
  const bytes = readProofInput(root, request.implementationPath);
  const source = bytes.toString('utf8');
  if (!Buffer.from(source, 'utf8').equals(bytes))
    throw new Error('Electron implementation must be UTF-8.');
  if (source.split(request.mutation.before).length !== 2) {
    throw new Error('Electron behavior-removal anchor must occur exactly once.');
  }
  return source.replace(request.mutation.before, () => request.mutation.after);
}

async function freePort(excluded: ReadonlySet<number>): Promise<number> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const server = createServer();
    const port = await new Promise<number>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address === null || typeof address === 'string') {
          server.close();
          reject(new Error('Electron proof could not reserve a renderer port.'));
          return;
        }
        server.close(error => {
          if (error === undefined) resolve(address.port);
          else reject(error);
        });
      });
    });
    if (!excluded.has(port)) return port;
  }
  throw new Error('Electron proof could not choose distinct renderer ports.');
}

function environment(
  node: string,
  isolation: ElectronIsolation,
  report: string,
): NodeJS.ProcessEnv {
  const inherited = Object.fromEntries(
    Object.entries(proofEnvironment(node)).filter(
      ([name]) =>
        !name.startsWith('PLAYWRIGHT_') &&
        !name.startsWith('SOULLESS_') &&
        !['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'NODE_PATH'].includes(name),
    ),
  );
  return {
    ...inherited,
    TMPDIR: isolation.profileRoot,
    TMP: isolation.profileRoot,
    TEMP: isolation.profileRoot,
    SOULLESS_ELECTRON_TEST_PORT: String(isolation.rendererPort),
    PLAYWRIGHT_JSON_OUTPUT_FILE: report,
  };
}

function normalExit(result: NoShellExecutionResult, stage: string): number {
  const { exitCode, signal, timedOut } = result.termination;
  if (timedOut || signal !== null || exitCode === null) {
    throw new Error(`Electron ${stage} did not finish normally.`);
  }
  return exitCode;
}

async function setupCommand(
  copy: string,
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
  stage: string,
): Promise<void> {
  const result = await executeNoShellCommand({
    projectRoot: copy,
    cwd: '.',
    argv,
    environment: env,
    timeoutMs: STAGE_TIMEOUT_MS,
  });
  if (normalExit(result, stage) !== 0) {
    throw new Error(`Electron ${stage} failed: ${result.stderr.excerpt.slice(-2000)}`);
  }
}

function escape(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

function selectionArguments(request: ElectronProofRequest): string[] {
  const file = request.testFile.slice(`${DESKTOP}/`.length);
  const fullName = escape(request.testFullName).replaceAll('/', String.raw`\/`);
  return [
    'test',
    '--config=playwright-electron.config.ts',
    `${escape(file)}:${request.testLine}`,
    '--grep',
    `/^${fullName}$/`,
    '--workers=1',
    '--retries=0',
    '--repeat-each=1',
    '--no-deps',
    '--forbid-only',
    '--reporter=json',
  ];
}

interface SnapshotExecution {
  readonly isolation: ElectronIsolation;
  readonly request: ElectronProofRequest;
  readonly node: string;
  readonly pnpm: string;
  readonly reportPath: string;
  readonly expected: 'passed' | 'failed';
  readonly inputs: readonly string[];
  readonly digests: Record<string, string>;
}

async function executeSnapshot(
  input: SnapshotExecution,
): Promise<{ exitCode: number; failure: string }> {
  const { isolation, request, node, pnpm, reportPath, expected, inputs, digests } = input;
  const copy = isolation.snapshot;
  const env = environment(node, isolation, reportPath);
  await setupCommand(copy, [pnpm, 'install', '--frozen-lockfile'], env, 'frozen install');
  requireSnapshotInputs(copy, inputs, digests, 'Electron install changed committed proof inputs.');
  rmSync(isolation.build, { recursive: true, force: true });
  await setupCommand(
    copy,
    [pnpm, '--filter', '@soulless/desktop', 'run', 'build'],
    env,
    'full desktop build',
  );
  for (const file of ['main/index.js', 'preload/index.cjs', 'renderer/index.html'])
    readProofInput(copy, `${DESKTOP}/out/${file}`);
  requireSnapshotInputs(copy, inputs, digests, 'Electron build changed committed proof inputs.');
  rmSync(reportPath, { force: true });
  const result = await executeNoShellCommand({
    projectRoot: copy,
    cwd: DESKTOP,
    argv: [node, path.join(copy, 'node_modules/playwright/cli.js'), ...selectionArguments(request)],
    environment: env,
    timeoutMs: STAGE_TIMEOUT_MS,
  });
  const exitCode = normalExit(result, 'test');
  const evaluated = evaluateElectronReport(
    JSON.parse(readFileSync(reportPath, 'utf8')),
    request,
    expected,
    exitCode,
  );
  requireSnapshotInputs(
    copy,
    inputs,
    digests,
    'Electron execution changed committed proof inputs.',
  );
  return evaluated;
}

function prepareSnapshot(
  root: string,
  temporary: string,
  label: string,
  commit: string,
  rendererPort: number,
): ElectronIsolation {
  const copy = path.join(temporary, label);
  const profileRoot = path.join(temporary, `${label}-profiles`);
  mkdirSync(copy);
  mkdirSync(profileRoot);
  archiveProofSnapshot(root, copy, commit);
  return { snapshot: copy, build: path.join(copy, DESKTOP, 'out'), profileRoot, rendererPort };
}

/** Observation only; historical eligibility and independent signed reviews authorize credit. */
export async function runElectronProof(
  root: string,
  input: unknown,
  requestPath: string,
): Promise<ElectronProofObservation> {
  const request = parseElectronProofRequest(input);
  const canonical = realpathSync.native(root);
  if (proofGit(canonical, ['rev-parse', '--show-toplevel']).toString('utf8').trim() !== canonical) {
    throw new Error('Electron proof requires the Git repository root.');
  }
  const commit = currentProofCommit(canonical);
  const inputs = executableInputs(canonical, commit, request, requestPath);
  const supportSha256 = committedDigests(canonical, commit, inputs);
  const stored = parseElectronProofRequest(
    JSON.parse(readProofInput(canonical, requestPath).toString('utf8')),
  );
  if (JSON.stringify(stored) !== JSON.stringify(request))
    throw new Error('Electron request differs from its committed file.');
  const mutant = mutatedSource(canonical, request);
  requireCompatibilityAliases(canonical, commit);
  const sourceSha256 = proofSha256(readProofInput(canonical, request.implementationPath));
  const node = proofExecutable(canonical, 'node', 'Node');
  const pnpm = proofExecutableInvocation(canonical, 'pnpm', 'pnpm');
  const temporaryPath = mkdtempSync(path.join(tmpdir(), 'safeword-electron-proof-'));
  const temporary = realpathSync.native(temporaryPath);
  try {
    const originalPort = await freePort(new Set());
    const mutatedPort = await freePort(new Set([originalPort]));
    const original = prepareSnapshot(canonical, temporary, 'original', commit, originalPort);
    const mutated = prepareSnapshot(canonical, temporary, 'mutated', commit, mutatedPort);
    requireCompatibilityAliases(original.snapshot);
    requireCompatibilityAliases(mutated.snapshot);
    requireDigests(
      archiveDigests(original.snapshot, inputs),
      supportSha256,
      'Original archive differs from committed inputs.',
    );
    requireDigests(
      archiveDigests(mutated.snapshot, inputs),
      supportSha256,
      'Mutated archive differs before the declared mutation.',
    );
    writeFileSync(path.join(mutated.snapshot, request.implementationPath), mutant);
    const mutatedSupportSha256 = {
      ...supportSha256,
      [request.implementationPath]: proofSha256(mutant),
    };
    requireDigests(
      archiveDigests(mutated.snapshot, inputs),
      mutatedSupportSha256,
      'Mutation changed undeclared inputs.',
    );
    await executeSnapshot({
      isolation: original,
      request,
      node,
      pnpm,
      reportPath: path.join(temporary, 'original.json'),
      expected: 'passed',
      inputs,
      digests: supportSha256,
    });
    const killed = await executeSnapshot({
      isolation: mutated,
      request,
      node,
      pnpm,
      reportPath: path.join(temporary, 'mutated.json'),
      expected: 'failed',
      inputs,
      digests: mutatedSupportSha256,
    });
    if (currentProofCommit(canonical) !== commit)
      throw new Error('Electron proof source HEAD changed during execution.');
    requireCompatibilityAliases(canonical, commit);
    requireDigests(
      committedDigests(canonical, commit, inputs),
      supportSha256,
      'Electron source inputs changed during execution.',
    );
    return {
      commit,
      request,
      argv: [node, 'node_modules/playwright/cli.js', ...selectionArguments(request)],
      cwd: DESKTOP,
      policyId: SOULLESS_RETROSPECTIVE_POLICY.id,
      policySha256: proofSha256(JSON.stringify(SOULLESS_RETROSPECTIVE_POLICY)),
      sourceSha256,
      mutantSha256: proofSha256(mutant),
      supportSha256,
      mutatedSupportSha256,
      isolation: { original, mutated },
      passing: { exitCode: 0, test: request.testFullName, passedTests: 1, failedTests: 0 },
      mutated: {
        exitCode: killed.exitCode,
        test: request.testFullName,
        passedTests: 0,
        failedTests: 1,
        failure: killed.failure,
      },
    };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
