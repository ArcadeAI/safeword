import { lstatSync, realpathSync, statSync } from 'node:fs';
import nodePath from 'node:path';
import readline from 'node:readline';

import type { ReviewKind } from '../review/contract.js';
import { hasIndependentVerdict, reviewJobStatus, startReviewJob } from '../review/job.js';
import { REVIEW_LOGIN_HTML, REVIEW_LOGIN_URI } from './review-login-ui.js';
import { requestBrowserOpen } from './reviewer-browser.js';
import {
  cancelAllReviewerLogins,
  cancelReviewerLogin,
  capturedReviewerLogin,
  reviewerLoginOutcome,
  startReviewerLogin,
} from './reviewer-login.js';

const REVIEW_KINDS = new Set<ReviewKind>([
  'quality-review',
  'scenario-gate',
  'plan-implementation',
]);

const automaticLogins = new Set<string>();

function rememberAutomaticLogin(key: string): void {
  automaticLogins.add(key);
  if (automaticLogins.size > 100) {
    const [oldest] = automaticLogins;
    if (oldest !== undefined) automaticLogins.delete(oldest);
  }
}

function authenticationRecovery(
  root: string,
  id: string,
  data: unknown,
): ReturnType<typeof reviewerLoginOutcome> {
  const key = `${root}:${id}`;
  if (!automaticLogins.has(key)) return undefined;
  // A linked attempt is authoritative even if cancellation raced with its launch.
  if (isRecord(data) && data.review_id !== id) return undefined;
  return reviewerLoginOutcome(key);
}

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

function projectRootDirectory(value: string): string {
  if (!nodePath.isAbsolute(value) || lstatSync(value).isSymbolicLink()) {
    throw new Error('project_root must be an absolute Safeword project directory, not a symlink');
  }
  const root = realpathSync(value);
  if (
    !statSync(root).isDirectory() ||
    !lstatSync(nodePath.join(root, '.safeword', 'config.json')).isFile()
  ) {
    throw new Error('project_root must contain a regular .safeword/config.json project marker');
  }
  return root;
}

/** Codex currently prints four or five characters before the hyphen. */
export function isCodexDeviceCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z\d]{4,5}-[A-Z\d]{4,5}$/u.test(value);
}

function requireRegularFiles(cwd: string, files: readonly string[]): void {
  for (const target of files) {
    if (!lstatSync(nodePath.resolve(cwd, target)).isFile()) {
      throw new Error(`Review target is not a regular file: ${target}`);
    }
  }
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
  const cwd = projectRootDirectory(projectRoot);
  requireRegularFiles(cwd, [...targets, ...context]);
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
  const root = projectRootDirectory(args.project_root);
  const result = reviewJobStatus(root, args.review_id, true);
  const data = result.data;
  const independent = hasIndependentVerdict(isRecord(data) ? data : undefined);
  return textResult({
    review_id: args.review_id,
    status: isRecord(data) && typeof data.status === 'string' ? data.status : result.state,
    independent,
    authentication_recovery: authenticationRecovery(root, args.review_id, data),
    result,
  });
}

// The signed review, reviewer, URL, and optional device code are checked together.
// eslint-disable-next-line complexity -- All authentication fields must be validated together.
function showReviewerLogin(args: unknown): Record<string, unknown> {
  if (
    !isRecord(args) ||
    typeof args.project_root !== 'string' ||
    !nodePath.isAbsolute(args.project_root) ||
    typeof args.review_id !== 'string' ||
    typeof args.auth_url !== 'string'
  ) {
    throw new Error('project_root, review_id, and auth_url are required');
  }
  const root = projectRootDirectory(args.project_root);
  const result = reviewJobStatus(root, args.review_id, true);
  const reviewer = isRecord(result.data) ? result.data.assigned_reviewer : undefined;
  if (
    result.findings.every(finding => finding.code !== 'REVIEW_AUTHENTICATION_REQUIRED') ||
    (reviewer !== 'claude' && reviewer !== 'codex')
  ) {
    throw new Error('The review is not waiting for Claude or Codex authentication');
  }
  const url = new URL(args.auth_url);
  const allowedHosts =
    reviewer === 'claude'
      ? new Set(['claude.com', 'platform.claude.com'])
      : new Set(['auth.openai.com', 'chatgpt.com']);
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname) || url.href.length > 8000) {
    throw new Error('auth_url must be an HTTPS sign-in URL for the assigned reviewer');
  }
  const deviceCode = args.device_code;
  if (deviceCode !== undefined && (reviewer !== 'codex' || !isCodexDeviceCode(deviceCode))) {
    throw new Error('device_code must be a Codex device sign-in code');
  }
  const captured = capturedReviewerLogin(`${root}:${args.review_id}`);
  if (captured?.auth_url !== url.href || captured.device_code !== deviceCode) {
    throw new Error('Sign-in details do not match this review’s reviewer CLI');
  }
  const automatic = isRecord(result.data) && result.data.authentication_continuation === true;
  const value = {
    reviewer,
    auth_url: url.href,
    ...(deviceCode !== undefined && { device_code: deviceCode }),
    browser_launch_requested: false,
    automatic_open_allowed: false,
    ...(automatic && { automatic_resume_allowed: true }),
    message: loginGuidance(reviewer, automatic),
  };
  return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value };
}

