import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleReviewMcpRequest, isCodexDeviceCode } from '../../src/codex-plugin/review-mcp.js';
import { hasIndependentVerdict } from '../../src/review/job.js';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    // The fixture contains only files created by this test.
    rmSync(root, { recursive: true, force: true });
  }
});

async function call(id: number, name: string, args: unknown): Promise<Record<string, unknown>> {
  return (await handleReviewMcpRequest({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name, arguments: args },
  })) as Record<string, unknown>;
}

function payload(response: Record<string, unknown>): Record<string, unknown> {
  const result = response.result as { content: { text: string }[] };
  const item = result.content[0];
  if (item === undefined) throw new Error('MCP response has no content');
  return JSON.parse(item.text) as Record<string, unknown>;
}

describe('Codex review MCP boundary', () => {
  it('rejects a project-relative review target that symlinks outside the project', async () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-mcp-target-'));
    const outside = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-mcp-outside-'));
    roots.push(root, outside);
    mkdirSync(nodePath.join(root, '.safeword'));
    writeFileSync(nodePath.join(root, '.safeword', 'config.json'), '{}');
    writeFileSync(nodePath.join(outside, 'secret.md'), 'outside');
    symlinkSync(nodePath.join(outside, 'secret.md'), nodePath.join(root, 'linked.md'));

    const result = payload(
      await call(99, 'start_review', {
        project_root: root,
        kind: 'quality-review',
        targets: ['linked.md'],
      }),
    );

    expect(result).toMatchObject({ error: expect.stringContaining('not a regular file') });
    expect(readdirSync(nodePath.join(root, '.safeword'))).not.toContain('state');
  });

  it('requires a different, matching reviewer identity before claiming independence', () => {
    const verdict = {
      status: 'changes_requested',
      independence: 'cross-agent',
      author_agent: 'codex',
      actual_reviewer: 'claude',
      reviewer_output: { reviewer_agent: 'claude' },
    };
    expect(hasIndependentVerdict(verdict)).toBe(true);
    expect(
      hasIndependentVerdict({
        ...verdict,
        actual_reviewer: 'codex',
        reviewer_output: { reviewer_agent: 'codex' },
      }),
    ).toBe(false);
    expect(hasIndependentVerdict({ ...verdict, status: 'pending' })).toBe(false);
    expect(hasIndependentVerdict({ ...verdict, independence: 'degraded' })).toBe(false);
    expect(hasIndependentVerdict({ ...verdict, actual_reviewer: 'codex' })).toBe(false);
    expect(
      hasIndependentVerdict({ ...verdict, reviewer_output: { reviewer_agent: 'codex' } }),
    ).toBe(false);
  });
  it('accepts the device-code shape printed by the current Codex CLI', () => {
    expect(isCodexDeviceCode('5T5I-3IZNL')).toBe(true);
    expect(isCodexDeviceCode('ABCDE-12345')).toBe(true);
    expect(isCodexDeviceCode('https://auth.openai.com/codex/device')).toBe(false);
    expect(isCodexDeviceCode('5T5I-3IZNL\nopen https://example.com')).toBe(false);
  });

  it('starts the generated plugin server from the packaged manifest', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-mcp-packaged-'));
    roots.push(root);
    mkdirSync(nodePath.join(root, '.safeword'));
    writeFileSync(nodePath.join(root, '.safeword', 'config.json'), '{}');
    const pluginRoot = nodePath.resolve(import.meta.dirname, '../../codex-plugin');
    const manifest = JSON.parse(readFileSync(nodePath.join(pluginRoot, '.mcp.json'), 'utf8')) as {
      mcpServers: { safeword_review: { args: string[]; cwd: string } };
    };
    const server = manifest.mcpServers.safeword_review;
    expect(server.cwd).toBe('.');
    expect(server.args.at(-1)).toBe('--codex');
    const claudeManifest = JSON.parse(
      readFileSync(nodePath.resolve(import.meta.dirname, '../../../../plugin/.mcp.json'), 'utf8'),
    ) as {
      mcpServers: { safeword_review: { args: string[] } };
    };
    expect(claudeManifest.mcpServers.safeword_review.args.at(-1)).toBe('--claude');
    const launched = spawnSync('bun', server.args, {
      cwd: pluginRoot,
      encoding: 'utf8',
      input: `${[
        { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'start_review',
            arguments: { project_root: root, kind: 'executable-red', targets: ['proof.ts'] },
          },
        },
      ]
        .map(request => JSON.stringify(request))
        .join('\n')}\n`,
      timeout: 5000,
    });
    expect(launched.status).toBe(0);
    expect(launched.stderr).toBe('');
    const responses = launched.stdout.trim().split('\n');
    expect(responses).toHaveLength(2);
    const [listResponse, callResponse] = responses;
    if (listResponse === undefined || callResponse === undefined) {
      throw new Error('Packaged MCP server did not answer both requests');
    }
    const response = JSON.parse(listResponse) as {
      result: { tools: { name: string }[] };
    };
    expect(response.result.tools.map(tool => tool.name)).toEqual([
      'start_review',
      'review_status',
      'start_reviewer_login',
      'show_reviewer_login',
    ]);
    expect(payload(JSON.parse(callResponse) as Record<string, unknown>)).toMatchObject({
      error: expect.stringContaining('kind must be'),
    });
    expect(readdirSync(nodePath.join(root, '.safeword'))).not.toContain('state');
  });

  it('exposes bounded review and sign-in display tools, excluding executable RED', async () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-mcp-boundary-'));
    roots.push(root);
    mkdirSync(nodePath.join(root, '.safeword'));
    writeFileSync(nodePath.join(root, '.safeword', 'config.json'), '{}');
    const response = (await handleReviewMcpRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    })) as {
      result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] };
    };
    expect(response.result.tools.map(tool => tool.name)).toEqual([
      'start_review',
      'review_status',
      'start_reviewer_login',
      'show_reviewer_login',
    ]);
    expect(response.result.tools.map(tool => tool.annotations.readOnlyHint)).toEqual([
      false,
      true,
      false,
      true,
    ]);
    const listed = (await handleReviewMcpRequest({
      jsonrpc: '2.0',
      id: 9,
      method: 'resources/list',
    })) as {
      result: { resources: { uri: string }[] };
    };
    const resourceUri = listed.result.resources[0]?.uri;
    expect(resourceUri).toBe('ui://safeword/reviewer-login.html');
    const resource = (await handleReviewMcpRequest({
      jsonrpc: '2.0',
      id: 10,
      method: 'resources/read',
      params: { uri: resourceUri },
    })) as { result: { contents: { mimeType: string; text: string }[] } };
    expect(resource.result.contents[0]?.mimeType).toBe('text/html;profile=mcp-app');
    expect(resource.result.contents[0]?.text).toContain('ui/open-link');
    expect(
      payload(await call(12, 'start_reviewer_login', { project_root: root, review_id: 'unknown' })),
    ).toMatchObject({ error: expect.stringContaining('not waiting') });
    expect(
      payload(
        await call(2, 'start_review', {
          project_root: root,
          kind: 'executable-red',
          targets: ['proof.ts'],
        }),
      ),
    ).toMatchObject({ error: expect.stringContaining('kind must be') });
    expect(
      payload(
        await call(6, 'start_review', {
          project_root: root,
          kind: 'quality-review',
          targets: ['../secret.txt'],
        }),
      ),
    ).toMatchObject({ error: expect.stringContaining('project-relative') });
    expect(
      payload(await call(7, 'review_status', { project_root: root, review_id: 'unknown' })),
    ).toMatchObject({
      status: 'failed',
      independent: false,
    });
    expect(
      payload(
        await call(11, 'show_reviewer_login', {
          project_root: root,
          review_id: 'unknown',
          auth_url: 'https://claude.com/signin',
        }),
      ),
    ).toMatchObject({ error: expect.stringContaining('not waiting') });
    expect(readdirSync(nodePath.join(root, '.safeword'))).not.toContain('state');
  });

  it('returns a terminal coordinator result with a signed review receipt', async () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-mcp-test-'));
    roots.push(root);
    writeFileSync(nodePath.join(root, 'target.md'), 'Synthetic target\n');
    mkdirSync(nodePath.join(root, '.safeword'));
    writeFileSync(nodePath.join(root, '.safeword/config.json'), '{"crossAgentReview":"off"}\n');
    const started = payload(
      await call(3, 'start_review', {
        project_root: root,
        kind: 'quality-review',
        targets: ['target.md'],
      }),
    );
    const id = (started.data as Record<string, unknown>).review_id;
    expect(id).toEqual(expect.any(String));
    let terminal: Record<string, unknown> = {};
    await vi.waitFor(
      async () => {
        terminal = payload(await call(4, 'review_status', { project_root: root, review_id: id }));
        expect(terminal.status).toBe('existing_route');
      },
      { timeout: 10_000 },
    );
    expect(terminal.independent).toBe(false);
    expect(readdirSync(nodePath.join(root, '.safeword/state/reviews'))).toContain(`${id}.json`);
    expect(readFileSync(nodePath.join(root, 'target.md'), 'utf8')).toBe('Synthetic target\n');
    const pluginRoot = nodePath.resolve(import.meta.dirname, '../../codex-plugin');
    const restarted = spawnSync('bun', ['runtime/review-mcp.js', '--codex'], {
      cwd: pluginRoot,
      encoding: 'utf8',
      input: `${JSON.stringify({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: { name: 'review_status', arguments: { project_root: root, review_id: id } },
      })}\n`,
      timeout: 5000,
    });
    expect(restarted.status).toBe(0);
    const resumed = JSON.parse(restarted.stdout.trim()) as Record<string, unknown>;
    expect(payload(resumed).status).toBe('existing_route');
    writeFileSync(nodePath.join(root, 'target.md'), 'Changed source\n');
    expect(
      payload(await call(7, 'review_status', { project_root: root, review_id: id })).status,
    ).toBe('stale');
    writeFileSync(nodePath.join(root, 'target.md'), 'Synthetic target\n');
    expect(
      payload(await call(7, 'review_status', { project_root: root, review_id: id })).status,
    ).toBe('existing_route');
    const receiptPath = nodePath.join(root, '.safeword/state/reviews', `${id}.json`);
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as Record<string, unknown>;
    writeFileSync(receiptPath, `${JSON.stringify({ ...receipt, integrity: '0'.repeat(64) })}\n`);
    const tampered = payload(await call(8, 'review_status', { project_root: root, review_id: id }));
    expect(tampered.independent).toBe(false);
    expect(tampered.status).toBe('failed');
  });
});
