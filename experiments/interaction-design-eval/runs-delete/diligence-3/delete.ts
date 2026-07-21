/**
 * Bulk-delete feature for an admin-facing web app.
 *
 * A single self-contained module: an in-memory record store, filter matching,
 * the deletion engine, and framework-agnostic HTTP route handlers.
 *
 * Design priorities (the reason this is more than a `for` loop):
 *   - Bulk delete is destructive and irreversible from the user's point of view,
 *     so the flow is preview -> confirm -> execute, and execution is a soft
 *     delete (tombstone) that can be restored within a retention window.
 *   - The endpoint refuses to run a delete whose scope the caller didn't see,
 *     via a matched-count guard (optimistic-concurrency style) so a filter that
 *     silently widened between preview and execute cannot nuke the whole table.
 *   - Every destructive action is authorized, rate-limited, audited, and
 *     idempotent (safe to retry after a dropped connection).
 *
 * Framework-agnostic: handlers take a minimal `HttpRequest` and return an
 * `HttpResponse`, so they drop into Express/Fastify/Hono/Next with a thin shim.
 */

// ---------------------------------------------------------------------------
// Domain model
// ---------------------------------------------------------------------------

export type RecordStatus = 'active' | 'archived' | 'flagged' | 'pending';

export interface Record {
  id: string;
  status: RecordStatus;
  /** Epoch millis the record was created. */
  createdAt: number;
  /** Owner / tenant, used to scope deletes and prevent cross-tenant blast radius. */
  ownerId: string;
  /** Free-form label, purely illustrative payload. */
  label: string;

  // Soft-delete bookkeeping. Absent on live records.
  deletedAt?: number;
  deletedBy?: string;
  deleteReason?: string;
}

/**
 * The filter an admin picks in the UI. All present fields are ANDed together.
 * An empty filter matches nothing on purpose — see `isEmptyFilter` — because a
 * filter that matches everything is the single most dangerous input here.
 */
export interface DeleteFilter {
  /** Match records with `status` equal to one of these. */
  status?: RecordStatus[];
  /** Match records created strictly before this epoch-millis instant. */
  createdBefore?: number;
  /** Match records created at or after this epoch-millis instant. */
  createdAfter?: number;
  /** Restrict to a single owner/tenant. */
  ownerId?: string;
  /** Substring match on label (case-insensitive). */
  labelContains?: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type ErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_filter'
  | 'empty_filter'
  | 'scope_mismatch'
  | 'limit_exceeded'
  | 'rate_limited'
  | 'not_found';

export class BulkDeleteError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly httpStatus: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'BulkDeleteError';
  }
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

/**
 * A trivial store. In production this is a repository over a real database;
 * the matching/guard/audit logic around it is what actually matters and would
 * carry over unchanged. Deletes are soft: rows are tombstoned, not dropped.
 */
export class RecordStore {
  private readonly records = new Map<string, Record>();

  seed(records: Record[]): void {
    for (const r of records) this.records.set(r.id, { ...r });
  }

  get(id: string): Record | undefined {
    const r = this.records.get(id);
    return r ? { ...r } : undefined;
  }

  /** Live records only (not tombstoned). Returns copies. */
  liveMatching(filter: DeleteFilter): Record[] {
    const out: Record[] = [];
    for (const r of this.records.values()) {
      if (r.deletedAt !== undefined) continue;
      if (matchesFilter(r, filter)) out.push({ ...r });
    }
    return out;
  }

  /** Tombstone the given live ids. Returns the ids actually transitioned. */
  softDelete(ids: string[], by: string, reason: string, at: number): string[] {
    const deleted: string[] = [];
    for (const id of ids) {
      const r = this.records.get(id);
      if (!r || r.deletedAt !== undefined) continue; // already gone / never existed
      r.deletedAt = at;
      r.deletedBy = by;
      r.deleteReason = reason;
      deleted.push(id);
    }
    return deleted;
  }

