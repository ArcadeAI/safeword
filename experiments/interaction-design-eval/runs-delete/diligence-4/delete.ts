/**
 * Bulk-delete feature for an admin-facing web app.
 *
 * An admin picks a filter (records older than a date, records with a given
 * status, or a combination) and every matching record is deleted.
 *
 * This module exposes:
 *   - A small in-memory record store (stand-in for a real database).
 *   - The deletion logic (`planDeletion`, `executeDeletion`).
 *   - Framework-agnostic HTTP route handlers.
 *
 * Design notes / why it looks like this:
 *   - Bulk delete is destructive and irreversible from the caller's point of
 *     view, so the whole flow is built around *not* deleting the wrong thing:
 *       * The filter must be non-empty. A request that matches "everything"
 *         is rejected unless the caller explicitly opts in (`allowMatchAll`),
 *         so a dropped/blank filter can never wipe the table.
 *       * A dry-run / preview path (`POST .../preview`) lets the UI show the
 *         count and a sample before anything is destroyed.
 *       * A confirmation token derived from the preview must be echoed back on
 *         the real delete, so the admin confirms the *same* result set they saw
 *         (guards against the data shifting between preview and delete).
 *       * Soft delete by default (records are tombstoned, not dropped), with an
 *         explicit `hardDelete` flag for permanent removal.
 *   - Every operation is authorized (admin only), validated, audited, and safe
 *     to retry (idempotency key support).
 */

// ---------------------------------------------------------------------------
// Domain model
// ---------------------------------------------------------------------------

export type RecordStatus = 'active' | 'pending' | 'archived' | 'flagged';

export interface StoredRecord {
  id: string;
  status: RecordStatus;
  createdAt: number; // epoch millis
  updatedAt: number; // epoch millis
  ownerId: string;
  payload: Record<string, unknown>;
  // Soft-delete tombstone fields. Undefined => live record.
  deletedAt?: number;
  deletedBy?: string;
}

/**
 * The filter an admin composes in the UI. All present fields are ANDed
 * together. A filter with no fields set matches every live record and is
 * rejected unless `allowMatchAll` is passed to the planner.
 */
export interface DeletionFilter {
  /** Delete records with createdAt strictly older than this epoch-millis. */
  olderThan?: number;
  /** Delete records whose status is one of these. */
  statusIn?: RecordStatus[];
  /** Restrict to a single owner (e.g. deleting one tenant's data). */
  ownerId?: string;
}

export interface DeletionOptions {
  /** Permanently remove instead of tombstoning. Defaults to false. */
  hardDelete?: boolean;
  /**
   * Cap on how many records a single call may delete. Protects against a
   * runaway match. If the match exceeds this, the call is rejected rather
   * than partially applied. Defaults to DEFAULT_MAX_DELETIONS.
   */
  maxDeletions?: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type DeletionErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_FILTER'
  | 'EMPTY_FILTER'
  | 'LIMIT_EXCEEDED'
  | 'CONFIRMATION_MISMATCH'
  | 'NOTHING_MATCHED';

export class DeletionError extends Error {
  constructor(
    public readonly code: DeletionErrorCode,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'DeletionError';
  }
}

// ---------------------------------------------------------------------------
// In-memory store (stand-in for a database)
// ---------------------------------------------------------------------------

export class RecordStore {
  private readonly records = new Map<string, StoredRecord>();
  /** Remembers processed idempotency keys -> the result they produced. */
  private readonly idempotencyCache = new Map<string, DeletionResult>();

  seed(records: StoredRecord[]): void {
    for (const r of records) this.records.set(r.id, { ...r });
  }

  get(id: string): StoredRecord | undefined {
    const r = this.records.get(id);
    return r ? { ...r } : undefined;
  }

  /** All records that are not tombstoned. Returned as copies. */
  liveRecords(): StoredRecord[] {
    const out: StoredRecord[] = [];
    for (const r of this.records.values()) {
      if (r.deletedAt === undefined) out.push({ ...r });
    }
    return out;
  }

  count(): number {
    let n = 0;
    for (const r of this.records.values()) if (r.deletedAt === undefined) n++;
    return n;
  }

  // --- internal mutation used only by executeDeletion ---

  _tombstone(id: string, at: number, by: string): boolean {
    const r = this.records.get(id);
    if (!r || r.deletedAt !== undefined) return false;
    r.deletedAt = at;
    r.deletedBy = by;
    r.updatedAt = at;
    return true;
  }

