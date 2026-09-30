import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleReviewMcpRequest } from '../../src/codex-plugin/review-mcp.js';
import { requestBrowserOpen } from '../../src/codex-plugin/reviewer-browser.js';
import {
  cancelReviewerLogin,
  capturedReviewerLogin,
  startReviewerLogin,
} from '../../src/codex-plugin/reviewer-login.js';
import { reviewJobStatus } from '../../src/review/job.js';

vi.mock('../../src/review/job.js', () => ({
  hasIndependentVerdict: vi.fn(() => false),
  reviewJobStatus: vi.fn(),
  startReviewJob: vi.fn(),
}));
vi.mock('../../src/codex-plugin/reviewer-login.js', () => ({
  cancelReviewerLogin: vi.fn(),
  capturedReviewerLogin: vi.fn(),
  startReviewerLogin: vi.fn(),
}));
vi.mock('../../src/codex-plugin/reviewer-browser.js', () => ({
  requestBrowserOpen: vi.fn(),
}));

const roots: string[] = [];
function project(): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-login-mcp-'));
  roots.push(root);
  mkdirSync(nodePath.join(root, '.safeword'));
  writeFileSync(nodePath.join(root, '.safeword', 'config.json'), '{}');
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  vi.clearAllMocks();
});

async function loginTool(
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = (await handleReviewMcpRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name, arguments: args },
  })) as { result: Record<string, unknown> };
  return response.result;
}

