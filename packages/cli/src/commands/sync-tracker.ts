/**
 * `safeword sync-tracker` — project the local ticket corpus one-way into the
 * configured tracker (JS5K5G). Thin wrapper: read config, resolve the credential,
 * walk the corpus, build the live writer, and hand it all to the pure
 * orchestrator. Network runs only here / in CI, never in the per-turn loop.
 */

import process from 'node:process';

import { buildWriterRegistry } from '../tracker-sync/clients.js';
import { readTicketBridgeConfig } from '../tracker-sync/config.js';
import { readCorpus } from '../tracker-sync/corpus.js';
import { syncTracker, type SyncTrackerDependencies } from '../tracker-sync/index.js';

const SUPPORTED = new Set(['linear', 'github']);

export interface SyncTrackerCommandOptions {
  resetTrackerMap?: boolean;
}

export async function syncTrackerCommand(options: SyncTrackerCommandOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const config = readTicketBridgeConfig(cwd);

  const provider = SUPPORTED.has(config.provider)
    ? (config.provider as 'linear' | 'github')
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
