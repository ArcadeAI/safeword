/**
 * The sync-tracker orchestrator — the single call site that projects the ticket
 * corpus one-way into the configured tracker (JS5K5G). Pure over injected deps
 * (writers, env, sidecar path, clock, log sink) so the whole pipe is unit-tested
 * with fakes; the CLI command (commands/sync-tracker.ts) supplies the real
 * corpus walk, clients, and fs. Network never enters the per-turn loop — this
 * runs only on the explicit command / CI.
 */

import { withBackoff } from './backoff.js';
import { buildPayload } from './payload.js';
import { resolveCredential } from './secrets.js';
import { loadTrackerMap, planTicketSync, TrackerMap } from './tracker-map.js';
import type { BodyMode, Provider, TicketInput } from './types.js';
import { dispatchCreate, type TrackerWriter } from './writers.js';

const SUPPORTED_PROVIDERS = new Set<Provider>(['linear', 'github']);
const BACKOFF = { maxRetries: 3, baseMs: 50 };

export interface TicketBridgeConfig {
  /** `none`, `linear`, `github`, or any unsupported string (treated as none). */
  provider: string;
  body?: BodyMode;
  target?: { workspace?: string; team?: string; repo?: string };
  defaultAssignee?: string;
}

export interface SyncTrackerDependencies {
  config: TicketBridgeConfig;
  tickets: TicketInput[];
  sidecarPath: string;
  writers: Record<Provider, TrackerWriter>;
  env: Record<string, string | undefined>;
  keychain?: (provider: Provider) => string | undefined;
  sleep?: (ms: number) => Promise<void>;
  log: (message: string) => void;
  resetTrackerMap?: boolean;
  nonInteractive?: boolean;
  arcadeUserId?: string;
  repoVisibility?: 'public' | 'private';
}

export interface SyncTrackerResult {
  exitCode: number;
}

/** Narrow a configured provider to a supported one, else undefined. */
function supportedProvider(provider: string): Provider | undefined {
  return SUPPORTED_PROVIDERS.has(provider as Provider) ? (provider as Provider) : undefined;
}

/** Pre-write advisories that don't block the run: CI auth (AC12) + egress (AC10). */
function emitAdvisories(
  dependencies: SyncTrackerDependencies,
  provider: Provider,
  bodyMode: BodyMode,
): void {
  if (dependencies.nonInteractive === true && dependencies.arcadeUserId !== undefined) {
    dependencies.log(
      'Warning: Arcade-User-ID is a user identity, not a service account — sync can fail ' +
        'silently if its OAuth grant lapses. Use a dedicated service identity for CI.',
    );
  }
  if (bodyMode === 'full' && provider === 'github' && dependencies.repoVisibility === 'public') {
    dependencies.log('⚠️  Egress warning: projecting full ticket bodies to a PUBLIC GitHub repo.');
  }
}

/**
 * Load the sidecar, or refuse (AC9). A reset starts from an empty map; otherwise
 * a missing/corrupt sidecar on a configured project never blind-recreates.
 */
function loadSidecarOrRefuse(
  dependencies: SyncTrackerDependencies,
): { ok: true; map: TrackerMap } | { ok: false; exitCode: number } {
  if (dependencies.resetTrackerMap === true) return { ok: true, map: new TrackerMap() };
  const loaded = loadTrackerMap(dependencies.sidecarPath);
  if (loaded.ok) return { ok: true, map: loaded.map };
  dependencies.log(
    `Tracker-map sidecar is ${loaded.reason}. Refusing to recreate issues blindly — ` +
      'pass --reset-tracker-map to rebuild it.',
  );
  return { ok: false, exitCode: 1 };
}

/**
 * Project one ticket: create (AC5), update (AC6), or reconcile (AC8). Persists
 * the sidecar per ticket so a mid-corpus crash never strands a just-created
 * issue out of the map: on create the ref is marked `pending` and saved BEFORE
 * the in-memory record, so a crash before completion leaves a pending entry the
 * next run reconciles (AC8) instead of double-creating.
 */
async function projectOne(args: {
  ticket: TicketInput;
  map: TrackerMap;
  provider: Provider;
  writers: Record<Provider, TrackerWriter>;
  bodyMode: BodyMode;
  sleep: (ms: number) => Promise<void>;
  sidecarPath: string;
}): Promise<void> {
  const payload = buildPayload(args.ticket, { bodyMode: args.bodyMode });
  const action = planTicketSync(args.map, args.ticket.id);
  const backoff = { sleep: args.sleep, ...BACKOFF };
  if (action.kind === 'create') {
    const ref = await withBackoff(
      () => dispatchCreate(args.writers, args.provider, payload),
      backoff,
    );
    // Persist the ref as pending the instant the issue exists, then promote.
    args.map.markPending(args.ticket.id, ref);
    args.map.save(args.sidecarPath);
    args.map.record(args.ticket.id, ref);
    args.map.save(args.sidecarPath);
    return;
  }
  // update (AC6) and reconcile (AC8) both write outward only — no second create.
  if (action.kind === 'reconcile') args.map.record(args.ticket.id, action.ref);
  await withBackoff(() => args.writers[args.provider].update(action.ref, payload), backoff);
  args.map.save(args.sidecarPath);
}

export async function syncTracker(
  dependencies: SyncTrackerDependencies,
): Promise<SyncTrackerResult> {
  const { config, log } = dependencies;

  // AC1 — none (or anything unsupported) is a friendly no-op.
  const provider = supportedProvider(config.provider);
  if (provider === undefined) {
    log('No tracker configured; run `safeword setup` to add one.');
    return { exitCode: 0 };
  }

  // AC2 — a configured provider with no resolvable credential fails loudly.
  if (!resolveCredential(provider, { env: dependencies.env, keychain: dependencies.keychain }).ok) {
    log(`No ${provider} credential resolved — set the token in your keychain or env. Aborting.`);
    return { exitCode: 1 };
  }

  const bodyMode: BodyMode = config.body ?? 'minimal';
  emitAdvisories(dependencies, provider, bodyMode);

  const sidecar = loadSidecarOrRefuse(dependencies);
  if (!sidecar.ok) return { exitCode: sidecar.exitCode };

  const sleep =
    dependencies.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  for (const ticket of dependencies.tickets) {
    // Each ticket persists itself; a failure aborts the run but earlier
    // creates are already saved (resume re-projects only the unfinished ones).
    await projectOne({
      ticket,
      map: sidecar.map,
      provider,
      writers: dependencies.writers,
      bodyMode,
      sleep,
      sidecarPath: dependencies.sidecarPath,
    });
  }
  return { exitCode: 0 };
}
