import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import nodePath from 'node:path';

import type {
  RedExecutionAttestation,
  RedExecutionRequest,
  RedExecutionStream,
} from './contract.js';

const MAX_EXCERPT_BYTES = 64 * 1024;

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

function environmentIdentity(): RedExecutionAttestation['environment'] {
  const entries = Object.entries(process.env).toSorted(([left], [right]) =>
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

  constructor(private readonly expected: string) {}

  add(chunk: Buffer): void {
    this.#hash.update(chunk);
    this.#bytes += chunk.length;
    if (this.#retained < MAX_EXCERPT_BYTES) {
      const retained = chunk.subarray(0, MAX_EXCERPT_BYTES - this.#retained);
      this.#chunks.push(retained);
      this.#retained += retained.length;
    }
    if (!this.#matched) {
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

export async function executeRedProof(input: {
  readonly projectRoot: string;
  readonly request: RedExecutionRequest;
  readonly sourceFingerprint: string;
}): Promise<RedExecutionAttestation> {
  const cwd = containedWorkingDirectory(input.projectRoot, input.request.cwd);
  const started = Date.now();
  const stdout = new StreamEvidence(input.request.expectedFailure);
  const stderr = new StreamEvidence(input.request.expectedFailure);
  const termination = await new Promise<{
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    timedOut: boolean;
  }>((resolve, reject) => {
    let timedOut = false;
    const child = spawn(input.request.argv[0], input.request.argv.slice(1), {
      cwd,
      env: process.env,
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
    child.once('error', reject);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, input.request.timeoutMs);
    child.once('close', (exitCode, signal) => {
      clearTimeout(timer);
      resolve({ exitCode, signal, timedOut });
    });
  });
  const finished = Date.now();
  const stdoutEvidence = stdout.finish();
  const stderrEvidence = stderr.finish();
  return {
    schema_version: 1,
    argv: [...input.request.argv],
    cwd: input.request.cwd,
    evidence_class: input.request.evidenceClass,
    expected_failure: {
      literal: input.request.expectedFailure,
      matched: stdout.matched || stderr.matched,
    },
    source_fingerprint: input.sourceFingerprint,
    environment: environmentIdentity(),
    started_at: new Date(started).toISOString(),
    finished_at: new Date(finished).toISOString(),
    duration_ms: finished - started,
    termination: {
      exit_code: termination.exitCode,
      signal: termination.signal,
      timed_out: termination.timedOut,
    },
    stdout: stdoutEvidence,
    stderr: stderrEvidence,
  };
}