describe('reviewer sign-in MCP wiring', () => {
  it('stops a launched login if the review is no longer auth-blocked at display time', async () => {
    const root = project();
    vi.mocked(reviewJobStatus)
      .mockReturnValueOnce({
        findings: [{ code: 'REVIEW_AUTHENTICATION_REQUIRED' }],
        data: { assigned_reviewer: 'claude' },
      } as unknown as ReturnType<typeof reviewJobStatus>)
      .mockReturnValueOnce({
        findings: [],
        data: { assigned_reviewer: 'claude' },
      } as unknown as ReturnType<typeof reviewJobStatus>);
    vi.mocked(startReviewerLogin).mockResolvedValue({ auth_url: 'https://claude.com/login' });
    const result = await loginTool('start_reviewer_login', {
      project_root: root,
      review_id: 'review',
    });
    expect(result.isError).toBe(true);
    expect(cancelReviewerLogin).toHaveBeenCalledWith(`${realpathSync(root)}:review`);
    expect(requestBrowserOpen).not.toHaveBeenCalled();
  });

  it('does not open a browser when the reviewer CLI supplies no allowed sign-in URL', async () => {
    const root = project();
    vi.mocked(reviewJobStatus).mockReturnValue({
      findings: [{ code: 'REVIEW_AUTHENTICATION_REQUIRED' }],
      data: { assigned_reviewer: 'claude' },
    } as unknown as ReturnType<typeof reviewJobStatus>);
    vi.mocked(startReviewerLogin).mockRejectedValue(
      new Error('Reviewer login did not print an official sign-in URL'),
    );
    const result = await loginTool('start_reviewer_login', {
      project_root: root,
      review_id: 'review',
    });
    expect(result.isError).toBe(true);
    expect(requestBrowserOpen).not.toHaveBeenCalled();
    expect(result.structuredContent).toBeUndefined();
  });
  it('rejects unmarked and symlinked project roots before launching a login', async () => {
    const unmarked = mkdtempSync(nodePath.join(tmpdir(), 'safeword-unmarked-'));
    roots.push(unmarked);
    const marked = project();
    const alias = `${marked}-alias`;
    symlinkSync(marked, alias);
    roots.push(alias);
    for (const root of [unmarked, alias]) {
      const result = await loginTool('start_reviewer_login', {
        project_root: root,
        review_id: 'review',
      });
      expect(result.isError).toBe(true);
    }
    expect(startReviewerLogin).not.toHaveBeenCalled();
  });
  it('keeps the authentication-required finding visible in review status', async () => {
    const root = project();
    vi.mocked(reviewJobStatus).mockReturnValue({
      state: 'action_required',
      findings: [{ code: 'REVIEW_AUTHENTICATION_REQUIRED' }],
      data: { status: 'blocked', assigned_reviewer: 'claude' },
    } as unknown as ReturnType<typeof reviewJobStatus>);
    const status = await loginTool('review_status', {
      project_root: root,
      review_id: 'signed-review',
    });
    const content = status.content as { text: string }[];
    const payload = JSON.parse(content[0]?.text ?? '{}') as Record<string, unknown>;
    expect(payload.independent).toBe(false);
    expect(JSON.stringify(payload.result)).toContain('REVIEW_AUTHENTICATION_REQUIRED');
    expect(JSON.stringify(payload.result)).toContain('claude');
  });

  it.each([
    ['claude', 'https://claude.com/cai/oauth/authorize?state=abc', undefined],
    ['codex', 'https://auth.openai.com/codex/device', '5T5I-3IZNL'],
  ] as const)(
    'launches only the assigned %s reviewer and returns its exact sign-in data',
    async (reviewer, url, code) => {
      const root = project();
      const canonicalRoot = realpathSync(root);
      vi.mocked(reviewJobStatus).mockReturnValue({
        findings: [{ code: 'REVIEW_AUTHENTICATION_REQUIRED' }],
        data: { assigned_reviewer: reviewer },
      } as unknown as ReturnType<typeof reviewJobStatus>);
      vi.mocked(startReviewerLogin).mockResolvedValue({
        auth_url: url,
        ...(code && { device_code: code }),
      });
      vi.mocked(capturedReviewerLogin).mockReturnValue({
        auth_url: url,
        ...(code && { device_code: code }),
      });
      vi.mocked(requestBrowserOpen).mockResolvedValue(true);
      const result = await loginTool('start_reviewer_login', {
        project_root: root,
        review_id: 'signed-review',
      });
      expect(startReviewerLogin).toHaveBeenCalledWith(
        `${canonicalRoot}:signed-review`,
        reviewer,
        canonicalRoot,
      );
      expect(result.structuredContent).toMatchObject({
        reviewer,
        auth_url: url,
        browser_launch_requested: true,
        automatic_open_allowed: true,
        ...(code && { device_code: code }),
      });
      expect(requestBrowserOpen).toHaveBeenCalledWith(url);
      expect(JSON.stringify(result.content)).toContain(url);
      expect(result.isError).toBeUndefined();
      const displayed = await loginTool('show_reviewer_login', {
        project_root: root,
        review_id: 'signed-review',
        auth_url: url,
        ...(code && { device_code: code }),
      });
      expect(displayed.structuredContent).toMatchObject({
        reviewer,
        auth_url: url,
        automatic_open_allowed: false,
      });
    },
  );

  it('rejects invalid URLs and reviews without an authentication gap before launching a CLI', async () => {
    const root = project();
    vi.mocked(reviewJobStatus).mockReturnValue({
      findings: [{ code: 'REVIEW_AUTHENTICATION_REQUIRED' }],
      data: { assigned_reviewer: 'claude' },
    } as unknown as ReturnType<typeof reviewJobStatus>);
    vi.mocked(capturedReviewerLogin).mockReturnValue({ auth_url: 'https://claude.com/login' });
    const insecure = new URL('https://claude.com/login');
    insecure.protocol = 'http:';
    for (const auth_url of [
      insecure.href,
      'https://evil.example/login',
      'https://claude.com/other-login',
    ]) {
      const result = await loginTool('show_reviewer_login', {
        project_root: root,
        review_id: 'signed-review',
        auth_url,
      });
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toBeUndefined();
    }
    vi.mocked(capturedReviewerLogin).mockReturnValue(undefined);
    const invented = await loginTool('show_reviewer_login', {
      project_root: root,
      review_id: 'signed-review',
      auth_url: 'https://claude.com/login',
    });
    expect(invented.isError).toBe(true);
    expect(invented.structuredContent).toBeUndefined();
    vi.mocked(reviewJobStatus).mockReturnValue({
      findings: [],
      data: { assigned_reviewer: 'claude' },
    } as unknown as ReturnType<typeof reviewJobStatus>);
    const result = await loginTool('start_reviewer_login', {
      project_root: root,
      review_id: 'not-auth-required',
    });
    expect(result.isError).toBe(true);
    expect(startReviewerLogin).not.toHaveBeenCalled();
  });
});
