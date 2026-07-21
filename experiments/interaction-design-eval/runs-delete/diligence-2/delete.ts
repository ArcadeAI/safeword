/**
 * Bulk-delete feature for an admin web app.
 *
 * An admin picks a filter (records older than a date, and/or records with a
 * given status) and the feature deletes every record matching it.
 *
 * This module is deliberately self-contained: an in-memory store plus two
 * route handlers. It is framework-agnostic — the handlers take a plain
 * `HttpRequest` and return a plain `HttpResponse`, so they can be adapted to
 * Express, Fastify, Hono, or a raw `node:http` server with a thin shim.
 *
 * Design decisions worth calling out (the things a real production bulk-delete
 * has to get right, not just the happy path):
 *
 *  - Filters are validated and constrained. An empty / absent filter is
 *    rejected outright: "delete everything" must be explicit, never the
 *    accidental default of a missing query param.
 *  - Preview before commit. A `dry-run` (preview) endpoint returns the count
 *    and a sample of what *would* be deleted, so the UI can show a confirmation
 *    dialog with real numbers before anything is destroyed.
 *  - Soft delete by default. Deletion marks records `deletedAt` rather than
 *    dropping them, so an accidental bulk-delete is recoverable. A `hard`
 *    flag is available for genuine purges.
 *  - Confirmation guard. Destructive commits require an explicit
 *    `confirm: true` in the body — a defence against a mis-wired UI firing the
 *    commit endpoint.
 *  - Idempotency. A caller-supplied `Idempotency-Key` makes a retried request
 *    (network blip, double-click) return the original result instead of
 *    deleting a second, different set of records.
 *  - Authorization. Every route checks the caller is an authenticated admin.
 *  - Audit trail. Every committed bulk-delete is recorded (who, when, filter,
 *    affected ids) for accountability and post-incident review.
 *  - Bounded blast radius. A single call will not delete more than
 *    `MAX_DELETE_BATCH` records without an explicit override, so a too-broad
 *    filter fails loudly instead of wiping the table.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type RecordStatus = 'active' | 'pending' | 'archived' | 'suspended';

export interface StoredRecord {
  id: string;
  status: RecordStatus;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** Set when the record has been soft-deleted; null while live. */
  deletedAt: string | null;
  /** Arbitrary payload — irrelevant to deletion, kept so records feel real. */
  data?: Record<string, unknown>;
}

/**
 * The filter an admin builds in the UI. All present clauses are ANDed together.
 * At least one clause must be present — see `validateFilter`.
 */
export interface DeleteFilter {
  /** Delete records created strictly before this ISO-8601 instant. */
  olderThan?: string;
  /** Delete records whose status is one of these. */
  statuses?: RecordStatus[];
  /** Restrict to a specific set of ids (e.g. from a UI multi-select). */
  ids?: string[];
}

export interface AdminContext {
  adminId: string;
  isAdmin: boolean;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Refuse to delete more than this in one call unless `force: true` is set. */
export const MAX_DELETE_BATCH = 10_000;

/** How many matching records to return as a sample in a preview. */
const PREVIEW_SAMPLE_SIZE = 25;

const VALID_STATUSES: ReadonlySet<RecordStatus> = new Set<RecordStatus>([
  'active',
  'pending',
  'archived',
  'suspended',
]);

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

export interface AuditEntry {
  id: string;
  adminId: string;
  at: string;
  filter: DeleteFilter;
  mode: 'soft' | 'hard';
  deletedIds: string[];
  idempotencyKey?: string;
}

interface CachedResult {
  key: string;
  at: number;
  result: CommitResult;
}

/**
 * A tiny in-memory record store. In production this would be a repository over
 * a real database; the shape of the public methods is deliberately close to
 * what such a repository would expose so the route handlers wouldn't change.
 */
export class RecordStore {
  private readonly records = new Map<string, StoredRecord>();
  private readonly audit: AuditEntry[] = [];
  private readonly idempotencyCache = new Map<string, CachedResult>();
  private seq = 0;

  /** Seed / insert a record. Primarily for tests and bootstrapping. */
  put(record: Omit<StoredRecord, 'deletedAt'> & { deletedAt?: string | null }): StoredRecord {
    const full: StoredRecord = { deletedAt: null, ...record };
    this.records.set(full.id, full);
    return full;
  }

  get(id: string): StoredRecord | undefined {
    return this.records.get(id);
  }

  /** All records, including soft-deleted ones. */
  all(): StoredRecord[] {
    return [...this.records.values()];
  }

