/**
 * `safeword sync-tracker` — project the local ticket corpus one-way into the
 * configured tracker (JS5K5G). Thin wrapper: read config, resolve the credential,
 * walk the corpus, build the live writer, and hand it all to the pure
 * orchestrator. Network runs only here / in CI, never in the per-turn loop.
 */

import { readFileSync } from 'node:fs';
import process from 'node:process';

import { applyResults } from '../tracker-sync/apply-results.js';
import { buildWriterRegistry, resolveRepoVisibility } from '../tracker-sync/clients.js';
import { readTicketBridgeConfig } from '../tracker-sync/config.js';
import { parseResults } from '../tracker-sync/contract.js';
import { readCorpus } from '../tracker-sync/corpus.js';
import {
  SUPPORTED_PROVIDERS,
  syncTracker,
  type SyncTrackerDependencies,
  type TicketBridgeConfig,
} from '../tracker-sync/index.js';
import { computePlan } from '../tracker-sync/plan.js';
import { loadTrackerMap, TrackerMap } from '../tracker-sync/tracker-map.js';
import type { Provider } from '../tracker-sync/types.js';

export interface SyncTrackerCommandOptions {
  resetTrackerMap?: boolean;
  /** Emit the sync plan as JSON to stdout (offline); mutually exclusive with applyResults. */
  plan?: boolean;
  /** Path to an executor's results file to fold into the tracker-map (offline). */
  applyResults?: string;
}

const sidecarPathFor = (cwd: string): string => `${cwd}/.safeword/tracker-map.json`;

/** `--plan`: compute the sync plan offline and write it as JSON to stdout only. */
function runPlan(cwd: string, config: TicketBridgeConfig): void {
  const tickets = readCorpus(cwd, config.target?.repo);
  const loaded = loadTrackerMap(sidecarPathFor(cwd));
  const map = loaded.ok ? loaded.map : new TrackerMap();
  const plan = computePlan({ tickets, map, bodyMode: config.body ?? 'minimal' });
  process.stdout.write(`${JSON.stringify(plan, undefined, 2)}\n`);
}

/** `--apply-results <file>`: fold an executor's results into the sidecar offline. */
function runApply(cwd: string, config: TicketBridgeConfig, filePath: string): void {
  const provider = SUPPORTED_PROVIDERS.has(config.provider as Provider)
    ? (config.provider as Provider)
    : undefined;
  if (provider === undefined) {
    fail('no tracker provider is configured');
    return;
  }
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    fail(`cannot read results file ${filePath}`);
    return;
  }
  const parsed = parseResults(raw);
  if (!parsed.ok) {
    fail(parsed.reason);
    return;
  }

  const sidecarPath = sidecarPathFor(cwd);
  const loaded = loadTrackerMap(sidecarPath);
  if (!loaded.ok && loaded.reason === 'corrupt') {
    fail(`${sidecarPath} is corrupt`);
    return;
  }
  const map = loaded.ok ? loaded.map : new TrackerMap();

  const ticketIds = new Set(readCorpus(cwd, config.target?.repo).map(ticket => ticket.id));
  const outcome = applyResults(map, parsed.value, { provider, ticketIds });
  if (!outcome.ok) {
    fail(outcome.reason);
    return;
  }
  map.save(sidecarPath);
}

/** Report a `--plan`/`--apply-results` failure to stderr and set exit code 1. */
function fail(reason: string): void {
  process.stderr.write(`sync-tracker: ${reason}.\n`);
  process.exitCode = 1;
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
  // Offline flag paths — no credential, no live writer. Mutually exclusive.
  if (options.plan === true && options.applyResults !== undefined) {
    fail('--plan and --apply-results are mutually exclusive');
    return;
  }

  const cwd = process.cwd();
  const config = readTicketBridgeConfig(cwd);
  if (options.plan === true) {
    runPlan(cwd, config);
    return;
  }
  if (options.applyResults !== undefined) {
    runApply(cwd, config, options.applyResults);
    return;
  }

  // No flag → the live one-way projection (unchanged gh/Linear path).
  await runLiveSync(cwd, config, options);
}

async function runLiveSync(
  cwd: string,
  config: TicketBridgeConfig,
  options: SyncTrackerCommandOptions,
): Promise<void> {
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
