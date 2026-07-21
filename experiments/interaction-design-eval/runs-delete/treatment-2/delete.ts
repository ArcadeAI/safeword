/**
 * Bulk-delete feature for an admin web app.
 *
 * Deleting many records at once is destructive and hard to undo, so this module
 * is built so the admin stays in control of a hand-off, not surprised by it:
 *
 *   1. Evaluation      — POST /bulk-delete/preview returns EXACTLY which records
 *                        a filter matches (count + sample + a stable signature)
 *                        before anything is touched.
 *   2. Confirmation    — the preview mints a short-lived confirmation token bound
 *                        to that exact match set. The commit endpoint refuses to
 *                        run without it, so an admin cannot delete blind.
 *   3. Interrupt/scope — the filter is explicit and the token is scoped to the
 *                        records the admin actually saw; if the data changed
 *                        underneath them (signature mismatch) the commit aborts
 *                        rather than deleting a different set than was reviewed.
 *                        A `limit` guard and `expectedCount` check let the admin
 *                        cap blast radius.
 *   4. Recovery        — deletes are SOFT by default (tombstoned, not dropped).
 *                        Every run produces an audit record with a batchId, and
 *                        POST /bulk-delete/undo/:batchId restores the batch.
 *                        Nothing fails silently: results are returned and logged.
 *
 * Single module: in-memory store + deletion logic + route handlers. No DB.
 */

// ---------------------------------------------------------------------------
// Domain model
// ---------------------------------------------------------------------------

export interface Record {
  id: string;
  status: string;
  createdAt: number; // epoch ms
  [key: string]: unknown;
}

interface StoredRecord extends Record {
  /** When set, the record is soft-deleted (tombstoned) and hidden from reads. */
  deletedAt?: number;
  /** The batch that deleted it, for undo. */
  deletedBatchId?: string;
}

export interface Filter {
  /** Match records with createdAt strictly older than this epoch-ms cutoff. */
  olderThan?: number;
  /** Match records whose status is exactly this. */
  status?: string;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

export class RecordStore {
  private records = new Map<string, StoredRecord>();
  private batches = new Map<string, DeleteBatch>();

  seed(records: Record[]): void {
    for (const r of records) {
      this.records.set(r.id, { ...r });
    }
  }

  /** Live (non-deleted) records. */
  private live(): StoredRecord[] {
    return [...this.records.values()].filter(r => r.deletedAt === undefined);
  }

  /** Records matching a filter, among live records only. */
  match(filter: Filter): StoredRecord[] {
    validateFilter(filter);
    return this.live().filter(r => matches(r, filter));
  }

  softDelete(ids: string[], batchId: string, actor: string): DeleteResult {
    const now = Date.now();
    const deleted: string[] = [];
    const skipped: string[] = [];
    for (const id of ids) {
      const r = this.records.get(id);
      if (!r || r.deletedAt !== undefined) {
        skipped.push(id);
        continue;
      }
      r.deletedAt = now;
      r.deletedBatchId = batchId;
      deleted.push(id);
    }
    const batch: DeleteBatch = {
      batchId,
      actor,
      deletedIds: deleted,
      deletedAt: now,
      undone: false,
    };
    this.batches.set(batchId, batch);
    return { batchId, deletedIds: deleted, skippedIds: skipped, deletedCount: deleted.length };
  }

  /** Restore a soft-deleted batch. Recovery path. */
  undo(batchId: string): UndoResult {
    const batch = this.batches.get(batchId);
    if (!batch) {
      return { batchId, restoredIds: [], restoredCount: 0, error: 'unknown batch' };
    }
    if (batch.undone) {
      return { batchId, restoredIds: [], restoredCount: 0, error: 'batch already undone' };
    }
    const restored: string[] = [];
    for (const id of batch.deletedIds) {
      const r = this.records.get(id);
      if (r && r.deletedBatchId === batchId && r.deletedAt !== undefined) {
        delete r.deletedAt;
        delete r.deletedBatchId;
        restored.push(id);
      }
    }
    batch.undone = true;
    return { batchId, restoredIds: restored, restoredCount: restored.length };
  }

  getBatch(batchId: string): DeleteBatch | undefined {
    return this.batches.get(batchId);
  }

