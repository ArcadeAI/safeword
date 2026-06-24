/**
 * Ports for the connect flow (2TK5AD). The orchestration in `index.ts` is pure
 * over these injected boundaries — the interactive prompt, the secret store
 * (keychain), and the per-provider verify client — so the flow is tested through
 * real config/sidecar/file logic with only the boundary mocked (the #363 lesson).
 */

import type { Provider } from '../tracker-sync/types.js';

/** Non-secret connect target (provider/board coordinates). */
export interface ConnectTarget {
  repo?: string;
  team?: string;
  workspace?: string;
}

/** Interactive yes/no prompt — injected so tests don't touch real stdin. */
export interface Prompt {
  confirm(question: string, defaultValue: boolean): Promise<boolean>;
}

/** Where the resolved secret landed — never the repo config. */
export type SecretLocation = 'keychain' | 'env';

/** Stores a provider credential outside the repo (keychain preferred, env fallback). */
export interface SecretStore {
  store(provider: Provider, token: string): Promise<SecretLocation>;
}

/** Non-destructive auth check. On failure, `missing` names the piece to fix. */
export type VerifyResult = { ok: true } | { ok: false; missing: string };

export interface VerifyClient {
  whoami(provider: Provider): Promise<VerifyResult>;
}

export interface ConnectResult {
  exitCode: number;
  connected: boolean;
}
