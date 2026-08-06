import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { publicHandler } from '../../src/cli-protocol/public-handlers.js';
import {
  invalidatePullRequestCommand,
  publishPullRequestCommand,
} from '../../src/commands/review-pr-publication.js';
import { RECEIPT_MARKER } from '../../src/pr-review/publish.js';

describe('review-pr publication command wiring', () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories) rmSync(directory, { force: true, recursive: true });
    vi.unstubAllGlobals();
  });

  it('publishes a current result through ordinary issue-comment collaborators only', async () => {
    const cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-publish-'));
    directories.push(cwd);
    const resultPath = nodePath.join(cwd, 'result.json');
    writeFileSync(
      resultPath,
      JSON.stringify({
        inspectionAudit: {
          checkout: false,
          customerCodeExecution: false,
          githubPermissions: { contents: 'read', pullRequests: 'read' },
          githubWriteCredential: false,
        },
        kind: 'receipt',
        receipt: {
          coverage: [{ path: 'src/change.ts', status: 'integrity_reviewed' }],
          findings: [],
          missingEvidence: [],
          reviewableTextArtifacts: 1,
          reviewedSha: 'a'.repeat(40),
          route: 'looks_ready',
          runState: 'complete',
          unknowns: [],
        },
        schemaVersion: 1,
      }),
    );
    const createComment = vi.fn().mockResolvedValue(undefined);
    const boundary = {
      publisher: {
        createComment,
        deleteComment: vi.fn().mockResolvedValue(undefined),
        listComments: vi.fn().mockResolvedValue([]),
        updateComment: vi.fn().mockResolvedValue(undefined),
      },
      readPullRequest: vi
        .fn()
        .mockResolvedValue({ headSha: 'a'.repeat(40), state: 'ready' as const }),
    };

    await publishPullRequestCommand(boundary, resultPath);

    expect(createComment).toHaveBeenCalledOnce();
    expect(createComment.mock.calls[0]?.[0]).toContain(RECEIPT_MARKER);
    expect(createComment.mock.calls[0]?.[0]).toContain('Route: looks ready');
    expect(createComment.mock.calls[0]?.[0]).toContain('does not replace human review');
    expect(createComment.mock.calls[0]?.[0]).toContain(
      'not evidence that this pull request is safe to merge',
    );
  });

  it('rewrites an existing receipt on a draft transition without creating one', async () => {
    const updateComment = vi.fn().mockResolvedValue(undefined);
    const createComment = vi.fn().mockResolvedValue(undefined);
    const boundary = {
      publisher: {
        createComment,
        deleteComment: vi.fn().mockResolvedValue(undefined),
        listComments: vi.fn().mockResolvedValue([
          {
            authorType: 'Bot' as const,
            body: `${RECEIPT_MARKER}\nold`,
            createdAt: '2026-01-01T00:00:00Z',
            id: 7,
          },
        ]),
        updateComment,
      },
      readPullRequest: vi
        .fn()
        .mockResolvedValue({ headSha: 'b'.repeat(40), state: 'draft' as const }),
    };

    await invalidatePullRequestCommand(boundary);

    expect(updateComment).toHaveBeenCalledOnce();
    expect(updateComment.mock.calls[0]?.[1]).toContain('not ready (draft)');
    expect(updateComment.mock.calls[0]?.[1]).not.toContain('Route:');
    expect(createComment).not.toHaveBeenCalled();
  });

  it('publishes through the public handler and real GitHub boundary', async () => {
    const cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-publication-handler-'));
    directories.push(cwd);
    const resultPath = nodePath.join(cwd, 'result.json');
    writeFileSync(
      resultPath,
      JSON.stringify({
        inspectionAudit: {
          checkout: false,
          customerCodeExecution: false,
          githubPermissions: { contents: 'read', pullRequests: 'read' },
          githubWriteCredential: false,
        },
        kind: 'receipt',
        receipt: {
          coverage: [{ path: 'src/change.ts', status: 'integrity_reviewed' }],
          findings: [],
          missingEvidence: [],
          reviewableTextArtifacts: 1,
          reviewedSha: 'f'.repeat(40),
          route: 'looks_ready',
          runState: 'complete',
          unknowns: [],
        },
        schemaVersion: 1,
      }),
    );
    const original = {
      GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      SAFEWORD_PR_NUMBER: process.env.SAFEWORD_PR_NUMBER,
    };
    process.env.GITHUB_REPOSITORY = 'acme/repo';
    process.env.GITHUB_TOKEN = `ghs_${'a'.repeat(36)}`;
    process.env.SAFEWORD_PR_NUMBER = '42';
    const requests: string[] = [];
    vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
      requests.push(`${init?.method ?? 'GET'} ${input}`);
      if (input.endsWith('/pulls/42')) {
        return Promise.resolve(Response.json({ draft: false, head: { sha: 'f'.repeat(40) } }));
      }
      if (input.includes('/issues/42/comments')) return Promise.resolve(Response.json([]));
      return Promise.resolve(Response.json({}, { status: 201 }));
    });

    try {
      const result = await publicHandler('review-pr publish')({
        cwd,
        noInput: true,
        offline: false,
        operands: [resultPath],
        options: {},
      });

      expect(result.state).toBe('changed');
      expect(requests.some(request => request.startsWith('POST '))).toBe(true);
    } finally {
      if (original.GITHUB_REPOSITORY === undefined) delete process.env.GITHUB_REPOSITORY;
      else process.env.GITHUB_REPOSITORY = original.GITHUB_REPOSITORY;
      if (original.GITHUB_TOKEN === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = original.GITHUB_TOKEN;
      if (original.SAFEWORD_PR_NUMBER === undefined) delete process.env.SAFEWORD_PR_NUMBER;
      else process.env.SAFEWORD_PR_NUMBER = original.SAFEWORD_PR_NUMBER;
    }
  });
});
