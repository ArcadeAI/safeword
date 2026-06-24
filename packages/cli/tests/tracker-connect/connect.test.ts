import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ConnectDependencies, connectTracker } from '../../src/tracker-connect/index.js';
import type { SecretLocation, VerifyResult } from '../../src/tracker-connect/types.js';
import type { Provider } from '../../src/tracker-sync/types.js';

/**
 * Connect orchestration (2TK5AD AC2–AC7). Real fs (config / sidecar / opt-in
 * files) in a tmpdir; only the boundary ports (prompt, secret store, verify) are
 * mocked — the #363 lesson.
 */
function fakeSecretStore(): {
  store: (provider: Provider, token: string) => Promise<SecretLocation>;
  calls: { provider: Provider; token: string }[];
} {
  const calls: { provider: Provider; token: string }[] = [];
  return {
    calls,
    store: (provider, token) => {
      calls.push({ provider, token });
      return Promise.resolve('keychain' as SecretLocation);
    },
  };
}

describe('connectTracker', () => {
  let cwd: string;
  let logs: string[];

  beforeEach(() => {
    cwd = mkdtempSync(nodePath.join(tmpdir(), 'connect-'));
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    logs = [];
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  const configPath = (): string => nodePath.join(cwd, '.safeword', 'config.json');
  const sidecarPath = (): string => nodePath.join(cwd, '.safeword', 'tracker-map.json');
  const readConfig = (): Record<string, unknown> =>
    JSON.parse(readFileSync(configPath(), 'utf8')) as Record<string, unknown>;

  function makeDependencies(overrides: Partial<ConnectDependencies> = {}): ConnectDependencies {
    return {
      cwd,
      provider: 'github',
      target: { repo: 'acme/demo' },
      token: undefined,
      prompt: { confirm: vi.fn(() => Promise.resolve(false)) },
      secretStore: fakeSecretStore(),
      verify: { whoami: (): Promise<VerifyResult> => Promise.resolve({ ok: true }) },
      log: m => {
        logs.push(m);
      },
      ...overrides,
    };
  }

  // AC7 — unsupported provider, no partial wiring
  it('rejects an unsupported provider with no config, secret, or sidecar', async () => {
    const secretStore = fakeSecretStore();
    const result = await connectTracker(makeDependencies({ provider: 'asana', secretStore }));
    expect(result.exitCode).not.toBe(0);
    expect(logs.join('\n')).toMatch(/unsupported|not supported/i);
    expect(existsSync(configPath())).toBe(false);
    expect(secretStore.calls).toHaveLength(0);
    expect(existsSync(sidecarPath())).toBe(false);
  });

  // AC2 — config + handoff
  it('writes github provider + target and prints the App/PAT handoff', async () => {
    await connectTracker(makeDependencies());
    expect((readConfig().ticketBridge as { provider: string }).provider).toBe('github');
    expect((readConfig().ticketBridge as { target: { repo: string } }).target.repo).toBe(
      'acme/demo',
    );
    expect(logs.join('\n')).toMatch(/App|PAT/);
  });

  it('writes linear provider + team and prints the Arcade handoff', async () => {
    await connectTracker(makeDependencies({ provider: 'linear', target: { team: 'ENG' } }));
    expect((readConfig().ticketBridge as { provider: string }).provider).toBe('linear');
    expect((readConfig().ticketBridge as { target: { team: string } }).target.team).toBe('ENG');
    expect(logs.join('\n')).toMatch(/Arcade/i);
  });

  it('re-connecting a different provider leaves no stale provider', async () => {
    writeFileSync(
      configPath(),
      JSON.stringify({ installedPacks: ['typescript'], ticketBridge: { provider: 'github' } }),
    );
    await connectTracker(makeDependencies({ provider: 'linear', target: { team: 'ENG' } }));
    expect((readConfig().ticketBridge as { provider: string }).provider).toBe('linear');
    expect(readConfig().installedPacks).toEqual(['typescript']); // preserves other keys
  });

  // AC3 — secret to store, never config/output
  it('stores the token in the secret store and never writes it to config or output', async () => {
    const secretStore = fakeSecretStore();
    await connectTracker(makeDependencies({ token: 'SENTINEL-SECRET-d34db33f', secretStore }));
    expect(secretStore.calls[0]?.token).toBe('SENTINEL-SECRET-d34db33f');
    expect(readFileSync(configPath(), 'utf8')).not.toContain('SENTINEL-SECRET-d34db33f');
    expect(logs.join('\n')).not.toContain('SENTINEL-SECRET-d34db33f');
  });

  // AC4 — verify pass / fail
  it('reports the connection live when verification passes', async () => {
    const result = await connectTracker(makeDependencies());
    expect(result.connected).toBe(true);
    expect(logs.join('\n')).toMatch(/connected|live/i);
  });

  it.each([
    'no credential resolved',
    'insufficient token scope',
    'the safeword App is not installed',
  ])('reports not connected and names the missing piece: %s', async missing => {
    const result = await connectTracker(
      makeDependencies({ verify: { whoami: () => Promise.resolve({ ok: false, missing }) } }),
    );
    expect(result.connected).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(logs.join('\n')).toContain(missing);
  });

  // AC5 — sidecar seeded on success, not on failure
  it('seeds an empty tracker-map sidecar on a verified connect', async () => {
    await connectTracker(makeDependencies());
    expect(existsSync(sidecarPath())).toBe(true);
    const sidecar = JSON.parse(readFileSync(sidecarPath(), 'utf8')) as { issues: unknown };
    expect(sidecar.issues).toEqual({});
  });

  it('does not seed the sidecar when verification fails', async () => {
    await connectTracker(
      makeDependencies({ verify: { whoami: () => Promise.resolve({ ok: false, missing: 'x' }) } }),
    );
    expect(existsSync(sidecarPath())).toBe(false);
  });

  // AC6 — pollution opt-ins
  it('writes both pollution opt-in files when accepted', async () => {
    await connectTracker(makeDependencies({ prompt: { confirm: () => Promise.resolve(true) } }));
    expect(existsSync(nodePath.join(cwd, '.cursorindexingignore'))).toBe(true);
    expect(readFileSync(nodePath.join(cwd, '.gitattributes'), 'utf8')).toMatch(/INDEX/);
  });

  it('writes neither pollution opt-in file when declined', async () => {
    await connectTracker(makeDependencies({ prompt: { confirm: () => Promise.resolve(false) } }));
    expect(existsSync(nodePath.join(cwd, '.cursorindexingignore'))).toBe(false);
    expect(existsSync(nodePath.join(cwd, '.gitattributes'))).toBe(false);
  });
});
