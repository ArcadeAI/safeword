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
interface CreateIntent {
  kind: 'create';
  ticketId: string;
  payload: IssuePayload;
  graph?: GraphEdges;
}

/** Update an existing issue's fields (open state). */
interface UpdateIntent {
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
interface CloseIntent {
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
interface SyncResult {
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

/** Structural parse outcome for a results document (a discriminated result). */
export type ParseOutcome = { ok: true; value: SyncResults } | { ok: false; reason: string };

type RowOutcome = { ok: true; value: SyncResult } | { ok: false; reason: string };

/** Validate one results row into a `SyncResult` (string ticketId, number, url required). */
function parseResultRow(raw: unknown, index: number): RowOutcome {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, reason: `result ${index} is not an object` };
  }
  const row = raw as Record<string, unknown>;
  if (typeof row.ticketId !== 'string' || row.ticketId.length === 0) {
    return { ok: false, reason: `result ${index} is missing a ticketId` };
  }
  if (typeof row.number !== 'string' || row.number.length === 0) {
    return { ok: false, reason: `result "${row.ticketId}" is missing an issue number` };
  }
  if (typeof row.url !== 'string' || row.url.length === 0) {
    return { ok: false, reason: `result "${row.ticketId}" is missing an issue url` };
  }
  return {
    ok: true,
    value: {
      ticketId: row.ticketId,
      number: row.number,
      url: row.url,
      ...(typeof row.status === 'string' && { status: row.status }),
    },
  };
}

/**
 * Structurally validate a results JSON document: valid JSON, a supported
 * `version`, and a `results` array whose every row has string `ticketId`,
 * `number`, and `url`. Semantic checks (corpus membership, url-tail==number)
 * live in `applyResults`.
 */
export function parseResults(jsonText: string): ParseOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, reason: 'results file is not valid JSON' };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, reason: 'results must be a JSON object' };
  }
  const document_ = parsed as { version?: unknown; results?: unknown };
  if (document_.version !== PLAN_CONTRACT_VERSION) {
    return {
      ok: false,
      reason: `unsupported results version ${String(document_.version)} (expected ${PLAN_CONTRACT_VERSION})`,
    };
  }
  if (!Array.isArray(document_.results)) {
    return { ok: false, reason: 'results must be an array' };
  }
  const rows: SyncResult[] = [];
  for (const [index, raw] of document_.results.entries()) {
    const row = parseResultRow(raw, index);
    if (!row.ok) return row;
    rows.push(row.value);
  }
  return { ok: true, value: { version: PLAN_CONTRACT_VERSION, results: rows } };
}