  /** Restore tombstoned ids that are still within retention. Returns restored ids. */
  restore(ids: string[]): string[] {
    const restored: string[] = [];
    for (const id of ids) {
      const r = this.records.get(id);
      if (!r || r.deletedAt === undefined) continue;
      delete r.deletedAt;
      delete r.deletedBy;
      delete r.deleteReason;
      restored.push(id);
    }
    return restored;
  }

  /** Permanently drop tombstones older than the retention cutoff. */
  purgeExpired(retentionCutoff: number): number {
    let purged = 0;
    for (const [id, r] of this.records) {
      if (r.deletedAt !== undefined && r.deletedAt < retentionCutoff) {
        this.records.delete(id);
        purged++;
      }
    }
    return purged;
  }
}

// ---------------------------------------------------------------------------
// Filter validation & matching
// ---------------------------------------------------------------------------

const VALID_STATUSES: readonly RecordStatus[] = ['active', 'archived', 'flagged', 'pending'];

export function isEmptyFilter(filter: DeleteFilter): boolean {
  return (
    (!filter.status || filter.status.length === 0) &&
    filter.createdBefore === undefined &&
    filter.createdAfter === undefined &&
    filter.ownerId === undefined &&
    (filter.labelContains === undefined || filter.labelContains === '')
  );
}

/**
 * Parse & validate an untrusted filter payload from the request body.
 * Throws BulkDeleteError("invalid_filter" | "empty_filter") on bad input.
 */
export function parseFilter(raw: unknown): DeleteFilter {
  if (raw === null || typeof raw !== 'object') {
    throw new BulkDeleteError('invalid_filter', 'Filter must be an object', 400);
  }
  const src = raw as Record_<string, unknown>;
  const filter: DeleteFilter = {};

  if (src.status !== undefined) {
    if (!Array.isArray(src.status) || src.status.length === 0) {
      throw new BulkDeleteError('invalid_filter', 'status must be a non-empty array', 400);
    }
    for (const s of src.status) {
      if (!VALID_STATUSES.includes(s as RecordStatus)) {
        throw new BulkDeleteError('invalid_filter', `Unknown status: ${String(s)}`, 400);
      }
    }
    filter.status = src.status as RecordStatus[];
  }

  filter.createdBefore = coerceTimestamp(src.createdBefore, 'createdBefore');
  filter.createdAfter = coerceTimestamp(src.createdAfter, 'createdAfter');

  if (
    filter.createdBefore !== undefined &&
    filter.createdAfter !== undefined &&
    filter.createdAfter >= filter.createdBefore
  ) {
    throw new BulkDeleteError(
      'invalid_filter',
      'createdAfter must be earlier than createdBefore',
      400,
    );
  }

  if (src.ownerId !== undefined) {
    if (typeof src.ownerId !== 'string' || src.ownerId.trim() === '') {
      throw new BulkDeleteError('invalid_filter', 'ownerId must be a non-empty string', 400);
    }
    filter.ownerId = src.ownerId;
  }

  if (src.labelContains !== undefined) {
    if (typeof src.labelContains !== 'string') {
      throw new BulkDeleteError('invalid_filter', 'labelContains must be a string', 400);
    }
    if (src.labelContains !== '') filter.labelContains = src.labelContains;
  }

  if (isEmptyFilter(filter)) {
    throw new BulkDeleteError(
      'empty_filter',
      'Refusing an empty filter: it would match every record. Add at least one constraint.',
      400,
    );
  }

  return filter;
}

function coerceTimestamp(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  throw new BulkDeleteError(
    'invalid_filter',
    `${field} must be an epoch-millis number or ISO date string`,
    400,
  );
}

export function matchesFilter(record: Record, filter: DeleteFilter): boolean {
  if (filter.status && !filter.status.includes(record.status)) return false;
  if (filter.createdBefore !== undefined && !(record.createdAt < filter.createdBefore))
    return false;
  if (filter.createdAfter !== undefined && !(record.createdAt >= filter.createdAfter)) return false;
  if (filter.ownerId !== undefined && record.ownerId !== filter.ownerId) return false;
  if (
    filter.labelContains !== undefined &&
    !record.label.toLowerCase().includes(filter.labelContains.toLowerCase())
  ) {
    return false;
  }
  return true;
}

