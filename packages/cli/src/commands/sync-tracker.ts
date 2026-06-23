/**
 * `safeword sync-tracker` — project the local ticket corpus one-way into the
 * configured tracker (JS5K5G). Thin wrapper: read config, resolve the credential,
 * walk the corpus, build the live writer, and hand it all to the pure
 * orchestrator. Network runs only here / in CI, never in the per-turn loop.
 */

import process from 'node:process';

import { buildWriterRegistry, resolveRepoVisibility } from '../tracker-sync/clients.js';
import { readTicketBridgeConfig } from '../tracker-sync/config.js';
import { readCorpus } from '../tracker-sync/corpus.js';
import {
  SUPPORTED_PROVIDERS,
  syncTracker,
  type SyncTrackerDependencies,
} from '../tracker-sync/index.js';
import type { Provider } from '../tracker-sync/types.js';

export interface SyncTrackerCommandOptions {
  resetTrackerMap?: boolean;
}

/** Resolve repo visibility only when it can gate egress (github + full body). */
function egressVisibility(
  provider: Provider | undefined,
  body: string | undefined,
  repo: string | undefined,
): 'public' | 'private' | undefined {
  return provider === 'github' && body === 'full' ? resolveRepoVisibility(repo) : undefined;
}

export async function syncTrackerCommand(options: SyncTrackerCommandOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const config = readTicketBridgeConfig(cwd);

  const provider = SUPPORTED_PROVIDERS.has(config.provider as Provider)
    ? (config.provider as Provider)
    : undefined;
  const dependencies: SyncTrackerDependencies = {
    config,
    tickets: provider === undefined ? [] : readCorpus(cwd, config.target?.repo),
    sidecarPath: `${cwd}/.safeword/tracker-map.json`,
    writers:
      provider === undefined
        ? ({} as SyncTrackerDependencies['writers'])
        : buildWriterRegistry(provider, config.target),
    env: process.env,
    resetTrackerMap: options.resetTrackerMap,
    nonInteractive: process.env.CI !== undefined,
    arcadeUserId: process.env.ARCADE_USER_ID,
    repoVisibility: egressVisibility(provider, config.body, config.target?.repo),

    log: message => {
      console.log(message);
    },
  };

  try {
    const result = await syncTracker(dependencies);
    if (result.exitCode !== 0) process.exitCode = result.exitCode;
  } catch (error) {
    // A live-adapter failure (e.g. a `gh` label that doesn't pre-exist, or auth)
    // aborts the run; earlier creates are already persisted to the sidecar, so a
    // re-run resumes. Surface the message (the token is never in it) and exit 1.
    process.stderr.write(`sync-tracker failed: ${(error as Error).message}\n`);
    process.exitCode = 1;
  }
}
