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
  let stderr: string[];

  const sidecar = () => nodePath.join(cwd, '.safeword', 'tracker-map.json');
  const writeConfig = (ticketBridge: Record<string, unknown>) => {
    writeFileSync(nodePath.join(cwd, '.safeword', 'config.json'), JSON.stringify({ ticketBridge }));
  };

  beforeEach(() => {
    cwd = mkdtempSync(nodePath.join(tmpdir(), 'sync-plan-'));
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeConfig({ provider: 'github', target: { repo: 'acme/demo' } });
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
        'secret body text',
        '',
      ].join('\n'),
    );

    stdout = [];
    stderr = [];
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    vi.spyOn(process.stdout, 'write').mockImplementation(chunk => {
      stdout.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation(chunk => {
      stderr.push(String(chunk));
      return true;
    });
    process.exitCode = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
    rmSync(cwd, { recursive: true, force: true });
  });

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

  // #1441 provider parity: the live path is a friendly no-op with no provider, so
  // --plan must not hand an executor an all-`create` plan for an unconfigured tracker.
  it('--plan on an unconfigured project emits an empty plan, not a plan full of creates', async () => {
    writeConfig({ provider: 'none' });

    await syncTrackerCommand({ plan: true });

    expect(process.exitCode).toBe(0);
    const parsed: unknown = JSON.parse(stdout.join(''));
    expect(parsed).toEqual({ version: 1, intents: [] });
    // The advisory goes to stderr so stdout stays a pure SyncPlan.
    expect(stderr.join('')).toContain('no tracker configured');
  });

  // #1441 egress parity: a `full` body puts ticket bodies in the plan document.
  it('--plan warns on stderr when planning full bodies to github, keeping stdout pure', async () => {
    writeConfig({ provider: 'github', body: 'full', target: { repo: 'acme/demo' } });

    await syncTrackerCommand({ plan: true });

    expect(stderr.join('')).toContain('Egress warning');
    // The warning must not pollute the machine-readable plan.
    const parsed: unknown = JSON.parse(stdout.join(''));
    expect(parsed).toMatchObject({ version: 1 });
  });

  // Nothing else pins that `full` actually reaches the emitted document: a --plan that
  // silently downgraded to minimal (the egress-relevant bug) would pass every other test.
  it('--plan emits full ticket bodies under body:full and withholds them under minimal', async () => {
    writeConfig({ provider: 'github', body: 'full', target: { repo: 'acme/demo' } });
    await syncTrackerCommand({ plan: true });
    expect(stdout.join('')).toContain('secret body text');

    stdout.length = 0;
    writeConfig({ provider: 'github', target: { repo: 'acme/demo' } }); // minimal default
    await syncTrackerCommand({ plan: true });
    expect(stdout.join('')).not.toContain('secret body text');
  });

  it('--plan does not warn about egress under the default minimal body', async () => {
    await syncTrackerCommand({ plan: true });

    expect(stderr.join('')).not.toContain('Egress warning');
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