/**
 * A stable hash of the semantic filter (order-independent) plus the matched-id
 * set, used both for the preview-token and for audit correlation. Not a
 * cryptographic hash — just enough to detect that scope changed.
 */
export function fingerprint(filter: DeleteFilter, matchedIds: string[]): string {
  const norm = {
    status: filter.status ? [...filter.status].sort() : undefined,
    createdBefore: filter.createdBefore,
    createdAfter: filter.createdAfter,
    ownerId: filter.ownerId,
    labelContains: filter.labelContains?.toLowerCase(),
    ids: [...matchedIds].sort(),
  };
  const json = JSON.stringify(norm);
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// Auth, audit, rate limiting (pluggable seams)
// ---------------------------------------------------------------------------

export interface Principal {
  userId: string;
  roles: string[];
}

export interface AuditEntry {
  at: number;
  actor: string;
  action: 'preview' | 'execute' | 'restore';
  filter: DeleteFilter;
  fingerprint: string;
  matchedCount: number;
  affectedCount: number;
  operationId?: string;
  outcome: 'ok' | 'rejected';
  reason?: string;
}

export interface AuditLog {
  record(entry: AuditEntry): void;
}

export class InMemoryAuditLog implements AuditLog {
  readonly entries: AuditEntry[] = [];
  record(entry: AuditEntry): void {
    this.entries.push(entry);
  }
}

/** Simple fixed-window limiter so an admin (or a stuck client) can't hammer deletes. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): void {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter(ts => t - ts < this.windowMs);
    if (recent.length >= this.max) {
      throw new BulkDeleteError('rate_limited', 'Too many delete operations; slow down.', 429);
    }
    recent.push(t);
    this.hits.set(key, recent);
  }
}

// ---------------------------------------------------------------------------
// Deletion engine
// ---------------------------------------------------------------------------

export interface BulkDeleteConfig {
  /** Hard ceiling on records deletable in one call; a bigger match is rejected. */
  maxDeletePerOperation: number;
  /** Soft-deleted rows are restorable for this long before purge. */
  retentionMs: number;
  /** Rate limiter budget. */
  rateLimitMax: number;
  rateLimitWindowMs: number;
}

export const DEFAULT_CONFIG: BulkDeleteConfig = {
  maxDeletePerOperation: 10_000,
  retentionMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  rateLimitMax: 20,
  rateLimitWindowMs: 60_000,
};

export interface PreviewResult {
  matchedCount: number;
  /** Bounded sample of what would be deleted, for the confirmation dialog. */
  sample: Record[];
  fingerprint: string;
  /** True when the match exceeds the per-operation ceiling and execute will refuse. */
  exceedsLimit: boolean;
}

export interface ExecuteRequest {
  filter: DeleteFilter;
  reason: string;
  /**
   * The fingerprint the admin saw at preview time. Execution refuses if the
   * current scope no longer matches it (scope drifted, or they never previewed).
   */
  expectedFingerprint: string;
  /** Client-generated id making retries idempotent. */
  operationId: string;
}

export interface ExecuteResult {
  operationId: string;
  deletedCount: number;
  deletedIds: string[];
  fingerprint: string;
  /** True when this result was replayed from a prior identical operationId. */
  idempotentReplay: boolean;
}

const SAMPLE_SIZE = 25;

export class BulkDeleteService {
  private readonly completed = new Map<string, ExecuteResult>();

  constructor(
    private readonly store: RecordStore,
    private readonly audit: AuditLog,
    private readonly rateLimiter: RateLimiter,
    private readonly config: BulkDeleteConfig = DEFAULT_CONFIG,
    private readonly now: () => number = Date.now,
  ) {}