  /** Live (not soft-deleted) records matching the filter. */
  match(filter: DeleteFilter): StoredRecord[] {
    const olderThanMs = filter.olderThan !== undefined ? Date.parse(filter.olderThan) : undefined;
    const statusSet = filter.statuses !== undefined ? new Set(filter.statuses) : undefined;
    const idSet = filter.ids !== undefined ? new Set(filter.ids) : undefined;

    const out: StoredRecord[] = [];
    for (const r of this.records.values()) {
      if (r.deletedAt !== null) continue; // already gone
      if (idSet !== undefined && !idSet.has(r.id)) continue;
      if (statusSet !== undefined && !statusSet.has(r.status)) continue;
      if (olderThanMs !== undefined) {
        const created = Date.parse(r.createdAt);
        if (!(created < olderThanMs)) continue;
      }
      out.push(r);
    }
    return out;
  }

  /**
   * Apply a delete to a concrete set of records. Returns the ids actually
   * affected. Soft delete stamps `deletedAt`; hard delete removes the row.
   */
  applyDelete(records: StoredRecord[], mode: 'soft' | 'hard', at: string): string[] {
    const ids: string[] = [];
    for (const r of records) {
      if (mode === 'hard') {
        this.records.delete(r.id);
      } else {
        r.deletedAt = at;
      }
      ids.push(r.id);
    }
    return ids;
  }

  recordAudit(entry: Omit<AuditEntry, 'id'>): AuditEntry {
    const full: AuditEntry = { id: `audit_${++this.seq}`, ...entry };
    this.audit.push(full);
    return full;
  }

  auditLog(): readonly AuditEntry[] {
    return this.audit;
  }

  getCachedResult(key: string): CommitResult | undefined {
    return this.idempotencyCache.get(key)?.result;
  }

