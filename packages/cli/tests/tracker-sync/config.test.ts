import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readTicketBridgeConfig } from '../../src/tracker-sync/config.js';

describe('sync-tracker config reader (sync-tracker.TB1.AC1)', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(nodePath.join(tmpdir(), 'tb-config-'));
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  const writeConfig = (object: unknown): void => {
    writeFileSync(nodePath.join(cwd, '.safeword', 'config.json'), JSON.stringify(object));
  };

  it('defaults to the inert no-tracker config when no file exists', () => {
    expect(readTicketBridgeConfig(cwd)).toEqual({ provider: 'none', body: 'minimal' });
  });

  it('defaults when the config has no ticketBridge block', () => {
    writeConfig({ installedPacks: [] });
    expect(readTicketBridgeConfig(cwd)).toEqual({ provider: 'none', body: 'minimal' });
  });

  it('reads provider, body, and target from the ticketBridge block', () => {
    writeConfig({
      ticketBridge: { provider: 'github', body: 'full', target: { repo: 'acme/repo' } },
    });
    const config = readTicketBridgeConfig(cwd);
    expect(config.provider).toBe('github');
    expect(config.body).toBe('full');
    expect(config.target?.repo).toBe('acme/repo');
  });

  it('falls back to minimal body for an unrecognized body value', () => {
    writeConfig({ ticketBridge: { provider: 'linear', body: 'verbose' } });
    expect(readTicketBridgeConfig(cwd).body).toBe('minimal');
  });

  it('defaults on a corrupt config file', () => {
    writeFileSync(nodePath.join(cwd, '.safeword', 'config.json'), '{ not json');
    expect(readTicketBridgeConfig(cwd)).toEqual({ provider: 'none', body: 'minimal' });
  });
});