  private assertAdmin(principal: Principal | undefined): asserts principal is Principal {
    if (!principal) {
      throw new BulkDeleteError('unauthorized', 'Authentication required', 401);
    }
    if (!principal.roles.includes('admin')) {
      throw new BulkDeleteError('forbidden', 'Admin role required for bulk delete', 403);
    }
  }

  preview(principal: Principal | undefined, filter: DeleteFilter): PreviewResult {
    this.assertAdmin(principal);
    const matched = this.store.liveMatching(filter);
    const ids = matched.map(r => r.id);
    const fp = fingerprint(filter, ids);

    this.audit.record({
      at: this.now(),
      actor: principal.userId,
      action: 'preview',
      filter,
      fingerprint: fp,
      matchedCount: matched.length,
      affectedCount: 0,
      outcome: 'ok',
    });

    return {
      matchedCount: matched.length,
      sample: matched.slice(0, SAMPLE_SIZE),
      fingerprint: fp,
      exceedsLimit: matched.length > this.config.maxDeletePerOperation,
    };
  }

  execute(principal: Principal | undefined, req: ExecuteRequest): ExecuteResult {
    this.assertAdmin(principal);

    // Idempotency: a retried operationId returns the original result verbatim
    // and never deletes twice.
    const prior = this.completed.get(req.operationId);
    if (prior) return { ...prior, idempotentReplay: true };

    this.rateLimiter.check(principal.userId);

    const matched = this.store.liveMatching(req.filter);
    const ids = matched.map(r => r.id);
    const fp = fingerprint(req.filter, ids);

    const reject = (code: ErrorCode, message: string, status: number): never => {
      this.audit.record({
        at: this.now(),
        actor: principal.userId,
        action: 'execute',
        filter: req.filter,
        fingerprint: fp,
        matchedCount: matched.length,
        affectedCount: 0,
        operationId: req.operationId,
        outcome: 'rejected',
        reason: message,
      });
      throw new BulkDeleteError(code, message, status, {
        currentFingerprint: fp,
        matchedCount: matched.length,
      });
    };

    // Scope guard: what they confirmed must equal what we're about to delete.
    if (req.expectedFingerprint !== fp) {
      reject(
        'scope_mismatch',
        'The set of matching records changed since preview. Re-preview and confirm again.',
        409,
      );
    }

    if (matched.length > this.config.maxDeletePerOperation) {
      reject(
        'limit_exceeded',
        `Match of ${matched.length} exceeds the per-operation limit of ${this.config.maxDeletePerOperation}. Narrow the filter.`,
        422,
      );
    }

    const deletedIds = this.store.softDelete(ids, principal.userId, req.reason, this.now());

    const result: ExecuteResult = {
      operationId: req.operationId,
      deletedCount: deletedIds.length,
      deletedIds,
      fingerprint: fp,
      idempotentReplay: false,
    };
    this.completed.set(req.operationId, result);

    this.audit.record({
      at: this.now(),
      actor: principal.userId,
      action: 'execute',
      filter: req.filter,
      fingerprint: fp,
      matchedCount: matched.length,
      affectedCount: deletedIds.length,
      operationId: req.operationId,
      outcome: 'ok',
    });

    return result;
  }

  /** Undo a completed operation while its tombstones are still within retention. */
  restore(principal: Principal | undefined, operationId: string): { restoredCount: number } {
    this.assertAdmin(principal);
    const op = this.completed.get(operationId);
    if (!op) throw new BulkDeleteError('not_found', 'Unknown operationId', 404);

    const cutoff = this.now() - this.config.retentionMs;
    const restorable = op.deletedIds.filter(id => {
      const r = this.store.get(id);
      return r?.deletedAt !== undefined && r.deletedAt >= cutoff;
    });
    const restored = this.store.restore(restorable);

    this.audit.record({
      at: this.now(),
      actor: principal.userId,
      action: 'restore',
      filter: {},
      fingerprint: op.fingerprint,
      matchedCount: op.deletedIds.length,
      affectedCount: restored.length,
      operationId,
      outcome: 'ok',
    });

    return { restoredCount: restored.length };
  }

