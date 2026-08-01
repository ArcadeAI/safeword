/**
 * `safeword sync-tracker` — project the local ticket corpus one-way into the
 * configured tracker (JS5K5G). Thin wrapper: read config, resolve the credential,
 * walk the corpus, build the live writer, and hand it all to the pure
 * orchestrator. Network runs only here / in CI, never in the per-turn loop.
 */

import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';

import { applyResults } from '../tracker-sync/apply-results.js';
import { buildWriterRegistry, resolveRepoVisibility } from '../tracker-sync/clients.js';
import { readTicketBridgeConfig } from '../tracker-sync/config.js';
import { emptyPlan, parseResults } from '../tracker-sync/contract.js';
import { readCorpus } from '../tracker-sync/corpus.js';
import {
  supportedProvider,
  syncTracker,
  type SyncTrackerDependencies,
  type TicketBridgeConfig,
} from '../tracker-sync/index.js';
import { computePlan } from '../tracker-sync/plan.js';
import { loadTrackerMapOrEmpty, trackerMapPath } from '../tracker-sync/tracker-map.js';
import type { Provider } from '../tracker-sync/types.js';
import { resolveGhCliToken } from '../utils/gh-cli.js';

export interface SyncTrackerCommandOptions {
  resetTrackerMap?: boolean;
  /** Emit the sync plan as JSON to stdout (offline); mutually exclusive with applyResults. */
  plan?: boolean;
  /** Path to an executor's results file to fold into the tracker-map (offline). */
  applyResults?: string;
}

export type OfflineTrackerResult =
  | {
      readonly ok: true;
      readonly mode: 'plan';
      readonly provider: Provider | undefined;
      readonly plan: ReturnType<typeof emptyPlan>;
      readonly messages: readonly string[];
    }
  | {
      readonly ok: true;
      readonly mode: 'apply';
      readonly provider: Provider;
      readonly changed: boolean;
      readonly messages: readonly string[];
    }
  | {
      readonly ok: false;
      readonly mode: 'plan' | 'apply';
      readonly reason: string;
      readonly messages: readonly string[];
    };

/** Compute an executor plan without network access or process-level output. */
export function planTrackerSync(cwd: string, config: TicketBridgeConfig): OfflineTrackerResult {
  const provider = supportedProvider(config.provider);
  if (provider === undefined) {
    return {
      ok: true,
      mode: 'plan',
      provider,
      plan: emptyPlan(),
      messages: [
        'no tracker configured; planning nothing (run `safeword tracker connect` to add one)',
      ],
    };
  }
  const messages: string[] = [];
  const bodyMode = config.body ?? 'minimal';
  if (bodyMode === 'full' && provider === 'github') {
    messages.push(
      'Egress warning: this plan carries full ticket bodies for a GitHub repo whose visibility was not confirmed',
    );
  }
  const sidecarPath = trackerMapPath(cwd);
  const loaded = loadTrackerMapOrEmpty(sidecarPath);
  if (!loaded.ok) {
    return {
      ok: false,
      mode: 'plan',
      reason: `${sidecarPath} is corrupt; refusing to plan against it`,
      messages,
    };
  }
  return {
    ok: true,
    mode: 'plan',
    provider,
    plan: computePlan({
      tickets: readCorpus(cwd, config.target?.repo),
      map: loaded.map,
      bodyMode,
    }),
    messages,
  };
}

/** Fold executor results into the sidecar without network access or process-level output. */
export function applyTrackerSyncResults(
  cwd: string,
  config: TicketBridgeConfig,
  filePath: string,
): OfflineTrackerResult {
  const provider = supportedProvider(config.provider);
  if (provider === undefined) {
    return { ok: false, mode: 'apply', reason: 'no tracker provider is configured', messages: [] };
  }
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    return {
      ok: false,
      mode: 'apply',
      reason: `cannot read results file ${filePath}`,
      messages: [],
    };
  }
  const parsed = parseResults(raw);
  if (!parsed.ok) return { ok: false, mode: 'apply', reason: parsed.reason, messages: [] };

  const sidecarPath = trackerMapPath(cwd);
  const loaded = loadTrackerMapOrEmpty(sidecarPath);
  if (!loaded.ok) {
    return { ok: false, mode: 'apply', reason: `${sidecarPath} is corrupt`, messages: [] };
  }
  const before = existsSync(sidecarPath) ? readFileSync(sidecarPath, 'utf8') : undefined;
  const ticketIds = new Set(readCorpus(cwd, config.target?.repo).map(ticket => ticket.id));
  const outcome = applyResults(loaded.map, parsed.value, { provider, ticketIds });
  if (!outcome.ok) return { ok: false, mode: 'apply', reason: outcome.reason, messages: [] };
  loaded.map.save(sidecarPath);
  const after = readFileSync(sidecarPath, 'utf8');
  return { ok: true, mode: 'apply', provider, changed: before !== after, messages: [] };
}

/** `--plan`: compute the sync plan offline and write it as JSON to stdout only. */
function runPlan(cwd: string, config: TicketBridgeConfig): void {
  const result = planTrackerSync(cwd, config);
  for (const message of result.messages) note(message);
  if (!result.ok) {
    fail(result.reason);
    return;
  }
  if (result.mode !== 'plan') {
    fail('internal tracker planning mode mismatch');
    return;
  }
  process.stdout.write(`${JSON.stringify(result.plan, undefined, 2)}\n`);
}

/** `--apply-results <file>`: fold an executor's results into the sidecar offline. */
function runApply(cwd: string, config: TicketBridgeConfig, filePath: string): void {
  const result = applyTrackerSyncResults(cwd, config, filePath);
  if (!result.ok) fail(result.reason);
}

/** An advisory on stderr — never stdout, which must stay a pure SyncPlan document. */
function note(message: string): void {
  process.stderr.write(`sync-tracker: ${message}.\n`);
}

/**
 * Report a `--plan`/`--apply-results` failure to stderr and set exit code 1.
 * Unlike the sibling commands' `fail(): never`, this returns (so each caller pairs
 * it with a `return`): the offline flags are driven in-process by tests that assert
 * `process.exitCode`, and `process.exit` would take the test runner down with it.
 */
function fail(reason: string): void {
  note(reason);
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

/**
 * Resolve the credential GitHub CLI would use after excluding the caller's
 * `GITHUB_TOKEN`. This may come from `GH_TOKEN` or the OS credential store. The
 * value is used only for the orchestrator's preflight; live GitHub writes let
 * `gh` choose from the original environment and stored credentials using its
 * normal precedence.
 */
function ghCliCredential(provider: Provider): string | undefined {
  if (provider !== 'github') return undefined;
  return resolveGhCliToken(process.env);
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
  const provider = supportedProvider(config.provider);
  const dependencies: SyncTrackerDependencies = {
    config,
    tickets: provider === undefined ? [] : readCorpus(cwd, config.target?.repo),
    sidecarPath: trackerMapPath(cwd),
    writers:
      provider === undefined
        ? ({} as SyncTrackerDependencies['writers'])
        : buildWriterRegistry(provider, config.target),
    env: process.env,
    keychain: ghCliCredential,
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
