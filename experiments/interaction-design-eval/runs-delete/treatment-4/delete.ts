/**
 * Bulk-delete feature for an admin web app.
 *
 * Deleting many records at once is destructive and hard to undo, so this module
 * is built around keeping the admin in control of a delegated action:
 *
 *   1. Evaluation   — a dry-run / preview endpoint shows exactly which records
 *                     a filter matches BEFORE anything is deleted, including a
 *                     count, a sample, and a fingerprint of the matched set.
 *   2. Interrupt    — the filter is explicit and scoped; a `limit` cap and a
 *                     required, non-empty match set stop a filter that would
 *                     sweep more (or less) than intended. An empty match is
 *                     refused rather than silently doing nothing.
 *   3. Confirmation — commit requires a confirmation token derived from the
 *                     previewed set. If the data changed since preview, the
 *                     token no longer matches and the delete is rejected, so
 *                     the admin can only commit the set they actually reviewed.
 *   4. Recovery     — deletes are SOFT: records are tombstoned with an audit
 *                     record and can be restored. A restore endpoint undoes a
 *                     specific bulk operation. Nothing fails silently — every
 *                     path returns a structured, inspectable result.
 *
 * Stack: TypeScript. In-memory store, framework-agnostic route handlers that
 * take a plain request object and return a plain response object.
 */

// ---------------------------------------------------------------------------
// Domain model
// ---------------------------------------------------------------------------

export interface Record {
  id: string;
  status: string;
  createdAt: number; // epoch ms
  // arbitrary payload
  [key: string]: unknown;
}

export interface Filter {
  /** Match records with createdAt strictly older than this epoch-ms timestamp. */
  olderThan?: number;
  /** Match records whose status is exactly this value. */
  status?: string;
  /**
   * Safety cap. If the filter matches more than this many records, preview and
   * commit both refuse. Forces the admin to widen deliberately, not by accident.
   * Defaults to a conservative value.
   */
  limit?: number;
}

const DEFAULT_LIMIT = 1000;

