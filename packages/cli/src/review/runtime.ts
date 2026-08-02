import { spawn, spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import nodePath from 'node:path';

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

const HELP_ARGUMENTS: Readonly<Record<ReviewAgent, readonly string[]>> = {
  claude: ['--help'],
  codex: ['exec', '--help'],
};

const REQUIRED_CAPABILITIES: Readonly<Record<ReviewAgent, readonly string[]>> = {
  claude: ['--output-format', '--no-session-persistence', '--disable-slash-commands', '--tools'],
  codex: ['--json', '--sandbox', '--skip-git-repo-check', '--ephemeral', '--ignore-rules'],
};

const MAX_OUTPUT_BYTES = 1024 * 1024;

const REVIEW_RUBRICS: Readonly<Record<ReviewPacket['kind'], string>> = {
  'quality-review':
    'Check correctness, edge cases, security, unnecessary complexity, and whether public wiring is proven through real collaborators.',
  'scenario-gate':
    'Try to falsify every scenario. Check vacuous passes, atomic/observable/deterministic/independent structure, negative cases, boundaries, failures, security, invariants, and public-surface wiring.',
  'plan-implementation':
    'Try to refute the plan. Check wrong-direction design, missed scenarios, proof strategy, build order, architecture alignment, reversibility, and text removable without information loss.',
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
    REVIEW_RUBRICS[packet.kind],
    'Keep schema_version and dispatch_id unchanged; set reviewer_agent to your actual agent.',
    'Use verdict approve or request_changes. Include summary and findings.',
    JSON.stringify(packet),
  ].join('\n');
}

function executableCandidates(reviewer: ReviewAgent): string[] {
  const candidates = (process.env.PATH ?? '')
    .split(nodePath.delimiter)
    .filter(directory => directory !== '')
    .map(directory => nodePath.join(directory, reviewer));
  return [...new Set(candidates)].filter(candidate => {
    try {
      accessSync(candidate, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

function supportsReviewContract(reviewer: ReviewAgent, executable: string): boolean {
  const checked = spawnSync(executable, HELP_ARGUMENTS[reviewer], {
    encoding: 'utf8',
    env: reviewerEnvironment(reviewer),
    timeout: 5000,
  });
  const help = `${checked.stdout ?? ''}\n${checked.stderr ?? ''}`;
  return checked.status === 0 && REQUIRED_CAPABILITIES[reviewer].every(flag => help.includes(flag));
}

function appendBounded(current: string, chunk: string): { value: string; overflow: boolean } {
  const value = current + chunk;
  return { value, overflow: Buffer.byteLength(value) > MAX_OUTPUT_BYTES };
}

function runCandidate(
  executable: string,
  reviewer: ReviewAgent,
  packet: ReviewPacket,
  cwd: string,
): Promise<ReviewerOutput> {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    let overflow = false;
    const child = spawn(executable, ARGUMENTS[reviewer], {
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
      const appended = appendBounded(stdout, chunk);
      stdout = appended.value;
      overflow ||= appended.overflow;
      if (overflow) child.kill('SIGKILL');
    });
    child.stderr.on('data', (chunk: string) => {
      const appended = appendBounded(stderr, chunk);
      stderr = appended.value;
      overflow ||= appended.overflow;
      if (overflow) child.kill('SIGKILL');
    });
    child.on('error', error => {
      clearTimeout(timeout);
      reject(new ReviewRuntimeError('process_failed', error.message));
    });
    child.on('close', code => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new ReviewRuntimeError('timed_out', `${reviewer} review timed out`));
        return;
      }
      if (overflow) {
        reject(new ReviewRuntimeError('invalid_output', `${reviewer} exceeded its output limit`));
        return;
      }
      if (code !== 0) {
        const failure =
          /not logged in|sign in|authentication|unauthorized|login required|api key/iu.test(stderr)
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

export async function runHeadlessReviewer(
  reviewer: ReviewAgent,
  packet: ReviewPacket,
  cwd: string,
): Promise<ReviewerOutput> {
  const candidates = executableCandidates(reviewer).filter(candidate =>
    supportsReviewContract(reviewer, candidate),
  );
  if (candidates.length === 0) {
    throw new ReviewRuntimeError(
      'not_installed',
      `No compatible ${reviewer} reviewer is installed`,
    );
  }
  let lastFailure: ReviewRuntimeError | undefined;
  for (const candidate of candidates) {
    try {
      return await runCandidate(candidate, reviewer, packet, cwd);
    } catch (error) {
      if (!(error instanceof ReviewRuntimeError)) throw error;
      lastFailure = error;
      if (error.failure !== 'process_failed' && error.failure !== 'invalid_output') throw error;
    }
  }
  throw lastFailure ?? new ReviewRuntimeError('process_failed', `${reviewer} review failed`);
}
