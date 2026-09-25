import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleReviewMcpRequest } from '../../src/codex-plugin/review-mcp.js';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    // The fixture contains only files created by this test.
    rmSync(root, { recursive: true, force: true });
  }
});

async function call(id: number, name: string, args: unknown): Promise<Record<string, unknown>> {
  return await handleReviewMcpRequest({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name, arguments: args },
  }) as Record<string, unknown>;
}

function payload(response: Record<string, unknown>): Record<string, unknown> {
  const result = response.result as { content: { text: string }[] };
  const item = result.content[0];
  if (item === undefined) throw new Error('MCP response has no content');
  return JSON.parse(item.text) as Record<string, unknown>;
}

describe('Codex review MCP boundary', () => {
  it('starts the generated plugin server from the packaged manifest', () => {
    const pluginRoot = nodePath.resolve(import.meta.dirname, '../../codex-plugin');
    const manifest = JSON.parse(readFileSync(nodePath.join(pluginRoot, '.mcp.json'), 'utf8')) as {
      mcpServers: { safeword_review: { args: string[]; cwd: string } };
    };
    const server = manifest.mcpServers.safeword_review;
    expect(server.cwd).toBe('.');
    const launched = spawnSync('bun', server.args, {
      cwd: pluginRoot,
      encoding: 'utf8',
      input: `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })}\n`,
      timeout: 5000,
    });
    expect(launched.status).toBe(0);
    expect(launched.stderr).toBe('');
    const response = JSON.parse(launched.stdout.trim()) as {
      result: { tools: { name: string }[] };
    };
    expect(response.result.tools.map(tool => tool.name)).toEqual([
      'start_review',
      'review_status',
    ]);
  });

  it('exposes only review tools and excludes executable RED', async () => {
    const response = await handleReviewMcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) as {
      result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] };
    };
    expect(response.result.tools.map(tool => tool.name)).toEqual(['start_review', 'review_status']);
    expect(response.result.tools.map(tool => tool.annotations.readOnlyHint)).toEqual([false, true]);
    expect(payload(await call(2, 'start_review', {
      project_root: '/tmp', kind: 'executable-red', targets: ['proof.ts'],
    }))).toMatchObject({ error: expect.stringContaining('kind must be') });
    expect(payload(await call(6, 'start_review', {
      project_root: '/tmp', kind: 'quality-review', targets: ['../secret.txt'],
    }))).toMatchObject({ error: expect.stringContaining('project-relative') });
    expect(payload(await call(7, 'review_status', { project_root: '/tmp', review_id: 'unknown' }))).toMatchObject({
      status: 'failed', independent: false,
    });
  });

  it('returns a terminal coordinator result with a signed review receipt', async () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-mcp-test-'));
    roots.push(root);
    writeFileSync(nodePath.join(root, 'target.md'), 'Synthetic target\n');
    mkdirSync(nodePath.join(root, '.safeword'));
    writeFileSync(nodePath.join(root, '.safeword/config.json'), '{"crossAgentReview":"off"}\n');
    const started = payload(await call(3, 'start_review', {
      project_root: root, kind: 'quality-review', targets: ['target.md'],
    }));
    const id = (started.data as Record<string, unknown>).review_id;
    expect(id).toEqual(expect.any(String));
    let terminal: Record<string, unknown> = {};
    await vi.waitFor(async () => {
      terminal = payload(await call(4, 'review_status', { project_root: root, review_id: id }));
      expect(terminal.status).toBe('existing_route');
    }, { timeout: 10_000 });
    expect(terminal.independent).toBe(false);
    expect(readdirSync(nodePath.join(root, '.safeword/state/reviews'))).toContain(`${id}.json`);
    expect(readFileSync(nodePath.join(root, 'target.md'), 'utf8')).toBe('Synthetic target\n');
    const pluginRoot = nodePath.resolve(import.meta.dirname, '../../codex-plugin');
    const restarted = spawnSync('bun', ['runtime/review-mcp.js'], {
      cwd: pluginRoot,
      encoding: 'utf8',
      input: `${JSON.stringify({
        jsonrpc: '2.0', id: 6, method: 'tools/call',
        params: { name: 'review_status', arguments: { project_root: root, review_id: id } },
      })}\n`,
      timeout: 5000,
    });
    expect(restarted.status).toBe(0);
    const resumed = JSON.parse(restarted.stdout.trim()) as Record<string, unknown>;
    expect(payload(resumed).status).toBe('existing_route');
    writeFileSync(nodePath.join(root, 'target.md'), 'Changed source\n');
    expect(payload(await call(7, 'review_status', { project_root: root, review_id: id })).status).toBe('stale');
    writeFileSync(nodePath.join(root, 'target.md'), 'Synthetic target\n');
    const receiptPath = nodePath.join(root, '.safeword/state/reviews', `${id}.json`);
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as Record<string, unknown>;
    writeFileSync(receiptPath, `${JSON.stringify({ ...receipt, state: 'completed', integrity: '0'.repeat(64) })}\n`);
    const tampered = payload(await call(8, 'review_status', { project_root: root, review_id: id }));
    expect(tampered.independent).toBe(false);
    expect(tampered.status).toBe('failed');
  });
});
