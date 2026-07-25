/**
 * The plan↔executor JSON contract for environment-portable tracker transport
 * (CBTDK8). `sync-tracker --plan` emits a `SyncPlan` to stdout; an executor
 * (agent via MCP, CI via token+REST, dev via `gh`) applies it and reports a
 * `SyncResults`; `sync-tracker --apply-results` folds those back into the
 * tracker-map. The schema is a one-way-door public contract — versioned from
 * day one, and `version` is independent of the sidecar's `SIDECAR_VERSION`.
 *
 * Intents reference an existing issue by `TrackerReference` (its `id` is the
 * issue number as a string). Results carry `number` as a **string** for the
 * same reason: `TrackerReference.id` is a string and the `gh` path records
 * `"549"`, so apply must store the identical shape or idempotency + byte-for-byte
 * parity break.
 */

import type { IssuePayload, TrackerReference } from './types.js';

/** The current contract version. Bump on any incompatible shape change. */
export const PLAN_CONTRACT_VERSION = 1;

/** Graph edges expressed by **ticket id** (a new issue's number isn't known pre-create). */
export interface GraphEdges {
  parentTicketId?: string;
  blockedByTicketIds?: string[];
}

/** Create a new issue. `payload.state` may be `open` or `closed` (terminal never-synced). */
export interface CreateIntent {
  kind: 'create';
  ticketId: string;
  payload: IssuePayload;
  graph?: GraphEdges;
}

/** Update an existing issue's fields (open state). */
export interface UpdateIntent {
  kind: 'update';
  ticketId: string;
  ref: TrackerReference;
  payload: IssuePayload;
  graph?: GraphEdges;
}

/**
 * Close an existing issue. Carries the **full** payload (+ graph) — the `gh` path
 * has no field-less close (it `update`s fields and `projectGraph`s on a closing
 * ticket in one pass), so a close that dropped them would leave title/labels/edges
 * stale versus `gh`. `stateReason` is an optional richer-than-`gh` nicety.
 */
export interface CloseIntent {
  kind: 'close';
  ticketId: string;
  ref: TrackerReference;
  payload: IssuePayload;
  graph?: GraphEdges;
  stateReason?: string;
}

export type Intent = CreateIntent | UpdateIntent | CloseIntent;

/** What `--plan` emits to stdout. */
export interface SyncPlan {
  version: number;
  intents: Intent[];
}

/** One executor outcome. `number` is the bare issue number as a string (e.g. `"549"`). */
export interface SyncResult {
  ticketId: string;
  number: string;
  url: string;
  /** Optional executor status/ack (e.g. `created` / `updated` / `closed`). */
  status?: string;
}

/** What an executor produces and `--apply-results` consumes. */
export interface SyncResults {
  version: number;
  results: SyncResult[];
}
