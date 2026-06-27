/**
 * Live secret store (2TK5AD AC3) — the untested-by-unit boundary. v1 keeps the
 * credential in an env var (the human exports it per the printed handoff; safeword
 * reads it at sync time), so it never touches the repo, config, argv, or logs.
 * Secure OS-keychain storage — a stdin-fed write to avoid leaking the token
 * through process args — is a deferred follow-up; env is the documented fallback.
 * The `SecretStore` port is what a keychain impl (or a PAT-paste flow) slots into.
 */

import type { Provider } from '../tracker-sync/types.js';
import type { SecretLocation, SecretStore } from './types.js';

export function createSecretStore(): SecretStore {
  return {
    // v1: the token already lives in the env (that's where connect reads it); nothing
    // is persisted by safeword and the value is never echoed.
    store(_provider: Provider): Promise<SecretLocation> {
      return Promise.resolve('env');
    },
  };
}
