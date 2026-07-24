/**
 * Route `ticket new` between the local-id path and issue-first creation (KKNFZA
 * TB1). provider:none → the local minter (today's behavior, no tracker client
 * built). A configured GitHub/Linear provider → mint identity from the tracker
 * (create, or adopt an existing key), key the folder to it, and record the ref
 * in the tracker-map so a later sync updates rather than double-creates. A mint
 * failure propagates before any folder is written, so creation degrades safely
 * with no orphan. The writer factory is injected — the only network boundary.
 */

import { existsSync, mkdirSync } from 'node:fs';
import nodePath from 'node:path';

import type { TicketBridgeConfig } from '../tracker-sync/index.js';
import { loadTrackerMap, TrackerMap, trackerMapPath } from '../tracker-sync/tracker-map.js';
import type { IssuePayload, Provider, TrackerReference } from '../tracker-sync/types.js';
import type { TrackerWriter } from '../tracker-sync/writers.js';
import type { IdMinter } from '../utils/id-minter.js';
import {
  createIssueFirstTicket,
  createTicket,
  type NewTicketResult,
  type TicketType,
} from '../utils/ticket-writer.js';
import { resolveCreationMode } from './creation-mode.js';
import { buildIdentitySource } from './identity.js';

export interface RoutedTicketOptions {
  slug: string;
  type?: TicketType;
  title?: string;
  /** One-line Goal; fills the `**Goal:**` field instead of a placeholder. */
  goal?: string;
  /** One-line Why; fills `**Why:**` for task/patch/epic (rejected for features upstream). */
  why?: string;
  /** Epic id this ticket is a child of; written as `parent:` frontmatter. */
  parent?: string;
  /** Adopt an existing tracker issue instead of creating one. */
  issue?: string;
}

export interface TicketCreationDependencies {
  config: TicketBridgeConfig;
  /** Build the writer for the configured provider (injected = the network seam). */
  buildWriter: (provider: Provider, target: { repo?: string } | undefined) => TrackerWriter;
  minter: IdMinter;
}

export async function createTicketRouted(
  cwd: string,
  options: RoutedTicketOptions,
  dependencies: TicketCreationDependencies,
): Promise<NewTicketResult> {
  const mode = resolveCreationMode(dependencies.config, {
    issue: options.issue,
    type: options.type,
  });
  const ticketOptions = {
    slug: options.slug,
    type: options.type,
    title: options.title,
    goal: options.goal,
    why: options.why,
    parent: options.parent,
  };

  if (mode.mode === 'local') {
    return createTicket(cwd, dependencies.minter, ticketOptions);
  }

  // Refuse to proceed against a corrupt sidecar BEFORE minting an issue — silently
  // resetting it would wipe other tickets' recorded refs (matches the orchestrator's
  // refusal). A missing sidecar is the legitimate first run.
  assertSidecarUsable(cwd);

  const provider = dependencies.config.provider as Provider;
  const writer = dependencies.buildWriter(provider, dependencies.config.target);
  const identity = buildIdentitySource(mode, writer, buildMinimalPayload(options));
  // For `create`, persist a `pending` ref before the folder is written, then promote
  // to `recorded` after — a folder on disk always has a map entry, so a later sync
  // reconciles instead of double-creating. `adopt` writes nothing before the folder:
  // the issue pre-exists (no create to be crash-unsafe about), and an early pending
  // write would downgrade an existing `recorded` entry on an adopt-collision.
  const result = await createIssueFirstTicket(cwd, ticketOptions, identity, minted => {
    if (mode.mode === 'create' && minted.ref !== undefined) {
      writeReference(cwd, minted.id, minted.ref, 'pending');
    }
  });
  if (result.ref !== undefined) writeReference(cwd, result.id, result.ref, 'recorded');
  return result;
}

/** Refuse on a corrupt sidecar (a missing one is fine — the first tracker-backed ticket). */
function assertSidecarUsable(cwd: string): void {
  const sidecarPath = trackerMapPath(cwd);
  const loaded = loadTrackerMap(sidecarPath);
  if (!loaded.ok && loaded.reason === 'corrupt') {
    throw new Error(
      `${sidecarPath} is corrupt; refusing to overwrite it. Resolve or remove it before creating a tracker-backed ticket.`,
    );
  }
}

/** Minimal issue payload for a brand-new ticket — title + a back-pointer + the type label. */
function buildMinimalPayload(options: RoutedTicketOptions): IssuePayload {
  const type = options.type ?? 'task';
  return {
    title: options.title ?? options.slug,
    body: `safeword ticket: ${options.slug}`,
    issueType: type,
    labels: [`type:${type}`],
    state: 'open',
  };
}

/**
 * Persist the ref in the tracker-map so a later `sync-tracker` reconciles instead
 * of double-creating. `pending` is written before the folder (crash-safety),
 * `recorded` promotes it after the ticket lands.
 */
function writeReference(
  cwd: string,
  id: string,
  ref: TrackerReference,
  status: 'pending' | 'recorded',
): void {
  const safewordDirectory = nodePath.join(cwd, '.safeword');
  if (!existsSync(safewordDirectory)) mkdirSync(safewordDirectory, { recursive: true });
  const sidecarPath = trackerMapPath(cwd);
  const loaded = loadTrackerMap(sidecarPath);
  const map = loaded.ok ? loaded.map : new TrackerMap();
  if (status === 'pending') map.markPending(id, ref);
  else map.record(id, ref);
  map.save(sidecarPath);
}
