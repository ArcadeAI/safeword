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
import { loadTrackerMap, TrackerMap } from '../tracker-sync/tracker-map.js';
import type { IssuePayload, Provider, TrackerReference } from '../tracker-sync/types.js';
import type { TrackerWriter } from '../tracker-sync/writers.js';
import type { IdMinter } from '../utils/id-minter.js';
import {
  createIssueFirstTicket,
  createTicket,
  type NewTicketResult,
} from '../utils/ticket-writer.js';
import { resolveCreationMode } from './ticket-creation-mode.js';
import { buildIdentitySource } from './ticket-identity.js';

export interface RoutedTicketOptions {
  slug: string;
  type?: 'patch' | 'task' | 'feature';
  title?: string;
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
  const mode = resolveCreationMode(dependencies.config, { issue: options.issue });
  const ticketOptions = { slug: options.slug, type: options.type, title: options.title };

  if (mode.mode === 'local') {
    return createTicket(cwd, dependencies.minter, ticketOptions);
  }

  const provider = dependencies.config.provider as Provider;
  const writer = dependencies.buildWriter(provider, dependencies.config.target);
  const identity = buildIdentitySource(mode, writer, buildMinimalPayload(options));
  const result = await createIssueFirstTicket(cwd, ticketOptions, identity);
  if (result.ref !== undefined) recordReference(cwd, result.id, result.ref);
  return result;
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

/** Persist the created ref so a later `sync-tracker` reconciles instead of double-creating. */
function recordReference(cwd: string, id: string, ref: TrackerReference): void {
  const safewordDirectory = nodePath.join(cwd, '.safeword');
  if (!existsSync(safewordDirectory)) mkdirSync(safewordDirectory, { recursive: true });
  const sidecarPath = nodePath.join(safewordDirectory, 'tracker-map.json');
  const loaded = loadTrackerMap(sidecarPath);
  const map = loaded.ok ? loaded.map : new TrackerMap();
  map.record(id, ref);
  map.save(sidecarPath);
}