  /** Background/cron seam: permanently drop expired tombstones. */
  purge(): number {
    return this.store.purgeExpired(this.now() - this.config.retentionMs);
  }
}

// ---------------------------------------------------------------------------
// HTTP layer (framework-agnostic)
// ---------------------------------------------------------------------------

export interface HttpRequest {
  body: unknown;
  principal?: Principal;
  params?: Record_<string, string>;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}

function ok(status: number, body: unknown): HttpResponse {
  return { status, body };
}

function toErrorResponse(err: unknown): HttpResponse {
  if (err instanceof BulkDeleteError) {
    return ok(err.httpStatus, {
      error: { code: err.code, message: err.message, details: err.details ?? null },
    });
  }
  return ok(500, { error: { code: 'internal', message: 'Unexpected error' } });
}

export class BulkDeleteRoutes {
  constructor(private readonly service: BulkDeleteService) {}

  /** POST /admin/records/bulk-delete/preview  — dry run, returns count + sample + fingerprint. */
  preview = (req: HttpRequest): HttpResponse => {
    try {
      const body = (req.body ?? {}) as Record_<string, unknown>;
      const filter = parseFilter(body.filter);
      return ok(200, this.service.preview(req.principal, filter));
    } catch (err) {
      return toErrorResponse(err);
    }
  };

  /** POST /admin/records/bulk-delete  — execute, guarded by fingerprint + operationId. */
  execute = (req: HttpRequest): HttpResponse => {
    try {
      const body = (req.body ?? {}) as Record_<string, unknown>;
      const filter = parseFilter(body.filter);

      const operationId = body.operationId;
      if (typeof operationId !== 'string' || operationId.trim() === '') {
        throw new BulkDeleteError('invalid_filter', 'operationId is required', 400);
      }
      const expectedFingerprint = body.expectedFingerprint;
      if (typeof expectedFingerprint !== 'string' || expectedFingerprint === '') {
        throw new BulkDeleteError(
          'invalid_filter',
          'expectedFingerprint from a prior preview is required',
          400,
        );
      }
      const reason = typeof body.reason === 'string' ? body.reason : '';
      if (reason.trim() === '') {
        throw new BulkDeleteError('invalid_filter', 'A reason for the deletion is required', 400);
      }

      const result = this.service.execute(req.principal, {
        filter,
        reason,
        expectedFingerprint,
        operationId,
      });
      return ok(200, result);
    } catch (err) {
      return toErrorResponse(err);
    }
  };

  /** POST /admin/records/bulk-delete/:operationId/restore  — undo within retention. */
  restore = (req: HttpRequest): HttpResponse => {
    try {
      const operationId = req.params?.operationId ?? '';
      if (operationId === '') {
        throw new BulkDeleteError('invalid_filter', 'operationId is required', 400);
      }
      return ok(200, this.service.restore(req.principal, operationId));
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

/** Factory wiring the whole feature together with sane defaults. */
export function createBulkDeleteFeature(
  seed: Record[] = [],
  config: BulkDeleteConfig = DEFAULT_CONFIG,
  now: () => number = Date.now,
): {
  store: RecordStore;
  service: BulkDeleteService;
  routes: BulkDeleteRoutes;
  audit: InMemoryAuditLog;
} {
  const store = new RecordStore();
  store.seed(seed);
  const audit = new InMemoryAuditLog();
  const rateLimiter = new RateLimiter(config.rateLimitMax, config.rateLimitWindowMs, now);
  const service = new BulkDeleteService(store, audit, rateLimiter, config, now);
  const routes = new BulkDeleteRoutes(service);
  return { store, service, routes, audit };
}

// Local alias so the domain `Record` name doesn't shadow the built-in
// `Record<K,V>` utility type used in a few signatures above.
type Record_<K extends string | number | symbol, V> = { [P in K]: V };
