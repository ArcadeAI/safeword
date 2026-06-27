import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { connectTracker } from '../../src/tracker-connect/index.js';
import { type ConnectChoice, offerTrackerConnect } from '../../src/tracker-connect/offer.js';
import type { SecretLocation } from '../../src/tracker-connect/types.js';

/**
 * The setup offer (2TK5AD AC1, AC8). Asserts EXTERNAL outcomes through the REAL
 * connectTracker (not "connect was called") — the #363 lesson, the exact trap the
 * scenario-gate review flagged. Only the connect flow's own boundary (prompt /
 * secret store / verify) is mocked.
 */
describe('offerTrackerConnect', () => {
  let cwd: string;
  let logs: string[];

  beforeEach(() => {
    cwd = mkdtempSync(nodePath.join(tmpdir(), 'offer-'));
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    logs = [];
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  const configPath = (): string => nodePath.join(cwd, '.safeword', 'config.json');
  const sidecarPath = (): string => nodePath.join(cwd, '.safeword', 'tracker-map.json');

  /** A real connectTracker bound to the temp cwd with the boundary mocked (verify ok). */
  const realConnect = (choice: ConnectChoice) =>
    connectTracker({
      cwd,
      provider: choice.provider,
      target: choice.target,
      token: undefined,
      prompt: { confirm: () => Promise.resolve(false) }, // decline pollution opt-ins
      secretStore: { store: () => Promise.resolve('keychain' as SecretLocation) },
      verify: { whoami: () => Promise.resolve({ ok: true }) },
      log: m => {
        logs.push(m);
      },
    });

  // AC1 — declining leaves the project inert (no config, no sidecar)
  it('declining the offer writes no config and seeds no sidecar', async () => {
    await offerTrackerConnect({
      prompt: { confirm: () => Promise.resolve(false) },
      chooseConnect: () => Promise.resolve({ provider: 'github', target: { repo: 'x/y' } }),
      connect: realConnect,
    });
    expect(existsSync(configPath())).toBe(false);
    expect(existsSync(sidecarPath())).toBe(false);
  });

  // AC8 — accepting runs the same connect flow; assert its external result
  it('accepting runs the connect flow: config + handoff + sidecar appear', async () => {
    await offerTrackerConnect({
      prompt: { confirm: () => Promise.resolve(true) },
      chooseConnect: () => Promise.resolve({ provider: 'github', target: { repo: 'acme/demo' } }),
      connect: realConnect,
    });
    const written = JSON.parse(readFileSync(configPath(), 'utf8')) as {
      ticketBridge: { provider: string; target: { repo: string } };
    };
    expect(written.ticketBridge.provider).toBe('github');
    expect(written.ticketBridge.target.repo).toBe('acme/demo');
    expect(logs.join('\n')).toMatch(/App|PAT/);
    expect(existsSync(sidecarPath())).toBe(true);
  });
});