function loginGuidance(reviewer: 'claude' | 'codex', automatic: boolean): string {
  if (automatic)
    return 'Complete sign-in. This review resumes automatically after account verification while connected.';
  return reviewer === 'claude'
    ? 'Open the sign-in link and complete the Claude browser sign-in. Retry the same review after sign-in.'
    : 'Open the sign-in link, enter the device code, then retry the same review after sign-in.';
}

function loginLocation(args: unknown): { root: string; id: string } {
  if (
    !isRecord(args) ||
    typeof args.project_root !== 'string' ||
    !nodePath.isAbsolute(args.project_root) ||
    typeof args.review_id !== 'string'
  ) {
    throw new Error('project_root and review_id are required');
  }
  return { root: projectRootDirectory(args.project_root), id: args.review_id };
}

async function launchReviewerLogin(args: unknown): Promise<Record<string, unknown>> {
  const { root, id } = loginLocation(args);
  const status = reviewJobStatus(root, id, true);
  const reviewer = isRecord(status.data) ? status.data.assigned_reviewer : undefined;
  if (
    status.findings.every(finding => finding.code !== 'REVIEW_AUTHENTICATION_REQUIRED') ||
    (reviewer !== 'claude' && reviewer !== 'codex')
  ) {
    throw new Error('The review is not waiting for Claude or Codex authentication');
  }
  const reviewKey = `${root}:${id}`;
  const { login, release } = await startBoundReviewerLogin(root, id, reviewer, status.data);
  try {
    const validated = showReviewerLogin({
      project_root: root,
      review_id: id,
      ...login,
    });
    const browserLaunchRequested = await requestBrowserOpen(login.auth_url);
    release?.(true);
    const value = {
      ...(validated.structuredContent as Record<string, unknown>),
      browser_launch_requested: browserLaunchRequested,
      automatic_open_allowed: true,
    };
    return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value };
  } catch (error) {
    release?.(false);
    cancelReviewerLogin(reviewKey);
    throw error;
  }
}

async function startBoundReviewerLogin(
  root: string,
  id: string,
  reviewer: 'claude' | 'codex',
  data: unknown,
) {
  const key = `${root}:${id}`;
  if (!isRecord(data) || data.authentication_continuation !== true)
    return { login: await startReviewerLogin(key, reviewer, root), release: undefined };
  const recovery = await loginContinuation(root, id, reviewer);
  const login = await startReviewerLogin(key, reviewer, root, recovery.options);
  rememberAutomaticLogin(key);
  return { login, release: recovery.release };
}