interface Tombstone {
  record: Record;
  deletedAt: number;
  operationId: string;
  deletedBy: string;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export class RecordStore {
  private records = new Map<string, Record>();
  private tombstones = new Map<string, Tombstone>();
  /** operationId -> ids affected, for scoped undo. */
  private operations = new Map<
    string,
    { ids: string[]; deletedBy: string; at: number; filter: Filter }
  >();

  seed(records: Record[]): void {
    for (const r of records) this.records.set(r.id, { ...r });
  }

  all(): Record[] {
    return [...this.records.values()];
  }

  /** Live records (not tombstoned) matching the filter, capped defensively. */
  match(filter: Filter): Record[] {
    const out: Record[] = [];
    for (const r of this.records.values()) {
      if (filter.olderThan !== undefined && !(r.createdAt < filter.olderThan)) continue;
      if (filter.status !== undefined && r.status !== filter.status) continue;
      out.push(r);
    }
    // Stable order so the fingerprint is deterministic.
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  softDelete(ids: string[], operationId: string, deletedBy: string, filter: Filter): Record[] {
    const removed: Record[] = [];
    const now = Date.now();
    for (const id of ids) {
      const rec = this.records.get(id);
      if (!rec) continue;
      this.records.delete(id);
      this.tombstones.set(id, { record: rec, deletedAt: now, operationId, deletedBy });
      removed.push(rec);
    }
    this.operations.set(operationId, { ids: removed.map(r => r.id), deletedBy, at: now, filter });
    return removed;
  }

  restoreOperation(operationId: string): Record[] {
    const op = this.operations.get(operationId);
    if (!op) return [];
    const restored: Record[] = [];
    for (const id of op.ids) {
      const tomb = this.tombstones.get(id);
      if (!tomb) continue; // already restored or overwritten
      this.tombstones.delete(id);
      this.records.set(id, tomb.record);
      restored.push(tomb.record);
    }
    this.operations.delete(operationId);
    return restored;
  }

  getOperation(operationId: string) {
    return this.operations.get(operationId);
  }
}

// ---------------------------------------------------------------------------
// Filter validation + confirmation token
// ---------------------------------------------------------------------------

export function normalizeFilter(raw: unknown): Filter {
  if (raw === null || typeof raw !== 'object') {
    throw new BadRequest('filter must be an object');
  }
  const f = raw as Record;
  const filter: Filter = {};

  if (f.olderThan !== undefined) {
    const n = typeof f.olderThan === 'string' ? Date.parse(f.olderThan) : f.olderThan;
    if (typeof n !== 'number' || Number.isNaN(n))
      throw new BadRequest('olderThan must be a timestamp');
    filter.olderThan = n;
  }
  if (f.status !== undefined) {
    if (typeof f.status !== 'string' || f.status.length === 0)
      throw new BadRequest('status must be a non-empty string');
    filter.status = f.status;
  }
  if (f.limit !== undefined) {
    if (typeof f.limit !== 'number' || f.limit <= 0)
      throw new BadRequest('limit must be a positive number');
    filter.limit = f.limit;
  }

  // A filter with no predicates would match EVERYTHING. Refuse it: the admin
  // must state at least one condition on purpose.
  if (filter.olderThan === undefined && filter.status === undefined) {
    throw new BadRequest('filter must include at least one of: olderThan, status');
  }
  return filter;
}

/**
 * Deterministic fingerprint of the exact matched set (ids + filter). The commit
 * step requires the caller to echo the fingerprint it was shown at preview time.
 * If the underlying data shifted, the recomputed fingerprint differs and the
 * commit is rejected — so an admin can never delete a set they didn't review.
 */
export function fingerprint(filter: Filter, ids: string[]): string {
  const basis = JSON.stringify({
    olderThan: filter.olderThan ?? null,
    status: filter.status ?? null,
    ids: [...ids].sort(),
  });
  // Small, dependency-free stable hash (FNV-1a 32-bit) rendered hex.
  let h = 0x811c9dc5;
  for (let i = 0; i < basis.length; i++) {
    h ^= basis.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return 'cfm_' + (h >>> 0).toString(16).padStart(8, '0') + '_' + ids.length;
}

// ---------------------------------------------------------------------------
// Errors + HTTP-ish plumbing
// ---------------------------------------------------------------------------

class BadRequest extends Error {}
class Conflict extends Error {}

export interface HttpRequest {
  body?: unknown;
  params?: Record;
  /** Identity of the admin performing the action, from auth middleware. */
  actor?: string;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}

function ok(body: unknown): HttpResponse {
  return { status: 200, body };
}
function fail(status: number, message: string, extra?: object): HttpResponse {
  return { status, body: { error: message, ...extra } };
}

function handle(fn: () => HttpResponse): HttpResponse {
  try {
    return fn();
  } catch (e) {
    if (e instanceof BadRequest) return fail(400, e.message);
    if (e instanceof Conflict) return fail(409, e.message);
    return fail(500, 'internal error');
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export function createHandlers(store: RecordStore) {
  const SAMPLE_SIZE = 20;

  /**
   * POST /admin/bulk-delete/preview
   * Body: { filter }
   * Returns the count, a bounded sample, and the confirmation token WITHOUT
   * deleting anything. This is the "see before you act" step.
   */
  function preview(req: HttpRequest): HttpResponse {
    return handle(() => {
      const filter = normalizeFilter((req.body as Record)?.filter);
      const matched = store.match(filter);
      const cap = filter.limit ?? DEFAULT_LIMIT;

      if (matched.length === 0) {
        // Don't hand back a "commit nothing" token — surface it clearly.
        return fail(422, 'filter matches no records', { count: 0, filter });
      }
      if (matched.length > cap) {
        return fail(422, `filter matches ${matched.length} records, exceeding limit ${cap}`, {
          count: matched.length,
          limit: cap,
          hint: 'narrow the filter or raise `limit` deliberately',
        });
      }

      const ids = matched.map(r => r.id);
      return ok({
        count: matched.length,
        filter,
        sample: matched.slice(0, SAMPLE_SIZE),
        truncated: matched.length > SAMPLE_SIZE,
        confirmToken: fingerprint(filter, ids),
      });
    });
  }

  /**
   * POST /admin/bulk-delete/commit
   * Body: { filter, confirmToken }
   * Re-matches, re-validates the token against current data, then soft-deletes.
   * A stale token (data changed since preview) yields 409 so the admin re-reviews.
   */
  function commit(req: HttpRequest): HttpResponse {
    return handle(() => {
      const body = (req.body ?? {}) as Record;
      const filter = normalizeFilter(body.filter);
      const confirmToken = body.confirmToken;
      if (typeof confirmToken !== 'string' || confirmToken.length === 0) {
        throw new BadRequest('confirmToken is required — call /preview first');
      }

      const matched = store.match(filter);
      const cap = filter.limit ?? DEFAULT_LIMIT;
      if (matched.length === 0) return fail(422, 'filter matches no records', { count: 0 });
      if (matched.length > cap) {
        return fail(422, `filter matches ${matched.length} records, exceeding limit ${cap}`, {
          count: matched.length,
          limit: cap,
        });
      }

      const ids = matched.map(r => r.id);
      const current = fingerprint(filter, ids);
      if (current !== confirmToken) {
        throw new Conflict(
          'confirmToken does not match the current matched set — data changed since preview; re-run /preview and confirm again',
        );
      }

      const operationId =
        'op_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      const removed = store.softDelete(ids, operationId, req.actor ?? 'unknown', filter);

      return ok({
        operationId,
        deletedCount: removed.length,
        deletedIds: removed.map(r => r.id),
        filter,
        recover: `POST /admin/bulk-delete/restore/${operationId}`,
        note: 'records are soft-deleted (tombstoned) and can be restored via the operationId',
      });
    });
  }

  /**
   * POST /admin/bulk-delete/restore/:operationId
   * Undo a specific bulk delete. Recovery path so a mistake is reversible.
   */
  function restore(req: HttpRequest): HttpResponse {
    return handle(() => {
      const operationId = req.params?.operationId;
      if (typeof operationId !== 'string' || !operationId)
        throw new BadRequest('operationId is required');
      const op = store.getOperation(operationId);
      if (!op) return fail(404, 'unknown or already-restored operation', { operationId });

      const restored = store.restoreOperation(operationId);
      return ok({
        operationId,
        restoredCount: restored.length,
        restoredIds: restored.map(r => r.id),
      });
    });
  }

  return { preview, commit, restore };
}

// ---------------------------------------------------------------------------
// Example wiring (illustrative; safe to delete). Shows the intended flow:
//   preview -> review -> commit(with token) -> optional restore.
// ---------------------------------------------------------------------------

export function demo() {
  const store = new RecordStore();
  store.seed([
    { id: 'a', status: 'archived', createdAt: 1000 },
    { id: 'b', status: 'active', createdAt: 2000 },
    { id: 'c', status: 'archived', createdAt: 1500 },
  ]);
  const api = createHandlers(store);

  const pv = api.preview({ body: { filter: { status: 'archived' } } });
  const token = (pv.body as Record).confirmToken as string;
  const done = api.commit({
    body: { filter: { status: 'archived' }, confirmToken: token },
    actor: 'alex@arcade.dev',
  });
  const opId = (done.body as Record).operationId as string;
  const undo = api.restore({ params: { operationId: opId } });

  return { pv, done, undo, remaining: store.all() };
}
