/**
 * The idempotency sidecar (`.safeword/tracker-map.json`) — the data + decision
 * layer for sync-tracker (JS5K5G AC5/AC6/AC8/AC9). Kept out of ticket frontmatter
 * so the canonical files stay pure. Distinguishes a created+recorded ref from a
 * created-but-pending one so a crash mid-corpus resumes cleanly rather than
 * double-creating. Pure over the file — no network here.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import type { TrackerReference } from './types.js';

const SIDECAR_VERSION = 1;

/** Per-ticket record. `pending` = created but not yet confirmed recorded. */
export interface TrackerMapEntry {
  ref: TrackerReference;
  status: 'recorded' | 'pending';
}

interface SerializedMap {
  version: number;
  issues: Record<string, TrackerMapEntry>;
}

/** The action the orchestrator should take for a ticket, decided from its state. */
export type SyncAction =
  | { kind: 'create' }
  | { kind: 'update'; ref: TrackerReference }
  | { kind: 'reconcile'; ref: TrackerReference };

/** In-memory view of the sidecar. */
export class TrackerMap {
  private readonly issues: Map<string, TrackerMapEntry>;

  constructor(issues?: Map<string, TrackerMapEntry>) {
    this.issues = issues ?? new Map();
  }

  lookup(ticketId: string): TrackerMapEntry | undefined {
    return this.issues.get(ticketId);
  }

  /** Mark a created issue whose ref is captured but not yet confirmed. */
  markPending(ticketId: string, ref: TrackerReference): void {
    this.issues.set(ticketId, { ref, status: 'pending' });
  }

  /** Record a confirmed ref (promotes a prior pending entry). */
  record(ticketId: string, ref: TrackerReference): void {
    this.issues.set(ticketId, { ref, status: 'recorded' });
  }

  serialize(): SerializedMap {
    return { version: SIDECAR_VERSION, issues: Object.fromEntries(this.issues) };
  }

  save(filePath: string): void {
    writeFileSync(filePath, `${JSON.stringify(this.serialize(), undefined, 2)}\n`);
  }
}

/** Load the sidecar, distinguishing absent (missing) from unparseable (corrupt). */
export function loadTrackerMap(
  filePath: string,
): { ok: true; map: TrackerMap } | { ok: false; reason: 'missing' | 'corrupt' } {
  if (!existsSync(filePath)) return { ok: false, reason: 'missing' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  if (typeof parsed !== 'object' || parsed === null || !('issues' in parsed)) {
    return { ok: false, reason: 'corrupt' };
  }
  const issues = (parsed as SerializedMap).issues;
  if (typeof issues !== 'object' || issues === null) return { ok: false, reason: 'corrupt' };
  return { ok: true, map: new TrackerMap(new Map(Object.entries(issues))) };
}

/**
 * Decide create vs update vs reconcile for a ticket: absent → create (AC5);
 * recorded → update with the existing ref (AC6); pending → reconcile to the
 * existing issue without a second create (AC8).
 */
export function planTicketSync(map: TrackerMap, ticketId: string): SyncAction {
  const entry = map.lookup(ticketId);
  if (entry === undefined) return { kind: 'create' };
  if (entry.status === 'pending') return { kind: 'reconcile', ref: entry.ref };
  return { kind: 'update', ref: entry.ref };
}
