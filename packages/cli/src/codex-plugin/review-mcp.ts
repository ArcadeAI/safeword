import { realpathSync, statSync } from 'node:fs';
import nodePath from 'node:path';
import readline from 'node:readline';

import type { ReviewKind } from '../review/contract.js';
import { reviewJobStatus, startReviewJob } from '../review/job.js';

const REVIEW_KINDS = new Set<ReviewKind>([
  'quality-review',
  'scenario-gate',
  'plan-implementation',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function paths(value: unknown, label: string): string[] {
  if (
    !Array.isArray(value) ||
    value.some(
      item =>
        typeof item !== 'string' ||
        item.trim() === '' ||
        nodePath.isAbsolute(item) ||
        item.split(/[\\/]/u).includes('..'),
    )
  ) {
    throw new Error(`${label} must contain project-relative file paths`);
  }
  return value as string[];
}

function textResult(value: unknown, isError = false): Record<string, unknown> {
  return { content: [{ type: 'text', text: JSON.stringify(value) }], ...(isError && { isError }) };
}

function reviewInput(args: unknown): {
  cwd: string;
  kind: ReviewKind;
  targets: string[];
  context: string[];
} {
  if (!isRecord(args)) throw new Error('Review arguments must be an object');
  const { project_root: projectRoot, kind } = args;
  if (typeof projectRoot !== 'string' || !nodePath.isAbsolute(projectRoot)) {
    throw new Error('project_root must be an absolute directory path');
  }
  if (typeof kind !== 'string' || !REVIEW_KINDS.has(kind as ReviewKind)) {
    throw new Error('kind must be quality-review, scenario-gate, or plan-implementation');
  }
  const targets = paths(args.targets, 'targets');
  const context = paths(args.context ?? [], 'context');
  if (targets.length === 0 || targets.length + context.length > 64) {
    throw new Error('Reviews require 1–64 total files');
  }
  const cwd = realpathSync(projectRoot);
  if (!statSync(cwd).isDirectory()) throw new Error('project_root must be a directory');
  return { cwd, kind: kind as ReviewKind, targets, context };
}

async function startReview(args: unknown): Promise<Record<string, unknown>> {
  const input = reviewInput(args);
  const result = await startReviewJob({ ...input, progress: undefined });
  return textResult(result);
}

function reviewStatus(args: unknown): Record<string, unknown> {
  if (
    !isRecord(args) ||
    typeof args.review_id !== 'string' ||
    typeof args.project_root !== 'string' ||
    !nodePath.isAbsolute(args.project_root)
  ) {
    throw new Error('review_id and absolute project_root are required');
  }
  const result = reviewJobStatus(realpathSync(args.project_root), args.review_id);
  const data = result.data;
  const independent =
    isRecord(data) &&
    data.independence === 'cross-agent' &&
    (data.status === 'approved' || data.status === 'changes_requested');
  return textResult({
    review_id: args.review_id,
    status: isRecord(data) && typeof data.status === 'string' ? data.status : result.state,
    independent,
    result,
  });
}

const tools = [
  {
    name: 'start_review',
    description:
      'Start an independent Safeword review of bounded project files. It sends a bounded packet to the configured reviewer and stores a signed receipt under .safeword/state/reviews for workflow verification. Poll review_status until terminal.',
    annotations: { readOnlyHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        project_root: { type: 'string', description: 'Absolute project directory' },
        kind: { type: 'string', enum: [...REVIEW_KINDS] },
        targets: { type: 'array', items: { type: 'string' }, minItems: 1 },
        context: { type: 'array', items: { type: 'string' } },
      },
      required: ['project_root', 'kind', 'targets'],
    },
  },
  {
    name: 'review_status',
    description: 'Get a review result and recheck its signed receipt and source freshness.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        project_root: { type: 'string', description: 'Absolute project directory' },
        review_id: { type: 'string' },
      },
      required: ['project_root', 'review_id'],
    },
  },
] as const;

async function callTool(name: unknown, args: unknown): Promise<Record<string, unknown>> {
  if (name === 'start_review') return startReview(args);
  if (name === 'review_status') return reviewStatus(args);
  return textResult({ error: 'Unknown tool' }, true);
}

export async function handleReviewMcpRequest(request: unknown): Promise<unknown> {
  if (!isRecord(request) || !('id' in request)) return undefined;
  const id = request.id;
  const method = request.method;
  let result: unknown;
  try {
    if (method === 'initialize') {
      result = {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'safeword-review', version: '1' },
      };
    } else if (method === 'tools/list') {
      result = { tools };
    } else if (method === 'tools/call' && isRecord(request.params)) {
      const { name, arguments: args } = request.params;
      result = await callTool(name, args);
    } else {
      return { jsonrpc: '2.0', id, error: { code: -32_601, message: 'Method not found' } };
    }
  } catch (error) {
    result = textResult({ error: error instanceof Error ? error.message : String(error) }, true);
  }
  return { jsonrpc: '2.0', id, result };
}

if (import.meta.main) {
  process.env.SAFEWORD_AGENT_RUNTIME = 'codex';
  process.env.SAFEWORD_REVIEW_FOREGROUND_MS = '0';
  const input = readline.createInterface({ input: process.stdin });
  for await (const line of input) {
    let request: unknown;
    try {
      request = JSON.parse(line) as unknown;
    } catch {
      continue;
    }
    const response = await handleReviewMcpRequest(request);
    if (response !== undefined) process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}
