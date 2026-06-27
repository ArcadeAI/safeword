import { describe, expect, it } from 'vitest';

import { CREDENTIAL_ENV_VAR, resolveCredential } from '../../src/tracker-sync/secrets.js';

/**
 * Credential resolution (JS5K5G AC11): keychain → env var, never config. The
 * resolver takes no config object at all, so "never read a token from config" is
 * structural. Keychain access is injected so the unit test stays hermetic.
 */
describe('sync-tracker credential resolution (sync-tracker.TB1.AC11)', () => {
  it('resolves the token from the provider env var', () => {
    const result = resolveCredential('linear', {
      env: { [CREDENTIAL_ENV_VAR.linear]: 'env-token' },
    });
    expect(result).toEqual({ ok: true, token: 'env-token' });
  });

  it('prefers the keychain over the env var', () => {
    const result = resolveCredential('github', {
      env: { [CREDENTIAL_ENV_VAR.github]: 'env-token' },
      keychain: () => 'keychain-token',
    });
    expect(result).toEqual({ ok: true, token: 'keychain-token' });
  });

  it('falls back to the env var when the keychain has nothing', () => {
    const result = resolveCredential('github', {
      env: { [CREDENTIAL_ENV_VAR.github]: 'env-token' },
      keychain: () => '',
    });
    expect(result).toEqual({ ok: true, token: 'env-token' });
  });

  it('reports not-ok when no credential resolves', () => {
    expect(resolveCredential('linear', { env: {} })).toEqual({ ok: false });
  });

  it('does not accept a config object as a source (structural — config carries no token)', () => {
    // The signature has no config parameter; a token placed in a config-shaped
    // object is unreachable. Resolution still comes only from env/keychain.
    const result = resolveCredential('linear', { env: {} });
    expect(result).toEqual({ ok: false });
  });
});
