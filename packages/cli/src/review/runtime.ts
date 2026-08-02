import { spawn } from 'node:child_process';

import type { ReviewAgent, ReviewerOutput, ReviewFailure, ReviewPacket } from './contract.js';
import { reviewerEnvironment } from './environment.js';

const ARGUMENTS: Readonly<Record<ReviewAgent, readonly string[]>> = {
  claude: [
    '-p',
    '--output-format',
    'json',
    '--no-session-persistence',
    '--disable-slash-commands',
    '--tools',
    '',
  ],
  codex: [
    'exec',
    '--json',
    '--sandbox',
    'read-only',
    '--skip-git-repo-check',
    '--ephemeral',
    '--ignore-rules',
    '-',
  ],
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function parseClaudeOutput(stdout: string): unknown {
  const envelope = parseJson(stdout);
  if (isRecord(envelope) && typeof envelope.result === 'string') {
    return parseJson(envelope.result);
  }
  return envelope;
}

function parseCodexOutput(stdout: string): unknown {
  const events = stdout
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => parseJson(line));
  const message = events.findLast(
    event =>
      isRecord(event) &&
      event.type === 'item.completed' &&
      isRecord(event.item) &&
      event.item.type === 'agent_message' &&
      typeof event.item.text === 'string',
  );
  if (isRecord(message) && isRecord(message.item) && typeof message.item.text === 'string') {
    return parseJson(message.item.text);
  }
  return parseJson(stdout);
}

export function parseReviewerOutput(reviewer: ReviewAgent, stdout: string): ReviewerOutput {
  return (
    reviewer === 'claude' ? parseClaudeOutput(stdout) : parseCodexOutput(stdout)
  ) as ReviewerOutput;
}

function reviewPrompt(packet: ReviewPacket): string {
  return [
    'Act as an adversarial reviewer. Review only the bounded files in this packet.',
    'Do not use tools or modify files. Return only one JSON object matching the packet result contract.',
    'Keep schema_version and dispatch_id unchanged; set reviewer_agent to your actual agent.',
    'Use verdict approve or request_changes. Include summary and findings.',
    JSON.stringify(packet),
  ].join('\n');
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
        resolve(parseReviewerOutput(reviewer, stdout));
      } catch {
        reject(
          new ReviewRuntimeError('invalid_output', `${reviewer} returned invalid review output`),
        );
      }
    });
    child.stdin.end(reviewPrompt(packet));
  });
}