  liveCount(): number {
    return this.live().length;
  }
}

interface DeleteBatch {
  batchId: string;
  actor: string;
  deletedIds: string[];
  deletedAt: number;
  undone: boolean;
}

export interface DeleteResult {
  batchId: string;
  deletedIds: string[];
  skippedIds: string[];
  deletedCount: number;
}

export interface UndoResult {
  batchId: string;
  restoredIds: string[];
  restoredCount: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------

function validateFilter(filter: Filter): void {
  if (filter == null || typeof filter !== 'object') {
    throw new BadRequest('filter must be an object');
  }
  if (filter.olderThan === undefined && filter.status === undefined) {
    // Refuse an empty filter: it would match everything. Force intent.
    throw new BadRequest(
      'filter must constrain the match set (olderThan and/or status); an empty filter is rejected',
    );
  }
  if (filter.olderThan !== undefined && !Number.isFinite(filter.olderThan)) {
    throw new BadRequest('olderThan must be an epoch-ms number');
  }
  if (filter.status !== undefined && typeof filter.status !== 'string') {
    throw new BadRequest('status must be a string');
  }
}

function matches(r: StoredRecord, filter: Filter): boolean {
  if (filter.olderThan !== undefined && !(r.createdAt < filter.olderThan)) return false;
  if (filter.status !== undefined && r.status !== filter.status) return false;
  return true;
}

/**
 * Stable signature of a match set: sorted ids hashed. Binds a confirmation
 * token to the EXACT records the admin previewed, so a commit fails loudly if
 * the underlying data shifted between preview and commit.
 */
function signature(ids: string[]): string {
  const sorted = [...ids].sort();
  let h = 5381;
  const joined = sorted.join(',');
  for (let i = 0; i < joined.length; i++) {
    h = ((h << 5) + h + joined.charCodeAt(i)) >>> 0;
  }
  return `${sorted.length}:${h.toString(16)}`;
}

// ---------------------------------------------------------------------------
// Confirmation tokens (evaluation -> confirmation hand-off)
// ---------------------------------------------------------------------------

interface Confirmation {
  token: string;
  filter: Filter;
  ids: string[];
  signature: string;
  actor: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

const TOKEN_TTL_MS = 5 * 60 * 1000; // preview grows stale after 5 minutes

export class ConfirmationRegistry {
  private tokens = new Map<string, Confirmation>();

  issue(filter: Filter, ids: string[], actor: string): Confirmation {
    const now = Date.now();
    const c: Confirmation = {
      token: randomToken(),
      filter,
      ids: [...ids],
      signature: signature(ids),
      actor,
      createdAt: now,
      expiresAt: now + TOKEN_TTL_MS,
      used: false,
    };
    this.tokens.set(c.token, c);
    return c;
  }

