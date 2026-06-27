/**
 * `safeword self-report` viewer (ticket QYYC5Y, issue #345).
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { selfReport } from '../../src/commands/self-report.js';
import { recordSignal } from '../../templates/hooks/lib/self-report.js';

describe('selfReport (QYYC5Y)', () => {
  let projectDirectory: string;
  let logs: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'sw-selfreport-cmd-'));
    logs = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  it('reports nothing when the spool is empty', async () => {
    await selfReport({}, projectDirectory);
    expect(logs.join('\n')).toContain('No safeword self-reports');
  });

  it('summarizes captured signals by signature with counts', async () => {
    recordSignal(
      projectDirectory,
      's1',
      { source: 'post-tool-quality', errorClass: 'TypeError' },
      '1',
    );
    recordSignal(
      projectDirectory,
      's1',
      { source: 'post-tool-quality', errorClass: 'TypeError' },
      '1',
    );
    recordSignal(projectDirectory, 's2', { source: 'check', exitCode: 1 }, '1');

    await selfReport({}, projectDirectory);
    const out = logs.join('\n');

    expect(out).toContain('2 signature(s)');
    expect(out).toContain('2×  unknown:TypeError@post-tool-quality');
    expect(out).toContain('1×  unknown:exit1@check');
  });

  it('emits machine-readable JSON under --json', async () => {
    recordSignal(
      projectDirectory,
      's1',
      { source: 'post-tool-quality', errorClass: 'TypeError' },
      '1',
    );

    await selfReport({ json: true }, projectDirectory);
    const parsed = JSON.parse(logs.join('\n')) as {
      total: number;
      groups: { signature: string; count: number }[];
    };

    expect(parsed.total).toBe(1);
    expect(parsed.groups[0]?.signature).toBe('unknown:TypeError@post-tool-quality');
    expect(parsed.groups[0]?.count).toBe(1);
  });

  it('emits ready-to-file issue drafts under --format issue', async () => {
    recordSignal(
      projectDirectory,
      's1',
      { source: 'post-tool-quality', errorClass: 'TypeError' },
      '1',
    );

    await selfReport({ format: 'issue' }, projectDirectory);
    const drafts = JSON.parse(logs.join('\n')) as {
      title: string;
      labels: string[];
      body: string;
    }[];

    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.title).toBe('[self-report] unknown:TypeError@post-tool-quality');
    expect(drafts[0]?.labels).toContain('self-reported');
  });
});
