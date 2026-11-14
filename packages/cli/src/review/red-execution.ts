import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import nodePath from 'node:path';

import type {
  RedExecutionAttestation,
  RedExecutionRequest,
  RedExecutionStream,
} from './contract.js';

const MAX_EXCERPT_BYTES = 64 * 1024;

function terminateProofTree(child: ChildProcess): void {
  if (process.platform === 'win32' && child.pid !== undefined) {
    const terminated = spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      timeout: 1000,
      windowsHide: true,
    });
    if (terminated.status === 0) return;
  }
  if (process.platform !== 'win32' && child.pid !== undefined) {
    try {
      process.kill(-child.pid, 'SIGKILL');
      return;
    } catch {
      // Fall back to the direct child when process-group signaling is unavailable.
    }
  }
  child.kill('SIGKILL');
}

function containedWorkingDirectory(root: string, requested: string): string {
  const canonicalRoot = realpathSync.native(root);
  const canonicalCwd = realpathSync.native(nodePath.resolve(canonicalRoot, requested));
  const relative = nodePath.relative(canonicalRoot, canonicalCwd);
  if (
    relative === '..' ||
    relative.startsWith(`..${nodePath.sep}`) ||
    nodePath.isAbsolute(relative)
  )
    throw new Error('RED proof working directory must stay inside the reviewed project');
  return canonicalCwd;
}

function proofEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('SAFEWORD_REVIEW_')),
  );
}

function environmentIdentity(
  environment: NodeJS.ProcessEnv,
): RedExecutionAttestation['environment'] {
  const entries = Object.entries(environment).toSorted(([left], [right]) =>
    left.localeCompare(right),
  );
  const sha256 = createHash('sha256').update(JSON.stringify(entries)).digest('hex');
  return {
    sha256,
    variable_count: entries.length,
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    ...(process.versions.bun !== undefined && { bun: process.versions.bun }),
  };
}

class StreamEvidence {
  readonly #hash = createHash('sha256');
  readonly #chunks: Buffer[] = [];
  #retained = 0;
  #bytes = 0;
  #tail = '';
  #matched = false;

  constructor(private readonly expected?: string) {}

  add(chunk: Buffer): void {
    this.#hash.update(chunk);
    this.#bytes += chunk.length;
    if (this.#retained < MAX_EXCERPT_BYTES) {
      const retained = chunk.subarray(0, MAX_EXCERPT_BYTES - this.#retained);
      this.#chunks.push(retained);
      this.#retained += retained.length;
    }
    if (this.expected !== undefined && !this.#matched) {
      const text = this.#tail + chunk.toString('utf8');
      this.#matched = text.includes(this.expected);
      this.#tail = text.slice(-Math.max(0, this.expected.length - 1));
    }
  }

  get matched(): boolean {
    return this.#matched;
  }

  finish(): RedExecutionStream {
    return {
      excerpt: Buffer.concat(this.#chunks).toString('utf8'),
      bytes: this.#bytes,
      sha256: this.#hash.digest('hex'),
      truncated: this.#bytes > this.#retained,
    };
  }
}

export interface NoShellExecutionResult {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly environment: RedExecutionAttestation['environment'];
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly termination: {
    readonly exitCode: number | null;
    readonly signal: NodeJS.Signals | null;
    readonly timedOut: boolean;
  };
  readonly stdout: RedExecutionStream;
  readonly stderr: RedExecutionStream;
  readonly expectedOutputMatched: boolean;
}

export async function executeNoShellCommand(input: {
  readonly projectRoot: string;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly timeoutMs: number;
  readonly expectedOutput?: string;
}): Promise<NoShellExecutionResult> {
  const cwd = containedWorkingDirectory(input.projectRoot, input.cwd);
  const executable = input.argv[0];
  if (executable === undefined) throw new Error('Proof argv must name an executable');
  const started = Date.now();
  const stdout = new StreamEvidence(input.expectedOutput);
  const stderr = new StreamEvidence(input.expectedOutput);
  const environment = proofEnvironment();
  const termination = await new Promise<{
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    timedOut: boolean;
  }>((resolve, reject) => {
    let timedOut = false;
    const child = spawn(executable, input.argv.slice(1), {
      cwd,
      detached: process.platform !== 'win32',
      env: environment,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    child.stdout.on('data', (chunk: Buffer) => {
      stdout.add(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr.add(chunk);
    });
    const clearTimers = (): void => {
      clearTimeout(timer);
    };
    child.once('error', (error: Error) => {
      clearTimers();
      reject(error);
    });
    const timer = setTimeout(() => {
      timedOut = true;
      terminateProofTree(child);
    }, input.timeoutMs);
    child.once('close', (exitCode, signal) => {
      clearTimers();
      if (!timedOut) terminateProofTree(child);
      resolve({ exitCode, signal, timedOut });
    });
  });
  const finished = Date.now();
  const stdoutEvidence = stdout.finish();
  const stderrEvidence = stderr.finish();
  return {
    argv: [...input.argv],
    cwd: input.cwd,
    environment: environmentIdentity(environment),
    startedAt: new Date(started).toISOString(),
    finishedAt: new Date(finished).toISOString(),
    durationMs: finished - started,
    termination,
    stdout: stdoutEvidence,
    stderr: stderrEvidence,
    expectedOutputMatched: stdout.matched || stderr.matched,
  };
}

export async function executeRedProof(input: {
  readonly projectRoot: string;
  readonly request: RedExecutionRequest;
  readonly sourceFingerprint: string;
}): Promise<RedExecutionAttestation> {
  const observation = await executeNoShellCommand({
    projectRoot: input.projectRoot,
    argv: input.request.argv,
    cwd: input.request.cwd,
    timeoutMs: input.request.timeoutMs,
    expectedOutput: input.request.expectedFailure,
  });
  return {
    schema_version: 1,
    argv: [...observation.argv],
    cwd: observation.cwd,
    evidence_class: input.request.evidenceClass,
    expected_failure: {
      literal: input.request.expectedFailure,
      matched: observation.expectedOutputMatched,
    },
    timeout_ms: input.request.timeoutMs,
    source_fingerprint: input.sourceFingerprint,
    environment: observation.environment,
    started_at: observation.startedAt,
    finished_at: observation.finishedAt,
    duration_ms: observation.durationMs,
    termination: {
      exit_code: observation.termination.exitCode,
      signal: observation.termination.signal,
      timed_out: observation.termination.timedOut,
    },
    stdout: observation.stdout,
    stderr: observation.stderr,
  };
}
