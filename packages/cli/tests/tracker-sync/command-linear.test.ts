import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { syncTrackerCommand } from '../../src/commands/sync-tracker.js';

describe('sync-tracker Linear live-sync guidance', () => {
  let cwd: string;
  let logs: string[];

  beforeEach(() => {
    cwd = mkdtempSync(nodePath.join(tmpdir(), 'sync-linear-'));
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ ticketBridge: { provider: 'linear', target: { team: 'ENG' } } }),
    );
    logs = [];
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    vi.spyOn(console, 'log').mockImplementation(message => {
      logs.push(String(message));
    });
    delete process.env.LINEAR_API_KEY;
    process.exitCode = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LINEAR_API_KEY;
    process.exitCode = 0;
    rmSync(cwd, { recursive: true, force: true });
  });

  it.each([
    ['without a credential', undefined],
    ['with a credential', 'dummy-linear-token'],
  ])('points directly to portable sync %s', async (_condition, credential) => {
    if (credential !== undefined) process.env.LINEAR_API_KEY = credential;

    await syncTrackerCommand();

    const output = logs.join('\n');
    expect(process.exitCode).toBe(1);
    expect(output).toContain('safeword sync-tracker --plan');
    expect(output).toContain('--apply-results');
    expect(output).not.toMatch(/credential|token/i);
  });
});
