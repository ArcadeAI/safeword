import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { syncTrackerCommand } from '../../src/commands/sync-tracker.js';

describe('sync-tracker Linear live-sync guidance', () => {
  let cwd: string;
  let stderr: string[];

  beforeEach(() => {
    cwd = mkdtempSync(nodePath.join(tmpdir(), 'sync-linear-'));
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ ticketBridge: { provider: 'linear', target: { team: 'ENG' } } }),
    );
    stderr = [];
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    vi.spyOn(process.stderr, 'write').mockImplementation(chunk => {
      stderr.push(String(chunk));
      return true;
    });
    vi.stubEnv('LINEAR_API_KEY', '');
    process.exitCode = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    process.exitCode = 0;
    rmSync(cwd, { recursive: true, force: true });
  });

  it.each([
    ['without a credential', undefined],
    ['with a credential', 'dummy-linear-token'],
  ])('points directly to portable sync %s', async (_condition, credential) => {
    if (credential !== undefined) vi.stubEnv('LINEAR_API_KEY', credential);

    await syncTrackerCommand();

    const output = stderr.join('');
    expect(process.exitCode).toBe(1);
    expect(output).toContain('safeword sync-tracker --plan');
    expect(output).toContain('--apply-results');
    expect(output).not.toMatch(/credential|token/i);
  });
});
