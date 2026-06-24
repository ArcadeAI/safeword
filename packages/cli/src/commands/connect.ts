/**
 * `safeword connect <provider>` (2TK5AD) — the standalone entry point. Thin
 * wrapper: collect target + any env credential, build the real boundary ports
 * (prompt / secret store / verify), and hand to the pure connect orchestration.
 */

import process from 'node:process';

import { connectTracker } from '../tracker-connect/index.js';
import { createPrompt } from '../tracker-connect/prompt.js';
import { createSecretStore } from '../tracker-connect/secret-store.js';
import { createVerifyClient } from '../tracker-connect/verify.js';
import { CREDENTIAL_ENV_VAR } from '../tracker-sync/secrets.js';
import type { Provider } from '../tracker-sync/types.js';

export interface ConnectCommandOptions {
  repo?: string;
  team?: string;
  workspace?: string;
}

const HAS_ENV_VAR = new Set<string>(['github', 'linear']);

function log(message: string): void {
  console.log(message);
}

export async function connectCommand(
  provider: string,
  options: ConnectCommandOptions = {},
): Promise<void> {
  const token = HAS_ENV_VAR.has(provider)
    ? process.env[CREDENTIAL_ENV_VAR[provider as Provider]]
    : undefined;

  const result = await connectTracker({
    cwd: process.cwd(),
    provider,
    target: { repo: options.repo, team: options.team, workspace: options.workspace },
    token,
    prompt: createPrompt(),
    secretStore: createSecretStore(),
    verify: createVerifyClient(),
    log,
  });

  if (result.exitCode !== 0) process.exitCode = result.exitCode;
}
