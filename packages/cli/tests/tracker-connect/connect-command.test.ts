import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary-only mocking (#363): the real connectCommand drives the real config /
// sidecar / handoff logic; only the verify client and the interactive prompt are
// stubbed. A regression in the command→orchestration wiring fails here.
const { whoami } = vi.hoisted(() => ({ whoami: vi.fn() }));
vi.mock('../../src/tracker-connect/verify.js', () => ({
  createVerifyClient: () => ({ whoami }),
}));
vi.mock('../../src/tracker-connect/prompt.js', () => ({
  createPrompt: () => ({ confirm: () => Promise.resolve(false) }),
}));

import { connectCommand } from '../../src/commands/connect.js';

describe('connect command wiring (real command, boundary mocked)', () => {
  let cwd: string;
  let logs: string[];

  beforeEach(() => {
    cwd = mkdtempSync(nodePath.join(tmpdir(), 'connect-cmd-'));
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    logs = [];
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    vi.spyOn(console, 'log').mockImplementation(m => {
      logs.push(String(m));
    });
    process.env.GITHUB_TOKEN = 'token';
    process.exitCode = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    whoami.mockReset();
    delete process.env.GITHUB_TOKEN;
    process.exitCode = 0;
    rmSync(cwd, { recursive: true, force: true });
  });

  const sidecar = (): string => nodePath.join(cwd, '.safeword', 'tracker-map.json');
  const config = (): string => nodePath.join(cwd, '.safeword', 'config.json');

  it('writes config, prints the handoff, and seeds the sidecar on a verified connect', async () => {
    whoami.mockResolvedValue({ ok: true });

    await connectCommand('github', { repo: 'acme/demo' });

    const written = JSON.parse(readFileSync(config(), 'utf8')) as {
      ticketBridge: { provider: string; target: { repo: string } };
    };
    expect(written.ticketBridge.provider).toBe('github');
    expect(written.ticketBridge.target.repo).toBe('acme/demo');
    expect(logs.join('\n')).toMatch(/App|PAT/);
    expect(existsSync(sidecar())).toBe(true);
    expect(process.exitCode).toBe(0);
  });

  it('exits non-zero, names the missing piece, and seeds nothing when verify fails', async () => {
    whoami.mockResolvedValue({ ok: false, missing: 'no GitHub credential resolved' });

    await connectCommand('github', { repo: 'acme/demo' });

    expect(process.exitCode).not.toBe(0);
    expect(logs.join('\n')).toContain('no GitHub credential resolved');
    expect(existsSync(sidecar())).toBe(false);
  });
});