async function loginContinuation(root: string, id: string, reviewer: 'claude' | 'codex') {
  const { assertReviewAuthenticationContext, resumeReviewAfterAuthentication } =
    await import('../review/job.js');
  const { promise: displayed, resolve: release } = Promise.withResolvers<boolean>();
  return {
    release,
    options: {
      validateContext: (context: Parameters<typeof assertReviewAuthenticationContext>[3]) => {
        assertReviewAuthenticationContext(root, id, reviewer, context);
      },
      onAuthenticated: async (signal: AbortSignal) => {
        if (!(await displayed)) throw new Error('Sign-in details could not be displayed.');
        signal.throwIfAborted();
        await resumeReviewAfterAuthentication(root, id, reviewer, signal);
      },
    },
  };
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
  {
    name: 'start_reviewer_login',
    description:
      'After REVIEW_AUTHENTICATION_REQUIRED, start the assigned reviewer sign-in and show its URL and optional code. Eligible reviews resume once after verified sign-in while connected. Keep polling the original review ID; use result.data.review_id for the resulting receipt.',
    annotations: { readOnlyHint: false, openWorldHint: true },
    _meta: { ui: { resourceUri: REVIEW_LOGIN_URI } },
    inputSchema: {
      type: 'object',
      properties: {
        project_root: { type: 'string', description: 'Absolute project directory' },
        review_id: { type: 'string' },
      },
      required: ['project_root', 'review_id'],
    },
  },
  {
    name: 'show_reviewer_login',
    description:
      'Redisplay captured sign-in details for this review. Eligible reviews resume once after verified sign-in while connected; older receipts require manual retry.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: REVIEW_LOGIN_URI } },
    inputSchema: {
      type: 'object',
      properties: {
        project_root: { type: 'string', description: 'Absolute project directory' },
        review_id: { type: 'string' },
        auth_url: {
          type: 'string',
          description: 'Exact HTTPS URL printed by the reviewer login CLI',
        },
        device_code: {
          type: 'string',
          description: 'Codex device code, when printed by codex login --device-auth',
        },
      },
      required: ['project_root', 'review_id', 'auth_url'],
    },
  },
] as const;

async function callTool(name: unknown, args: unknown): Promise<Record<string, unknown>> {
  if (name === 'start_review') return startReview(args);
  if (name === 'review_status') return reviewStatus(args);
  if (name === 'start_reviewer_login') return launchReviewerLogin(args);
  if (name === 'show_reviewer_login') return showReviewerLogin(args);
  return textResult({ error: 'Unknown tool' }, true);
}

// MCP dispatch has one branch for each protocol method and its validation path.
// eslint-disable-next-line complexity -- MCP method dispatch covers the complete server surface.
export async function handleReviewMcpRequest(request: unknown): Promise<unknown> {
  if (!isRecord(request) || !('id' in request)) return undefined;
  const id = request.id;
  const method = request.method;
  let result: unknown;
  try {
    // Protocol methods are intentionally checked in order because resources/read has a parameter guard.
    // eslint-disable-next-line unicorn/prefer-switch -- resources/read needs a parameter guard.
    if (method === 'initialize') {
      result = {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: 'safeword-review', version: '1' },
      };
    } else if (method === 'tools/list') {
      result = { tools };
    } else if (method === 'resources/list') {
      result = {
        resources: [
          {
            uri: REVIEW_LOGIN_URI,
            name: 'Reviewer sign-in',
            mimeType: 'text/html;profile=mcp-app',
          },
        ],
      };
    } else if (
      method === 'resources/read' &&
      isRecord(request.params) &&
      request.params.uri === REVIEW_LOGIN_URI
    ) {
      result = {
        contents: [
          { uri: REVIEW_LOGIN_URI, mimeType: 'text/html;profile=mcp-app', text: REVIEW_LOGIN_HTML },
        ],
      };
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

export async function runReviewMcpServer(hostFlag: string | undefined): Promise<void> {
  if (hostFlag !== '--claude' && hostFlag !== '--codex') {
    throw new Error('Review MCP must be started by a plugin manifest with an explicit host flag');
  }
  process.env.SAFEWORD_AGENT_RUNTIME = hostFlag === '--claude' ? 'claude' : 'codex';
  process.env.SAFEWORD_REVIEW_FOREGROUND_MS = '0';
  const input = readline.createInterface({ input: process.stdin });
  const shutdown = (): void => {
    cancelAllReviewerLogins();
    input.close();
    process.stdin.destroy();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  input.once('close', cancelAllReviewerLogins);
  try {
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
  } finally {
    cancelAllReviewerLogins();
    input.close();
    process.off('SIGTERM', shutdown);
    process.off('SIGINT', shutdown);
  }
}

if (import.meta.main) await runReviewMcpServer(process.argv.at(-1));
