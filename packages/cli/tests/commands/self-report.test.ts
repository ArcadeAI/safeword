/**
 * `safeword self-report` viewer (ticket QYYC5Y, issue #345).
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { recordSignal } from '../../templates/hooks/lib/self-report.js';
import { runCli } from '../helpers.js';

describe('selfReport (QYYC5Y)', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'sw-selfreport-cmd-'));
  });

  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  it('reports nothing when the spool is empty', async () => {
    const result = await runCli([
      'retro',
      'signals',
      '--no-input',
      '--offline',
      '--cwd',
      projectDirectory,
    ]);
    expect(result.stdout).toContain('No safeword self-reports');
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

    const result = await runCli([
      'self-report',
      '--no-input',
      '--offline',
      '--cwd',
      projectDirectory,
    ]);
    const out = result.stdout;

    expect(out).toContain('2 signature(s)');
    expect(out).toContain('2×  unknown:TypeError@post-tool-quality');
    expect(out).toContain('1×  unknown:exit1@check');
    expect(result.stderr).toContain('deprecated');
  });

  it('emits the legacy raw JSON format under --format json', async () => {
    recordSignal(
      projectDirectory,
      's1',
      { source: 'post-tool-quality', errorClass: 'TypeError' },
      '1',
    );

    const result = await runCli([
      'self-report',
      '--format',
      'json',
      '--no-input',
      '--offline',
      '--cwd',
      projectDirectory,
    ]);
    const parsed = JSON.parse(result.stdout) as {
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

    const result = await runCli([
      'self-report',
      '--format',
      'issue',
      '--no-input',
      '--offline',
      '--cwd',
      projectDirectory,
    ]);
    const drafts = JSON.parse(result.stdout) as {
      title: string;
      labels: string[];
      body: string;
    }[];

    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.title).toBe('[self-report] unknown:TypeError@post-tool-quality');
    expect(drafts[0]?.labels).toContain('self-reported');
  });
});
