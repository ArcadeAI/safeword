/**
 * Composition root for the connect flow (2TK5AD): wire the real boundary ports
 * (prompt / secret store / verify), resolve any env credential, and run the
 * orchestration. Shared by `safeword connect` and the `safeword setup` offer so
 * neither command imports the other — commands stay independent (depcruise
 * `cli-no-cross-command-imports`); the shared logic lives in the module, not a
 * sibling command.
 */

import process from 'node:process';

import { CREDENTIAL_ENV_VAR } from '../tracker-sync/secrets.js';
import type { Provider } from '../tracker-sync/types.js';
import { connectTracker } from './index.js';
import { createPrompt } from './prompt.js';
import { createSecretStore } from './secret-store.js';
import type { ConnectResult, ConnectTarget } from './types.js';
import { createVerifyClient } from './verify.js';

/** Resolve ports + env credential and run `connectTracker`; `log` is injected by the caller. */
export function runConnect(
  provider: string,
  target: ConnectTarget,
  log: (message: string) => void,
): Promise<ConnectResult> {
  // Only the supported providers have a credential env var; an unsupported one
  // yields no token and `connectTracker` rejects it before the token is used.
  const envVariable = CREDENTIAL_ENV_VAR[provider as Provider] as string | undefined;
  const token = envVariable ? process.env[envVariable] : undefined;

  return connectTracker({
    cwd: process.cwd(),
    provider,
    target,
    token,
    prompt: createPrompt(),
    secretStore: createSecretStore(),
    verify: createVerifyClient(),
    log,
  });
}