  _hardDelete(id: string): boolean {
    const r = this.records.get(id);
    if (!r || r.deletedAt !== undefined) return false;
    return this.records.delete(id);
  }

  _rememberIdempotent(key: string, result: DeletionResult): void {
    this.idempotencyCache.set(key, result);
  }

  _recallIdempotent(key: string): DeletionResult | undefined {
    return this.idempotencyCache.get(key);
  }
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

export interface Principal {
  userId: string;
  roles: string[];
}

function requireAdmin(principal: Principal | undefined): Principal {
  if (!principal || !principal.roles.includes('admin')) {
    throw new DeletionError('UNAUTHORIZED', 'Bulk deletion requires an admin principal.', 403);
  }
  return principal;
}

// ---------------------------------------------------------------------------
// Filter validation + matching
// ---------------------------------------------------------------------------

const VALID_STATUSES: readonly RecordStatus[] = ['active', 'pending', 'archived', 'flagged'];

export const DEFAULT_MAX_DELETIONS = 10_000;

/**
 * Validate a filter's shape and return a normalized copy. Throws
 * DeletionError("INVALID_FILTER") on malformed input.
 */
export function validateFilter(raw: unknown): DeletionFilter {
  if (raw === null || typeof raw !== 'object') {
    throw new DeletionError('INVALID_FILTER', 'Filter must be an object.', 400);
  }
  const input = raw as Record<string, unknown>;
  const filter: DeletionFilter = {};

  if (input.olderThan !== undefined) {
    const v = input.olderThan;
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
      throw new DeletionError(
        'INVALID_FILTER',
        '`olderThan` must be a positive epoch-millis timestamp.',
        400,
      );
    }
    filter.olderThan = v;
  }

  if (input.statusIn !== undefined) {
    const v = input.statusIn;
    if (!Array.isArray(v) || v.length === 0) {
      throw new DeletionError(
        'INVALID_FILTER',
        '`statusIn` must be a non-empty array of statuses.',
        400,
      );
    }
    const seen = new Set<RecordStatus>();
    for (const s of v) {
      if (typeof s !== 'string' || !VALID_STATUSES.includes(s as RecordStatus)) {
        throw new DeletionError('INVALID_FILTER', `Unknown status: ${JSON.stringify(s)}.`, 400);
      }
      seen.add(s as RecordStatus);
    }
    filter.statusIn = [...seen];
  }

  if (input.ownerId !== undefined) {
    const v = input.ownerId;
    if (typeof v !== 'string' || v.trim() === '') {
      throw new DeletionError('INVALID_FILTER', '`ownerId` must be a non-empty string.', 400);
    }
    filter.ownerId = v;
  }

