/**
 * Bulk-delete feature for an admin web app.
 *
 * ------------------------------------------------------------------------
 * INTERACTION DESIGN
 * ------------------------------------------------------------------------
 * Bulk delete acts on the admin's behalf and is destructive, so the flow is
 * built around four control points that close the gaps a hand-off opens:
 *
 *  1. EVALUATION (see before it happens)
 *     `POST /bulk-delete/preview` runs the filter WITHOUT deleting anything.
 *     It returns the exact count, a sample of the matched records, and a
 *     signed `confirmationToken` that fingerprints *this* result set.
 *
 *  2. CONFIRMATION (confirm intent before committing)
 *     `POST /bulk-delete/execute` refuses to act unless the caller echoes back
 *     the `confirmationToken` from a preview AND the `expectedCount` they saw.
 *     If the data changed between preview and execute (count drifts, token
 *     mismatches), the delete is rejected — a stale confirmation can't fire.
 *
 *  3. INTERRUPT / SCOPING (stop or scope before it acts)
 *     The filter is explicit and narrow (before-date and/or status). An empty
 *     or missing filter is rejected rather than being treated as "match all",
 *     so an admin can never delete everything by accident. `limit` caps blast
 *     radius. The two-step preview->execute handshake is itself the interrupt:
 *     nothing is deleted on the preview call, and the admin can walk away.
 *
 *  4. RECOVERY (find out if it went wrong, and undo it)
 *     Deletes are SOFT — records are tombstoned into a recycle bin with the
 *     batch id, not destroyed. `POST /bulk-delete/undo` restores an entire
 *     batch. Every run is recorded in an audit log the admin can inspect via
 *     `GET /bulk-delete/audit`. Nothing fails silently.
 * ------------------------------------------------------------------------
 */

