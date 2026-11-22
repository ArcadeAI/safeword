import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import nodePath from 'node:path';

import { smallWorkObservationTag, validSmallWorkObservationTag } from '../review/job.js';
import { executeNoShellCommand } from '../review/red-execution.js';

export interface SmallWorkProofRequest {
  readonly ticket: string;
  readonly contractDigest: string;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly target: string;
  readonly entryPoint: string;
  readonly baselineRevision: string;
  readonly inputs: readonly string[];
  readonly expectedFailure: string;
  readonly expectation?: 'failure' | 'pass';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

const CONTRACT_DIGEST = /^[a-f\d]{64}$/u;
const GIT_OBJECT_ID = /^(?:[a-f\d]{40}|[a-f\d]{64})$/u;
const textFields = [
  'ticket',
  'contractDigest',
  'cwd',
  'target',
  'entryPoint',
  'baselineRevision',
  'expectedFailure',
] as const;

export function isSmallWorkProofRequest(value: unknown): value is SmallWorkProofRequest {
  if (typeof value !== 'object' || value === null) return false;
  const request = value as Record<string, unknown>;
  if (textFields.some(field => typeof request[field] !== 'string')) return false;
  if (![undefined, 'failure', 'pass'].includes(request.expectation as string | undefined))
    return false;
  const { ticket, contractDigest, baselineRevision, argv, inputs } =
    request as unknown as SmallWorkProofRequest;
  return (
    ticket.trim() !== '' &&
    CONTRACT_DIGEST.test(contractDigest) &&
    GIT_OBJECT_ID.test(baselineRevision) &&
    isStringArray(argv) &&
    isStringArray(inputs)
  );
}

function projectRelativePath(root: string, absolute: string): string {
  const relative = nodePath.relative(root, absolute);
  if (
    relative === '..' ||
    relative.startsWith(`..${nodePath.sep}`) ||
    nodePath.isAbsolute(relative)
  ) {
    throw new Error('Small-work proof inputs must stay inside the project.');
  }
  return relative.split(nodePath.sep).join('/');
}

function fingerprint(cwd: string, request: SmallWorkProofRequest, resumed = false): string {
  const root = realpathSync.native(cwd);
  const entryPath = realpathSync.native(nodePath.resolve(root, request.entryPoint));
  const entryRelative = projectRelativePath(root, entryPath);
  const baseline = execFileSync('git', ['show', `${request.baselineRevision}:${entryRelative}`], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (!resumed && !readFileSync(entryPath).equals(baseline)) {
    throw new Error('The declared entry point has changed from the pre-test baseline.');
  }
  const hash = createHash('sha256').update(JSON.stringify(request)).update(baseline);
  const proofPaths = new Set([request.target, ...request.inputs]);
  for (const path of proofPaths) {
    const absolute = realpathSync.native(nodePath.resolve(root, path));
    const relative = projectRelativePath(root, absolute);
    const contents = absolute === entryPath ? baseline : readFileSync(absolute);
    const digest = createHash('sha256').update(contents).digest('hex');
    hash.update(JSON.stringify([path, relative, digest]));
  }
  return hash.digest('hex');
}

function validateRunInputs(request: SmallWorkProofRequest): void {
  if (
    !GIT_OBJECT_ID.test(request.baselineRevision) ||
    !request.argv.includes(request.target) ||
    (request.expectation !== 'pass' && request.expectedFailure.trim() === '') ||
    request.entryPoint === request.target
  ) {
    throw new Error(
      'Name an existing entry point, a separate target test in argv, and its expected failure.',
    );
  }
}

/** Observe the exact task test and reject execution if its declared proof inputs move. */
export async function observeSmallWorkProof(cwd: string, request: SmallWorkProofRequest) {
  validateRunInputs(request);
  const sourceFingerprint = fingerprint(cwd, request);
  const run = await executeNoShellCommand({
    projectRoot: cwd,
    cwd: request.cwd,
    argv: request.argv,
    timeoutMs: 30_000,
    expectedOutput: request.expectation === 'pass' ? undefined : request.expectedFailure,
  });
  if (sourceFingerprint !== fingerprint(cwd, request)) {
    throw new Error('Small-work proof inputs changed during execution. Rerun the current proof.');
  }

  const { exitCode, signal, timedOut } = run.termination;
  const completed = !timedOut && signal === null;
  const observed = {
    sourceFingerprint,
    stdout: run.stdout.sha256,
    stderr: run.stderr.sha256,
    startedAt: run.startedAt,
    expectedFailureObserved:
      completed && exitCode !== null && exitCode > 0 && run.expectedOutputMatched,
    passingRunObserved: completed && exitCode === 0,
  };
  const tag = smallWorkObservationTag(cwd, JSON.stringify(observed));
  return { run, observation: { ...observed, tag } };
}

type Observation = Awaited<ReturnType<typeof observeSmallWorkProof>>['observation'];

export function verifySmallWorkProof(
  cwd: string,
  request: SmallWorkProofRequest,
  observation: unknown,
  previousAdmission?: string,
): boolean {
  if (typeof observation !== 'object' || observation === null) return false;
  const { tag, ...observed } = observation as Observation;
  if (
    typeof tag !== 'string' ||
    !validSmallWorkObservationTag(cwd, JSON.stringify(observed), tag)
  ) {
    return false;
  }
  try {
    const resumed =
      previousAdmission !== undefined &&
      validSmallWorkObservationTag(cwd, `admitted:${tag}`, previousAdmission);
    return (
      (request.expectation === 'pass'
        ? observed.passingRunObserved
        : observed.expectedFailureObserved) &&
      observed.sourceFingerprint === fingerprint(cwd, request, resumed)
    );
  } catch {
    return false;
  }
}

export function smallWorkAdmissionToken(cwd: string, observation: unknown): string | undefined {
  const tag = (observation as Partial<Observation> | undefined)?.tag;
  return typeof tag === 'string' ? smallWorkObservationTag(cwd, `admitted:${tag}`) : undefined;
}