  cacheResult(key: string, result: CommitResult): void {
    this.idempotencyCache.set(key, { key, at: Date.now(), result });
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Parse and validate an untrusted filter from a request body/query.
 * Throws ValidationError with an actionable message on any problem.
 */
export function validateFilter(raw: unknown): DeleteFilter {
  if (raw === null || typeof raw !== 'object') {
    throw new ValidationError('filter must be an object');
  }
  const input = raw as Record<string, unknown>;
  const filter: DeleteFilter = {};

  if (input.olderThan !== undefined) {
    if (typeof input.olderThan !== 'string' || Number.isNaN(Date.parse(input.olderThan))) {
      throw new ValidationError('filter.olderThan must be a valid ISO-8601 date string');
    }
    filter.olderThan = input.olderThan;
  }

  if (input.statuses !== undefined) {
    if (!Array.isArray(input.statuses) || input.statuses.length === 0) {
      throw new ValidationError('filter.statuses must be a non-empty array');
    }
    for (const s of input.statuses) {
      if (typeof s !== 'string' || !VALID_STATUSES.has(s as RecordStatus)) {
        throw new ValidationError(`filter.statuses contains an invalid status: ${String(s)}`);
      }
    }
    filter.statuses = [...new Set(input.statuses as RecordStatus[])];
  }

  if (input.ids !== undefined) {
    if (!Array.isArray(input.ids) || input.ids.length === 0) {
      throw new ValidationError('filter.ids must be a non-empty array');
    }
    for (const id of input.ids) {
      if (typeof id !== 'string' || id.length === 0) {
        throw new ValidationError('filter.ids must contain only non-empty strings');
      }
    }
    filter.ids = [...new Set(input.ids as string[])];
  }

  // The single most important guard: never let an empty filter mean
  // "match everything". A bulk delete must always be scoped by something.
  if (filter.olderThan === undefined && filter.statuses === undefined && filter.ids === undefined) {
    throw new ValidationError('filter must include at least one of: olderThan, statuses, ids');
  }

  return filter;
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

export interface PreviewResult {
  matched: number;
  /** Whether this filter would exceed MAX_DELETE_BATCH. */
  exceedsLimit: boolean;
  limit: number;
  /** A small sample of matching records for the confirmation dialog. */
  sample: StoredRecord[];
  filter: DeleteFilter;
}

export interface CommitResult {
  deleted: number;
  deletedIds: string[];
  mode: 'soft' | 'hard';
  auditId: string;
  filter: DeleteFilter;
  /** True when this response was served from the idempotency cache. */
  replayed: boolean;
}

/** Compute what a delete would affect, without changing anything. */
export function previewDelete(store: RecordStore, filter: DeleteFilter): PreviewResult {
  const matches = store.match(filter);
  return {
    matched: matches.length,
    exceedsLimit: matches.length > MAX_DELETE_BATCH,
    limit: MAX_DELETE_BATCH,
    sample: matches.slice(0, PREVIEW_SAMPLE_SIZE),
    filter,
  };
}

export interface CommitOptions {
  mode?: 'soft' | 'hard';
  /** Override the MAX_DELETE_BATCH safety limit for this call. */
  force?: boolean;
  idempotencyKey?: string;
}

/**
 * Execute the bulk delete. Enforces the batch limit, records an audit entry,
 * and honours idempotency keys so retries are safe.
 */
export function commitDelete(
  store: RecordStore,
  admin: AdminContext,
  filter: DeleteFilter,
  opts: CommitOptions = {},
): CommitResult {
  const mode = opts.mode ?? 'soft';

  if (opts.idempotencyKey) {
    const cached = store.getCachedResult(opts.idempotencyKey);
    if (cached) return { ...cached, replayed: true };
  }

  const matches = store.match(filter);

  if (matches.length > MAX_DELETE_BATCH && !opts.force) {
    throw new ValidationError(
      `filter matches ${matches.length} records, which exceeds the safety limit of ` +
        `${MAX_DELETE_BATCH}. Narrow the filter or set force: true to override.`,
    );
  }

  const at = new Date().toISOString();
  const deletedIds = store.applyDelete(matches, mode, at);

  const audit = store.recordAudit({
    adminId: admin.adminId,
    at,
    filter,
    mode,
    deletedIds,
    idempotencyKey: opts.idempotencyKey,
  });

  const result: CommitResult = {
    deleted: deletedIds.length,
    deletedIds,
    mode,
    auditId: audit.id,
    filter,
    replayed: false,
  };

  if (opts.idempotencyKey) {
    store.cacheResult(opts.idempotencyKey, result);
  }

  return result;
}

// ---------------------------------------------------------------------------
// HTTP layer (framework-agnostic)
// ---------------------------------------------------------------------------

export interface HttpRequest {
  method: string;
  /** Parsed JSON body (already deserialized by the framework/middleware). */
  body?: unknown;
  headers?: Record<string, string | undefined>;
  /** The authenticated caller, populated by auth middleware. */
  admin?: AdminContext;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}

function json(status: number, body: unknown): HttpResponse {
  return { status, body };
}

function requireAdmin(req: HttpRequest): AdminContext {
  const admin = req.admin;
  if (!admin || !admin.isAdmin) {
    throw new AuthError();
  }
  return admin;
}

class AuthError extends Error {
  constructor() {
    super('admin authentication required');
    this.name = 'AuthError';
  }
}

function handleErrors(fn: () => HttpResponse): HttpResponse {
  try {
    return fn();
  } catch (err) {
    if (err instanceof AuthError) {
      return json(403, { error: err.message });
    }
    if (err instanceof ValidationError) {
      return json(400, { error: err.message });
    }
    // Unexpected: do not leak internals to the client.
    return json(500, { error: 'internal error' });
  }
}

/**
 * Route handlers. Wire these into your router, e.g.:
 *
 *   POST /admin/records/bulk-delete/preview  -> routes.preview
 *   POST /admin/records/bulk-delete          -> routes.commit
 *   GET  /admin/records/bulk-delete/audit    -> routes.audit
 *
 * Preview is a POST (not GET) because the filter can be large and structured,
 * and because it must never be cached by intermediaries.
 */
export function makeRoutes(store: RecordStore) {
  return {
    preview(req: HttpRequest): HttpResponse {
      return handleErrors(() => {
        requireAdmin(req);
        if (req.method !== 'POST') return json(405, { error: 'method not allowed' });
        const body = (req.body ?? {}) as Record<string, unknown>;
        const filter = validateFilter(body.filter);
        return json(200, previewDelete(store, filter));
      });
    },

    commit(req: HttpRequest): HttpResponse {
      return handleErrors(() => {
        const admin = requireAdmin(req);
        if (req.method !== 'POST') return json(405, { error: 'method not allowed' });
        const body = (req.body ?? {}) as Record<string, unknown>;

        // Destructive commits require an explicit confirmation flag so a
        // mis-wired UI can't fire a delete by simply hitting the endpoint.
        if (body.confirm !== true) {
          throw new ValidationError('confirm must be true to execute a bulk delete');
        }

        const filter = validateFilter(body.filter);

        const mode = body.hard === true ? 'hard' : 'soft';
        const force = body.force === true;
        const idempotencyKey =
          req.headers?.['idempotency-key'] ??
          (typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined);

        const result = commitDelete(store, admin, filter, { mode, force, idempotencyKey });
        return json(200, result);
      });
    },

    audit(req: HttpRequest): HttpResponse {
      return handleErrors(() => {
        requireAdmin(req);
        if (req.method !== 'GET') return json(405, { error: 'method not allowed' });
        return json(200, { entries: store.auditLog() });
      });
    },
  };
}

export type Routes = ReturnType<typeof makeRoutes>;