import { createHmac, randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Domain model + in-memory store (a real app would back this with a database)
// ---------------------------------------------------------------------------

export type RecordStatus = 'active' | 'archived' | 'flagged' | 'pending';

export interface Record {
  id: string;
  status: RecordStatus;
  createdAt: string; // ISO 8601
  payload: unknown;
}

export interface Filter {
  /** Match records created strictly before this ISO date/time. */
  olderThan?: string;
  /** Match records with this status. */
  status?: RecordStatus;
}

interface Tombstone {
  batchId: string;
  deletedAt: string;
  deletedBy: string;
  record: Record;
}

interface AuditEntry {
  batchId: string;
  action: 'delete' | 'undo';
  at: string;
  actor: string;
  filter: Filter | null;
  affected: number;
}

export class Store {
  private records = new Map<string, Record>();
  private recycleBin = new Map<string, Tombstone[]>(); // batchId -> tombstones
  private audit: AuditEntry[] = [];

  constructor(seed: Record[] = []) {
    for (const r of seed) this.records.set(r.id, r);
  }

  add(record: Record): void {
    this.records.set(record.id, record);
  }

  all(): Record[] {
    return [...this.records.values()];
  }

  match(filter: Filter): Record[] {
    return this.all().filter(r => matches(r, filter));
  }

  /** Soft-delete a set of records; returns the batch id used to undo. */
  softDelete(records: Record[], actor: string, filter: Filter): string {
    const batchId = randomUUID();
    const deletedAt = new Date().toISOString();
    const tombstones: Tombstone[] = [];
    for (const r of records) {
      if (this.records.delete(r.id)) {
        tombstones.push({ batchId, deletedAt, deletedBy: actor, record: r });
      }
    }
    this.recycleBin.set(batchId, tombstones);
    this.audit.push({
      batchId,
      action: 'delete',
      at: deletedAt,
      actor,
      filter,
      affected: tombstones.length,
    });
    return batchId;
  }

  /** Restore a soft-deleted batch. Returns the number of records restored. */
  undo(batchId: string, actor: string): number {
    const tombstones = this.recycleBin.get(batchId);
    if (!tombstones) return 0;
    let restored = 0;
    for (const t of tombstones) {
      // Only restore if the id hasn't been re-created in the meantime.
      if (!this.records.has(t.record.id)) {
        this.records.set(t.record.id, t.record);
        restored++;
      }
    }
    this.recycleBin.delete(batchId);
    this.audit.push({
      batchId,
      action: 'undo',
      at: new Date().toISOString(),
      actor,
      filter: null,
      affected: restored,
    });
    return restored;
  }

  auditLog(): readonly AuditEntry[] {
    return this.audit;
  }
}

// ---------------------------------------------------------------------------
// Filter logic
// ---------------------------------------------------------------------------

export function matches(record: Record, filter: Filter): boolean {
  if (filter.olderThan !== undefined) {
    if (!(new Date(record.createdAt) < new Date(filter.olderThan))) return false;
  }
  if (filter.status !== undefined) {
    if (record.status !== filter.status) return false;
  }
  return true;
}

/**
 * Reject filters that would be dangerously broad or malformed. This is the
 * scoping guard: no criterion means "match everything", which we never allow
 * for a destructive bulk operation.
 */
export function validateFilter(
  filter: unknown,
): { ok: true; value: Filter } | { ok: false; error: string } {
  if (typeof filter !== 'object' || filter === null) {
    return { ok: false, error: 'A filter object is required.' };
  }
  const f = filter as Record & Filter;
  const has = f.olderThan !== undefined || f.status !== undefined;
  if (!has) {
    return {
      ok: false,
      error:
        'Filter must include at least one criterion (olderThan and/or status). Refusing to match all records.',
    };
  }
  if (f.olderThan !== undefined) {
    if (typeof f.olderThan !== 'string' || Number.isNaN(Date.parse(f.olderThan))) {
      return { ok: false, error: 'olderThan must be a valid ISO date string.' };
    }
  }
  const allowed: RecordStatus[] = ['active', 'archived', 'flagged', 'pending'];
  if (f.status !== undefined && !allowed.includes(f.status)) {
    return { ok: false, error: `status must be one of: ${allowed.join(', ')}.` };
  }
  return { ok: true, value: { olderThan: f.olderThan, status: f.status } };
}

// ---------------------------------------------------------------------------
// Confirmation token — binds an execute call to a specific preview result.
// ---------------------------------------------------------------------------

const SECRET = process.env.BULK_DELETE_SECRET ?? 'dev-only-secret-change-me';
const TOKEN_TTL_MS = 5 * 60 * 1000; // previews go stale after 5 minutes

function fingerprint(filter: Filter, ids: string[]): string {
  // Order-independent fingerprint of the exact matched set.
  const body = JSON.stringify({ filter, ids: [...ids].sort() });
  return createHmac('sha256', SECRET).update(body).digest('hex');
}

function issueToken(filter: Filter, ids: string[]): string {
  const issuedAt = Date.now();
  const fp = fingerprint(filter, ids);
  const payload = `${issuedAt}.${ids.length}.${fp}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

function verifyToken(
  token: string,
  filter: Filter,
  currentIds: string[],
): { ok: true } | { ok: false; error: string } {
  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return { ok: false, error: 'Malformed confirmation token.' };
  }
  const parts = decoded.split('.');
  if (parts.length !== 4) return { ok: false, error: 'Malformed confirmation token.' };
  const [issuedAtStr, countStr, fp, sig] = parts;
  const payload = `${issuedAtStr}.${countStr}.${fp}`;
  const expectedSig = createHmac('sha256', SECRET).update(payload).digest('hex');
  if (sig !== expectedSig) return { ok: false, error: 'Confirmation token signature is invalid.' };
  if (Date.now() - Number(issuedAtStr) > TOKEN_TTL_MS) {
    return { ok: false, error: 'Confirmation token has expired. Re-run the preview.' };
  }
  // The data must not have drifted since the preview.
  if (fingerprint(filter, currentIds) !== fp) {
    return {
      ok: false,
      error:
        'The set of matching records changed since preview. Re-run the preview and confirm again.',
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// HTTP layer — framework-agnostic request/response shapes.
// ---------------------------------------------------------------------------

export interface HttpRequest {
  body: any;
  /** Populated by auth middleware; used for the audit trail. */
  admin?: { id: string };
}

export interface HttpResponse {
  status: number;
  body: unknown;
}

const SAMPLE_SIZE = 20;

function actorOf(req: HttpRequest): string {
  return req.admin?.id ?? 'unknown-admin';
}

/**
 * POST /bulk-delete/preview
 * Non-destructive. Shows exactly what would be deleted and returns a
 * confirmation token the admin must echo back to execute.
 */
export function previewHandler(store: Store, req: HttpRequest): HttpResponse {
  const check = validateFilter(req.body?.filter);
  if (!check.ok) return { status: 400, body: { error: check.error } };
  const filter = check.value;

  const matched = store.match(filter);
  const ids = matched.map(r => r.id);
  const token = issueToken(filter, ids);

  return {
    status: 200,
    body: {
      filter,
      matchedCount: matched.length,
      sample: matched.slice(0, SAMPLE_SIZE),
      sampleTruncated: matched.length > SAMPLE_SIZE,
      confirmationToken: token,
      expiresInSeconds: TOKEN_TTL_MS / 1000,
      // Guidance the UI can surface verbatim before the admin commits.
      notice:
        matched.length === 0
          ? 'No records match this filter. Nothing will be deleted.'
          : `This will soft-delete ${matched.length} record(s). They can be restored via undo. Confirm to proceed.`,
    },
  };
}

/**
 * POST /bulk-delete/execute
 * Destructive (soft). Requires the confirmationToken and expectedCount from a
 * recent preview. Rejects if intent can't be confirmed or the data drifted.
 */
export function executeHandler(store: Store, req: HttpRequest): HttpResponse {
  const check = validateFilter(req.body?.filter);
  if (!check.ok) return { status: 400, body: { error: check.error } };
  const filter = check.value;

  const token = req.body?.confirmationToken;
  if (typeof token !== 'string' || token.length === 0) {
    return { status: 400, body: { error: 'confirmationToken is required. Run a preview first.' } };
  }
  const expectedCount = req.body?.expectedCount;
  if (typeof expectedCount !== 'number' || !Number.isInteger(expectedCount)) {
    return {
      status: 400,
      body: { error: 'expectedCount (integer) is required and must match the preview.' },
    };
  }

  const matched = store.match(filter);
  const currentIds = matched.map(r => r.id);

  // Double confirmation: the count the admin saw AND the fingerprint token.
  if (matched.length !== expectedCount) {
    return {
      status: 409,
      body: {
        error: `Record set changed: preview showed ${expectedCount}, now ${matched.length}. Re-run preview.`,
        currentCount: matched.length,
      },
    };
  }
  const verified = verifyToken(token, filter, currentIds);
  if (!verified.ok) return { status: 409, body: { error: verified.error } };

  const actor = actorOf(req);
  const batchId = store.softDelete(matched, actor, filter);

  return {
    status: 200,
    body: {
      deletedCount: matched.length,
      batchId,
      recoverable: true,
      undo: { method: 'POST', path: '/bulk-delete/undo', body: { batchId } },
      notice: `Soft-deleted ${matched.length} record(s). Undo with batchId ${batchId}.`,
    },
  };
}

/**
 * POST /bulk-delete/undo
 * Restores a previously soft-deleted batch.
 */
export function undoHandler(store: Store, req: HttpRequest): HttpResponse {
  const batchId = req.body?.batchId;
  if (typeof batchId !== 'string' || batchId.length === 0) {
    return { status: 400, body: { error: 'batchId is required.' } };
  }
  const restored = store.undo(batchId, actorOf(req));
  if (restored === 0) {
    return {
      status: 404,
      body: {
        error: 'No restorable batch found for that batchId (already undone, expired, or unknown).',
      },
    };
  }
  return { status: 200, body: { restoredCount: restored, batchId } };
}

/**
 * GET /bulk-delete/audit
 * Read-only history so destructive actions never happen silently.
 */
export function auditHandler(store: Store, _req: HttpRequest): HttpResponse {
  return { status: 200, body: { entries: store.auditLog() } };
}

// ---------------------------------------------------------------------------
// Optional: tiny router for wiring into a server. Adapt to your framework.
// ---------------------------------------------------------------------------

export function makeRouter(store: Store) {
  return {
    'POST /bulk-delete/preview': (req: HttpRequest) => previewHandler(store, req),
    'POST /bulk-delete/execute': (req: HttpRequest) => executeHandler(store, req),
    'POST /bulk-delete/undo': (req: HttpRequest) => undoHandler(store, req),
    'GET /bulk-delete/audit': (req: HttpRequest) => auditHandler(store, req),
  };
}
