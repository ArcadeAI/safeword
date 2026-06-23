import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { syncTrackerCommand } from '../../src/commands/sync-tracker.js';

/**
 * Thin command smoke test (impl-plan): the provider:none path needs no client,
 * so it exercises config read → orchestrator → output end-to-end without a
 * tracker. Behavior beyond this is covered by the orchestrator unit tests.
 */
describe('sync-tracker command smoke (sync-tracker.TB1.AC1)', () => {
  let cwd: string;
  let logs: string[];

  beforeEach(() => {
    cwd = mkdtempSync(nodePath.join(tmpdir(), 'sync-cmd-'));
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    logs = [];
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    vi.spyOn(console, 'log').mockImplementation(message => {
      logs.push(String(message));
    });
    process.exitCode = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
    rmSync(cwd, { recursive: true, force: true });
  });

  it('is a friendly no-op when no tracker is configured', async () => {
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ ticketBridge: { provider: 'none' } }),
    );

    await syncTrackerCommand();

    expect(logs.join('\n')).toMatch(/safeword setup/);
    expect(process.exitCode).toBe(0);
  });
});
