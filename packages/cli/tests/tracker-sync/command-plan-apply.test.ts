/**
 * Command-surface wiring for the portable transport (CBTDK8). Drives the real
 * `syncTrackerCommand` with `--plan` / `--apply-results` over a real corpus +
 * sidecar (mocking only the process boundary: cwd + stdout). Proves the flag →
 * computePlan → stdout contract and the read → applyResults → save round-trip,
 * which the pure unit tests can't see. No live tracker.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { syncTrackerCommand } from '../../src/commands/sync-tracker.js';

describe('sync-tracker --plan / --apply-results command wiring', () => {
  let cwd: string;
  let stdout: string[];

  beforeEach(() => {
    cwd = mkdtempSync(nodePath.join(tmpdir(), 'sync-plan-'));
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ ticketBridge: { provider: 'github', target: { repo: 'acme/demo' } } }),
    );
    const ticketDirectory = nodePath.join(cwd, '.project', 'tickets', 'AB12CD-login');
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(ticketDirectory, 'ticket.md'),
      [
        '---',
        'id: AB12CD',
        'slug: login',
        'type: task',
        'status: in_progress',
        'title: Login bug',
        '---',
        '',
      ].join('\n'),
    );

    stdout = [];
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    vi.spyOn(process.stdout, 'write').mockImplementation(chunk => {
      stdout.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    process.exitCode = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
    rmSync(cwd, { recursive: true, force: true });
  });

  const sidecar = () => nodePath.join(cwd, '.safeword', 'tracker-map.json');

  it('--plan writes a single valid SyncPlan JSON document to stdout and nothing else', async () => {
    await syncTrackerCommand({ plan: true });

    const output = stdout.join('');
    const parsed: unknown = JSON.parse(output); // throws if stdout carries log noise
    expect(parsed).toMatchObject({ version: 1 });
    const plan = parsed as { intents: { kind: string; ticketId: string }[] };
    expect(plan.intents).toEqual([expect.objectContaining({ kind: 'create', ticketId: 'AB12CD' })]);
    expect(process.exitCode).toBe(0);
    expect(existsSync(sidecar())).toBe(false); // --plan writes no sidecar
  });

  it('--apply-results reads the file, folds it in, and saves the sidecar', async () => {
    const resultsFile = nodePath.join(cwd, 'results.json');
    writeFileSync(
      resultsFile,
      JSON.stringify({
        version: 1,
        results: [
          { ticketId: 'AB12CD', number: '549', url: 'https://github.com/acme/demo/issues/549' },
        ],
      }),
    );

    await syncTrackerCommand({ applyResults: resultsFile });

    expect(process.exitCode).toBe(0);
    const map = JSON.parse(readFileSync(sidecar(), 'utf8'));
    expect(map.issues.AB12CD).toEqual({
      ref: { provider: 'github', id: '549', url: 'https://github.com/acme/demo/issues/549' },
      status: 'recorded',
    });
  });

  it('rejects a missing results file without writing the sidecar', async () => {
    await syncTrackerCommand({ applyResults: nodePath.join(cwd, 'nope.json') });

    expect(process.exitCode).toBe(1);
    expect(existsSync(sidecar())).toBe(false);
  });

  it('refuses to apply against a corrupt sidecar, leaving it untouched', async () => {
    writeFileSync(sidecar(), '{ corrupt not json');
    const resultsFile = nodePath.join(cwd, 'results.json');
    writeFileSync(
      resultsFile,
      JSON.stringify({
        version: 1,
        results: [
          { ticketId: 'AB12CD', number: '549', url: 'https://github.com/acme/demo/issues/549' },
        ],
      }),
    );

    await syncTrackerCommand({ applyResults: resultsFile });

    expect(process.exitCode).toBe(1);
    // The corrupt sidecar is left exactly as-is — never silently reset then overwritten.
    expect(readFileSync(sidecar(), 'utf8')).toBe('{ corrupt not json');
  });

  // A corrupt sidecar must NOT plan as if nothing were synced: every recorded ticket
  // would come back as a `create` and the executor would duplicate every issue.
  it('refuses to --plan against a corrupt sidecar instead of emitting creates', async () => {
    writeFileSync(sidecar(), '{ corrupt not json');

    await syncTrackerCommand({ plan: true });

    expect(process.exitCode).toBe(1);
    expect(stdout.join('')).toBe('');
    // The corrupt file is left exactly as it was.
    expect(readFileSync(sidecar(), 'utf8')).toBe('{ corrupt not json');
  });

  it('rejects combining --plan and --apply-results', async () => {
    await syncTrackerCommand({ plan: true, applyResults: nodePath.join(cwd, 'results.json') });

    expect(process.exitCode).toBe(1);
    expect(stdout.join('')).toBe(''); // no plan emitted
  });

  it('never emits a credential in the plan, even when one is in the environment', async () => {
    const previous = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = 'sw-sentinel-token-xyz';
    try {
      await syncTrackerCommand({ plan: true });
      expect(stdout.join('')).not.toContain('sw-sentinel-token-xyz');
    } finally {
      if (previous === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = previous;
    }
  });
});
