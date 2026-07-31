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

/** `--plan`: compute the sync plan offline and write it as JSON to stdout only. */
function runPlan(cwd: string, config: TicketBridgeConfig): void {
  // Provider parity with the live path (#1441): an unconfigured project is a
  // friendly no-op there, so planning must not hand an executor an all-`create`
  // plan for a tracker nobody configured. Emit an empty (but valid) plan so
  // `--plan | executor` pipelines still receive a parseable document, and put the
  // notice on stderr — stdout stays a pure SyncPlan.
  const provider = supportedProvider(config.provider);
  if (provider === undefined) {
    note('no tracker configured; planning nothing (run `safeword connect` to add one)');
    process.stdout.write(`${JSON.stringify(emptyPlan(), undefined, 2)}\n`);
    return;
  }
  // One body-mode binding for both the advisory and the plan, so the advisory is
  // provably about the same bodies the plan was built with.
  const bodyMode = config.body ?? 'minimal';
  // Egress parity with the live path (#1441): a `full` body projects ticket bodies,
  // and the plan carries them in a file an executor may pipe or store. The live
  // path's fail-safe warns unless the repo is *confirmed* private; confirming that
  // shells out to `gh`, which planning must not do — so an unconfirmed repo warns,
  // exactly as the live path does when visibility is unknown.
  if (bodyMode === 'full' && provider === 'github') {
    note(
      '⚠️  Egress warning: this plan carries full ticket bodies for a GitHub repo whose ' +
        'visibility was not confirmed (planning stays offline and cannot check)',
    );
  }

  const sidecarPath = trackerMapPath(cwd);
  const loaded = loadTrackerMapOrEmpty(sidecarPath);
  // Mirrors `runApply`. Only *corrupt* refuses: a missing sidecar is the
  // legitimate first run.
  if (!loaded.ok) {
    fail(`${sidecarPath} is corrupt; refusing to plan against it (every ticket would re-create)`);
    return;
  }
  const tickets = readCorpus(cwd, config.target?.repo);
  const plan = computePlan({ tickets, map: loaded.map, bodyMode });
  process.stdout.write(`${JSON.stringify(plan, undefined, 2)}\n`);
}

/** `--apply-results <file>`: fold an executor's results into the sidecar offline. */
function runApply(cwd: string, config: TicketBridgeConfig, filePath: string): void {
  const provider = supportedProvider(config.provider);
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

  const sidecarPath = trackerMapPath(cwd);
  const loaded = loadTrackerMapOrEmpty(sidecarPath);
  if (!loaded.ok) {
    fail(`${sidecarPath} is corrupt`);
    return;
  }

  const ticketIds = new Set(readCorpus(cwd, config.target?.repo).map(ticket => ticket.id));
  const outcome = applyResults(loaded.map, parsed.value, { provider, ticketIds });
  if (!outcome.ok) {
    fail(outcome.reason);
    return;
  }
  loaded.map.save(sidecarPath);
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
 * Resolve the credential GitHub CLI already keeps in the OS credential store.
 * The value is used only for the orchestrator's preflight; live GitHub writes
 * continue through `gh`, which resolves the same credential itself.
 */
function keychainCredential(provider: Provider): string | undefined {
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
    keychain: keychainCredential,
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
