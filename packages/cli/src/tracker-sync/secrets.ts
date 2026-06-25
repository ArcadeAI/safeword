/**
 * Credential resolution for sync-tracker (JS5K5G AC11). Tokens come from the OS
 * keychain or an env var — never from `.safeword/config.json` (this function has
 * no config parameter, so a token in config is structurally unreachable) and
 * never logged. Keychain access is injected so callers/tests stay hermetic.
 */

import type { Provider } from './types.js';

/** The env var each provider's token is read from. */
export const CREDENTIAL_ENV_VAR: Record<Provider, string> = {
  linear: 'LINEAR_API_KEY',
  github: 'GITHUB_TOKEN',
};

export interface CredentialDependencies {
  env: Record<string, string | undefined>;
  /** Optional keychain accessor; preferred over the env var when it returns a value. */
  keychain?: (provider: Provider) => string | undefined;
}

export type CredentialResult = { ok: true; token: string } | { ok: false };

/** Resolve a provider credential: keychain first, then env var, else not-ok. */
export function resolveCredential(
  provider: Provider,
  dependencies: CredentialDependencies,
): CredentialResult {
  const fromKeychain = dependencies.keychain?.(provider);
  if (fromKeychain !== undefined && fromKeychain.length > 0) {
    return { ok: true, token: fromKeychain };
  }
  const fromEnvironment = dependencies.env[CREDENTIAL_ENV_VAR[provider]];
  if (fromEnvironment !== undefined && fromEnvironment.length > 0) {
    return { ok: true, token: fromEnvironment };
  }
  return { ok: false };
}