  /** Consume a token, verifying it is valid, unexpired, unused, and owned. */
  consume(token: string, actor: string): Confirmation {
    const c = this.tokens.get(token);
    if (!c) throw new BadRequest('unknown or expired confirmation token');
    if (c.used) throw new Conflict('confirmation token already used');
    if (Date.now() > c.expiresAt) {
      this.tokens.delete(token);
      throw new Conflict('confirmation token expired; re-run preview');
    }
    if (c.actor !== actor) throw new Forbidden('confirmation token belongs to another admin');
    c.used = true;
    return c;
  }
}

function randomToken(): string {
  return `cd_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Errors -> HTTP status
// ---------------------------------------------------------------------------

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
class BadRequest extends HttpError {
  constructor(m: string) {
    super(400, m);
  }
}
class Forbidden extends HttpError {
  constructor(m: string) {
    super(403, m);
  }
}
class Conflict extends HttpError {
  constructor(m: string) {
    super(409, m);
  }
}

// ---------------------------------------------------------------------------
// Service: ties store + confirmations + audit together
// ---------------------------------------------------------------------------

export interface PreviewRequest {
  filter: Filter;
  /** How many sample records to return for the admin to eyeball. */
  sampleSize?: number;
}

export interface PreviewResponse {
  matchCount: number;
  liveTotal: number;
  sample: Record[];
  signature: string;
  confirmationToken: string;
  expiresAt: number;
  message: string;
}

export interface CommitRequest {
  confirmationToken: string;
  /**
   * The count the admin saw in the preview. If it no longer matches, the commit
   * aborts — a guard against deleting more (or fewer) than was reviewed.
   */
  expectedCount?: number;
  /** Hard cap on how many records this call may delete. */
  limit?: number;
}

export interface AuditEntry {
  batchId: string;
  actor: string;
  at: number;
  action: 'bulk-delete' | 'undo';
  filter?: Filter;
  affectedCount: number;
}

export class BulkDeleteService {
  readonly auditLog: AuditEntry[] = [];

  constructor(
    private store: RecordStore,
    private confirmations = new ConfirmationRegistry(),
  ) {}

  /** Step 1: evaluate. Show the admin what would be deleted; issue a token. */
  preview(req: PreviewRequest, actor: string): PreviewResponse {
    const matched = this.store.match(req.filter);
    const ids = matched.map(r => r.id);
    const conf = this.confirmations.issue(req.filter, ids, actor);
    const sampleSize = clampSample(req.sampleSize);
    const sample = matched.slice(0, sampleSize).map(strip);
    return {
      matchCount: matched.length,
      liveTotal: this.store.liveCount(),
      sample,
      signature: conf.signature,
      confirmationToken: conf.token,
      expiresAt: conf.expiresAt,
      message:
        matched.length === 0
          ? 'No records match this filter; nothing would be deleted.'
          : `${matched.length} record(s) would be soft-deleted. Review the sample, then commit with the confirmationToken. Deletes are recoverable via undo.`,
    };
  }

  /** Step 2: commit. Requires a valid token; re-checks the match set. */
  commit(req: CommitRequest, actor: string): DeleteResult {
    const conf = this.confirmations.consume(req.confirmationToken, actor);

    // Re-evaluate against the live store: the truth may have moved since preview.
    const current = this.store.match(conf.filter).map(r => r.id);
    const currentSig = signature(current);
    if (currentSig !== conf.signature) {
      throw new Conflict(
        'records changed since preview (added/removed/already-deleted); re-run preview to review the current match set before deleting',
      );
    }
    if (req.expectedCount !== undefined && req.expectedCount !== conf.ids.length) {
      throw new Conflict(
        `expectedCount ${req.expectedCount} does not match the ${conf.ids.length} previewed record(s); aborting`,
      );
    }
    if (req.limit !== undefined && conf.ids.length > req.limit) {
      throw new BadRequest(
        `match set (${conf.ids.length}) exceeds limit (${req.limit}); narrow the filter or raise the limit`,
      );
    }

    const batchId = `batch_${randomToken()}`;
    const result = this.store.softDelete(conf.ids, batchId, actor);
    this.auditLog.push({
      batchId,
      actor,
      at: Date.now(),
      action: 'bulk-delete',
      filter: conf.filter,
      affectedCount: result.deletedCount,
    });
    return result;
  }

  /** Step 3: recover. Restore a soft-deleted batch. */
  undo(batchId: string, actor: string): UndoResult {
    const result = this.store.undo(batchId);
    if (!result.error) {
      this.auditLog.push({
        batchId,
        actor,
        at: Date.now(),
        action: 'undo',
        affectedCount: result.restoredCount,
      });
    }
    return result;
  }
}

function clampSample(n?: number): number {
  if (n === undefined) return 10;
  if (!Number.isFinite(n) || n < 0) return 10;
  return Math.min(Math.floor(n), 100);
}

/** Drop internal tombstone fields before returning a record to the client. */
function strip(r: StoredRecord): Record {
  const { deletedAt, deletedBatchId, ...rest } = r;
  return rest;
}

// ---------------------------------------------------------------------------
// HTTP route handlers (framework-agnostic; thin adapter over the service)
// ---------------------------------------------------------------------------

export interface HttpRequest {
  body: unknown;
  params: { [k: string]: string };
  /** Identity of the calling admin, resolved by upstream auth middleware. */
  actor?: string;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}

function requireAdmin(req: HttpRequest): string {
  const actor = req.actor;
  if (!actor) throw new Forbidden('authenticated admin required');
  return actor;
}

function handle(fn: () => HttpResponse): HttpResponse {
  try {
    return fn();
  } catch (e) {
    if (e instanceof HttpError) {
      return { status: e.status, body: { error: e.message } };
    }
    return { status: 500, body: { error: 'internal error' } };
  }
}

export function createRoutes(service: BulkDeleteService) {
  return {
    /** POST /bulk-delete/preview — evaluate a filter, get a confirmation token. */
    preview(req: HttpRequest): HttpResponse {
      return handle(() => {
        const actor = requireAdmin(req);
        const body = (req.body ?? {}) as PreviewRequest;
        const res = service.preview({ filter: body.filter, sampleSize: body.sampleSize }, actor);
        return { status: 200, body: res };
      });
    },

    /** POST /bulk-delete/commit — soft-delete the previewed match set. */
    commit(req: HttpRequest): HttpResponse {
      return handle(() => {
        const actor = requireAdmin(req);
        const body = (req.body ?? {}) as CommitRequest;
        if (!body.confirmationToken) {
          throw new BadRequest('confirmationToken is required; run preview first');
        }
        const res = service.commit(body, actor);
        return { status: 200, body: res };
      });
    },

    /** POST /bulk-delete/undo/:batchId — restore a soft-deleted batch. */
    undo(req: HttpRequest): HttpResponse {
      return handle(() => {
        const actor = requireAdmin(req);
        const batchId = req.params.batchId;
        if (!batchId) throw new BadRequest('batchId is required');
        const res = service.undo(batchId, actor);
        if (res.error) throw new BadRequest(res.error);
        return { status: 200, body: res };
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Wiring helper
// ---------------------------------------------------------------------------

export function createBulkDelete(seed: Record[] = []) {
  const store = new RecordStore();
  store.seed(seed);
  const service = new BulkDeleteService(store);
  const routes = createRoutes(service);
  return { store, service, routes };
}
