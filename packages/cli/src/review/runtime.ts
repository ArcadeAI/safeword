import { spawn } from 'node:child_process';

import type { ReviewAgent, ReviewerOutput, ReviewFailure, ReviewPacket } from './contract.js';
import { reviewerEnvironment } from './environment.js';

const ARGUMENTS: Readonly<Record<ReviewAgent, readonly string[]>> = {
  claude: [
    '-p',
    '--output-format',
    'json',
    '--permission-mode',
    'bypassPermissions',
    '--no-session-persistence',
  ],
  codex: ['exec', '--json', '--sandbox', 'read-only', '--skip-git-repo-check', '-'],
};

const ASSIGNED_MODELS: Readonly<Record<ReviewAgent, string>> = {
  claude: 'claude-default',
  codex: 'codex-default',
};

export function assignedReviewerModel(reviewer: ReviewAgent): string {
  return ASSIGNED_MODELS[reviewer];
}

export class ReviewRuntimeError extends Error {
  constructor(
    readonly failure: ReviewFailure,
    message: string,
  ) {
    super(message);
    this.name = 'ReviewRuntimeError';
  }
}

function timeoutMilliseconds(): number {
  const configured = Number(process.env.SAFEWORD_REVIEW_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 120_000;
}

export async function runHeadlessReviewer(
  reviewer: ReviewAgent,
  packet: ReviewPacket,
  cwd: string,
): Promise<ReviewerOutput> {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const child = spawn(reviewer, ARGUMENTS[reviewer], {
      cwd,
      env: reviewerEnvironment(reviewer),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMilliseconds());
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', error => {
      clearTimeout(timeout);
      reject(
        new ReviewRuntimeError(
          (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'not_installed' : 'process_failed',
          error.message,
        ),
      );
    });
    child.on('close', code => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new ReviewRuntimeError('timed_out', `${reviewer} review timed out`));
        return;
      }
      if (code !== 0) {
        const failure = /not logged in|sign in|authentication|unauthorized/iu.test(stderr)
          ? 'not_authenticated'
          : 'process_failed';
        reject(
          new ReviewRuntimeError(
            failure,
            `${reviewer} review failed (${code ?? 'signal'}): ${stderr.trim()}`,
          ),
        );
        return;
      }
      try {
        resolve(JSON.parse(stdout) as ReviewerOutput);
      } catch {
        reject(
          new ReviewRuntimeError('invalid_output', `${reviewer} returned invalid review output`),
        );
      }
    });
    child.stdin.end(JSON.stringify(packet));
  });
}