  return filter;
}

function isEmptyFilter(filter: DeletionFilter): boolean {
  return (
    filter.olderThan === undefined && filter.statusIn === undefined && filter.ownerId === undefined
  );
}

function matches(record: StoredRecord, filter: DeletionFilter): boolean {
  if (filter.olderThan !== undefined && !(record.createdAt < filter.olderThan)) {
    return false;
  }
  if (filter.statusIn !== undefined && !filter.statusIn.includes(record.status)) {
    return false;
  }
  if (filter.ownerId !== undefined && record.ownerId !== filter.ownerId) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Confirmation token
// ---------------------------------------------------------------------------

/**
 * Deterministic, order-independent token over the exact set of ids a preview
 * matched. The admin must echo it back to delete, which guarantees they are
 * confirming the same result set they were shown. If the data shifted between
 * preview and delete, the token no longer matches and the call is rejected.
 *
 * A non-cryptographic FNV-1a hash is fine here: the token is an integrity
 * check against accidental drift, not a security boundary.
 */
export function confirmationToken(ids: string[]): string {
  const sorted = [...ids].sort();
  let h = 0x811c9dc5;
  const feed = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  };
  for (const id of sorted) {
    feed(id);
    feed(' ');
  }
  return `del_${sorted.length}_${h.toString(16).padStart(8, '0')}`;
}

// ---------------------------------------------------------------------------
// Planning (preview / dry-run)
// ---------------------------------------------------------------------------

export interface DeletionPlan {
  matchedCount: number;
  matchedIds: string[];
  sample: StoredRecord[];
  confirmationToken: string;
  hardDelete: boolean;
  filter: DeletionFilter;
}

export interface PlanParams {
  filter: DeletionFilter;
  hardDelete?: boolean;
  maxDeletions?: number;
  /** Explicit opt-in required to act on a filter that matches everything. */
  allowMatchAll?: boolean;
  sampleSize?: number;
}

const DEFAULT_SAMPLE_SIZE = 25;

/**
 * Compute which records a filter would delete, without mutating anything.
 * This backs both the preview endpoint and the first phase of execution, so
 * preview and delete can never diverge in how they interpret a filter.
 */
export function planDeletion(store: RecordStore, params: PlanParams): DeletionPlan {
  const filter = params.filter;
  const hardDelete = params.hardDelete ?? false;
  const limit = params.maxDeletions ?? DEFAULT_MAX_DELETIONS;
  const sampleSize = params.sampleSize ?? DEFAULT_SAMPLE_SIZE;

  if (isEmptyFilter(filter) && !params.allowMatchAll) {
    throw new DeletionError(
      'EMPTY_FILTER',
      'Refusing to delete: filter is empty and would match every record. ' +
        'Set `allowMatchAll: true` to intentionally delete everything.',
      400,
    );
  }

  const matched = store.liveRecords().filter(r => matches(r, filter));
  // Stable order so the confirmation token and sample are deterministic.
  matched.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  if (matched.length > limit) {
    throw new DeletionError(
      'LIMIT_EXCEEDED',
      `Filter matched ${matched.length} records, over the limit of ${limit}. ` +
        'Narrow the filter or raise `maxDeletions`.',
      422,
    );
  }

  const matchedIds = matched.map(r => r.id);
  return {
    matchedCount: matched.length,
    matchedIds,
    sample: matched.slice(0, sampleSize),
    confirmationToken: confirmationToken(matchedIds),
    hardDelete,
    filter,
  };
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface DeletionResult {
  deletedCount: number;
  deletedIds: string[];
  hardDelete: boolean;
  performedBy: string;
  performedAt: number;
  idempotent: boolean; // true if replayed from an earlier identical call
}

export interface ExecuteParams extends PlanParams {
  principal: Principal;
  /** Token from the preview the admin confirmed. */
  confirmationToken?: string;
  /** Opt out of the confirmation check (e.g. programmatic callers). */
  skipConfirmation?: boolean;
  /** De-dupes retried requests. Same key => same result, applied once. */
  idempotencyKey?: string;
  now?: () => number;
  audit?: AuditSink;
}

export interface AuditEntry {
  action: 'bulk_delete';
  performedBy: string;
  performedAt: number;
  filter: DeletionFilter;
  hardDelete: boolean;
  deletedCount: number;
  deletedIds: string[];
}

export type AuditSink = (entry: AuditEntry) => void;

/**
 * Execute the deletion. Re-plans against the *current* store state, checks the
 * confirmation token against that fresh plan, then applies the deletion in a
 * single pass. Safe to retry via `idempotencyKey`.
 */
export function executeDeletion(store: RecordStore, params: ExecuteParams): DeletionResult {
  const principal = requireAdmin(params.principal);
  const now = params.now ?? Date.now;

  if (params.idempotencyKey) {
    const cached = store._recallIdempotent(params.idempotencyKey);
    if (cached) return { ...cached, idempotent: true };
  }

  const plan = planDeletion(store, params);

  if (plan.matchedCount === 0) {
    throw new DeletionError('NOTHING_MATCHED', 'No live records match the filter.', 404);
  }

  if (!params.skipConfirmation) {
    if (params.confirmationToken !== plan.confirmationToken) {
      throw new DeletionError(
        'CONFIRMATION_MISMATCH',
        'Confirmation token does not match the current result set. ' +
          'The data may have changed since preview; re-run preview and confirm again.',
        409,
      );
    }
  }

  const performedAt = now();
  const deletedIds: string[] = [];
  for (const id of plan.matchedIds) {
    const ok =
      (params.hardDelete ?? false)
        ? store._hardDelete(id)
        : store._tombstone(id, performedAt, principal.userId);
    if (ok) deletedIds.push(id);
  }

  const result: DeletionResult = {
    deletedCount: deletedIds.length,
    deletedIds,
    hardDelete: params.hardDelete ?? false,
    performedBy: principal.userId,
    performedAt,
    idempotent: false,
  };

  params.audit?.({
    action: 'bulk_delete',
    performedBy: principal.userId,
    performedAt,
    filter: plan.filter,
    hardDelete: result.hardDelete,
    deletedCount: result.deletedCount,
    deletedIds: result.deletedIds,
  });

  if (params.idempotencyKey) {
    store._rememberIdempotent(params.idempotencyKey, result);
  }

  return result;
}

// ---------------------------------------------------------------------------
// HTTP route handlers (framework-agnostic)
// ---------------------------------------------------------------------------

export interface HttpRequest {
  principal?: Principal;
  body: unknown;
  headers?: Record<string, string | undefined>;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}

function parseBody(body: unknown): {
  filter: DeletionFilter;
  hardDelete: boolean;
  maxDeletions?: number;
  allowMatchAll: boolean;
  confirmationToken?: string;
} {
  const b = (body ?? {}) as Record<string, unknown>;
  const filter = validateFilter(b.filter);
  const hardDelete = b.hardDelete === true;
  const allowMatchAll = b.allowMatchAll === true;
  let maxDeletions: number | undefined;
  if (b.maxDeletions !== undefined) {
    if (
      typeof b.maxDeletions !== 'number' ||
      !Number.isInteger(b.maxDeletions) ||
      b.maxDeletions <= 0
    ) {
      throw new DeletionError('INVALID_FILTER', '`maxDeletions` must be a positive integer.', 400);
    }
    maxDeletions = b.maxDeletions;
  }
  const confirmationToken =
    typeof b.confirmationToken === 'string' ? b.confirmationToken : undefined;
  return { filter, hardDelete, maxDeletions, allowMatchAll, confirmationToken };
}

function toResponse(err: unknown): HttpResponse {
  if (err instanceof DeletionError) {
    return { status: err.httpStatus, body: { error: err.code, message: err.message } };
  }
  return { status: 500, body: { error: 'INTERNAL', message: 'Unexpected error.' } };
}

/**
 * POST /admin/records/bulk-delete/preview
 * Dry-run: returns count, a sample, and a confirmation token. No mutation.
 */
export function handlePreview(store: RecordStore, req: HttpRequest): HttpResponse {
  try {
    requireAdmin(req.principal);
    const parsed = parseBody(req.body);
    const plan = planDeletion(store, {
      filter: parsed.filter,
      hardDelete: parsed.hardDelete,
      maxDeletions: parsed.maxDeletions,
      allowMatchAll: parsed.allowMatchAll,
    });
    return {
      status: 200,
      body: {
        matchedCount: plan.matchedCount,
        sample: plan.sample,
        confirmationToken: plan.confirmationToken,
        hardDelete: plan.hardDelete,
      },
    };
  } catch (err) {
    return toResponse(err);
  }
}

/**
 * POST /admin/records/bulk-delete
 * Executes the deletion. Requires the confirmation token from preview.
 * Honors an `Idempotency-Key` header for safe retries.
 */
export function handleBulkDelete(store: RecordStore, req: HttpRequest): HttpResponse {
  try {
    const principal = requireAdmin(req.principal);
    const parsed = parseBody(req.body);
    const idempotencyKey = req.headers?.['idempotency-key'];
    const result = executeDeletion(store, {
      principal,
      filter: parsed.filter,
      hardDelete: parsed.hardDelete,
      maxDeletions: parsed.maxDeletions,
      allowMatchAll: parsed.allowMatchAll,
      confirmationToken: parsed.confirmationToken,
      idempotencyKey,
    });
    return {
      status: 200,
      body: {
        deletedCount: result.deletedCount,
        deletedIds: result.deletedIds,
        hardDelete: result.hardDelete,
        performedBy: result.performedBy,
        performedAt: result.performedAt,
        idempotent: result.idempotent,
      },
    };
  } catch (err) {
    return toResponse(err);
  }
}

/**
 * Convenience wiring for a router that maps (method, path) -> handler.
 * Kept framework-agnostic so it drops into Express/Fastify/Hono/etc.
 */
export function createRouter(store: RecordStore) {
  return {
    routes: [
      {
        method: 'POST' as const,
        path: '/admin/records/bulk-delete/preview',
        handler: (req: HttpRequest) => handlePreview(store, req),
      },
      {
        method: 'POST' as const,
        path: '/admin/records/bulk-delete',
        handler: (req: HttpRequest) => handleBulkDelete(store, req),
      },
    ],
  };
}
