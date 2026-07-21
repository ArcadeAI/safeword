/**
 * Bulk-delete feature for an admin web app.
 *
 * An admin selects a filter (records older than a date, and/or with a given
 * status) and every matching record is deleted. This module provides:
 *
 *   - An in-memory record store (stand-in for a real database/repository).
 *   - Filter parsing + validation.
 *   - A "preview" endpoint so the admin sees exactly what will be deleted
 *     BEFORE committing (the single most important safety affordance for a
 *     destructive bulk action).
 *   - A "delete" endpoint that requires an explicit confirmation token derived
 *     from the preview, so the UI cannot fire a delete for a different or
 *     larger set than the admin actually reviewed.
 *   - Soft-delete by default (recoverable) with an opt-in hard delete.
 *   - Batched deletion, an audit trail, and structured errors.
 *
 * The HTTP handlers use the web-standard `Request`/`Response` types so this
 * module has zero framework dependencies; adapting to Express/Koa/etc. is a
 * thin wrapper. Wiring (auth middleware, mounting routes) is noted at the end.
 */

// ---------------------------------------------------------------------------
// Domain model
// ---------------------------------------------------------------------------

export type RecordStatus = 'active' | 'pending' | 'archived' | 'banned';

export interface StoredRecord {
  id: string;
  status: RecordStatus;
  /** Creation time, epoch millis. Used by the "older than" filter. */
  createdAt: number;
  /** Soft-delete marker. `null` means live. */
  deletedAt: number | null;
  /** Who deleted it, for the audit trail. */
  deletedBy: string | null;
  // ... other domain fields would live here.
  [key: string]: unknown;
}

/**
 * The filter an admin builds in the UI. All present conditions are ANDed.
 * At least one condition must be set — an empty filter would match everything,
 * which is exactly the "oops I deleted the whole table" footgun we refuse.
 */
export interface DeleteFilter {
  /** Delete records created strictly before this instant (epoch millis). */
  olderThan?: number;
  /** Delete records whose status is in this set. */
  statuses?: RecordStatus[];
}

const VALID_STATUSES: ReadonlySet<RecordStatus> = new Set<RecordStatus>([
  'active',
  'pending',
  'archived',
  'banned',
]);

/** Hard ceiling on a single bulk delete. Protects against runaway operations
 *  and accidental mass deletion. Tune per product; make it explicit. */
export const MAX_DELETE_BATCH = 10_000;

/** Delete in chunks so one operation never monopolises the event loop / a DB
 *  transaction, and so progress is observable/resumable in a real backend. */
const DELETION_CHUNK_SIZE = 500;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ValidationError extends Error {
  readonly status = 400;
  readonly code = 'invalid_filter';
}

export class AuthError extends Error {
  readonly status = 403;
  readonly code = 'forbidden';
}

export class ConfirmationError extends Error {
  readonly status = 409;
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export class LimitExceededError extends Error {
  readonly status = 422;
  readonly code = 'limit_exceeded';
}

// ---------------------------------------------------------------------------
// Store (in-memory stand-in for a repository)
// ---------------------------------------------------------------------------

export interface AuditEntry {
  at: number;
  actor: string;
  filter: DeleteFilter;
  mode: 'soft' | 'hard';
  deletedIds: string[];
}

export class RecordStore {
  private records = new Map<string, StoredRecord>();
  private audit: AuditEntry[] = [];

  seed(records: StoredRecord[]): void {
    for (const r of records) this.records.set(r.id, r);
  }

  /** Records matching the filter that are still live (not already soft-deleted). */
  match(filter: DeleteFilter): StoredRecord[] {
    const out: StoredRecord[] = [];
    for (const r of this.records.values()) {
      if (r.deletedAt !== null) continue; // already gone
      if (filter.olderThan !== undefined && !(r.createdAt < filter.olderThan)) {
        continue;
      }
      if (filter.statuses !== undefined && !filter.statuses.includes(r.status)) {
        continue;
      }
      out.push(r);
    }
    // Stable ordering makes previews and confirmation fingerprints deterministic.
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  softDelete(id: string, actor: string, at: number): boolean {
    const r = this.records.get(id);
    if (!r || r.deletedAt !== null) return false;
    r.deletedAt = at;
    r.deletedBy = actor;
    return true;
  }

  hardDelete(id: string): boolean {
    return this.records.delete(id);
  }

  recordAudit(entry: AuditEntry): void {
    this.audit.push(entry);
  }

  getAudit(): readonly AuditEntry[] {
    return this.audit;
  }
}

// ---------------------------------------------------------------------------
// Filter parsing / validation
// ---------------------------------------------------------------------------

/**
 * Parse and validate an untrusted filter payload. Rejects empty filters and
 * malformed values rather than silently coercing — a destructive endpoint
 * should be strict about its inputs.
 */
export function parseFilter(input: unknown): DeleteFilter {
  if (input === null || typeof input !== 'object') {
    throw new ValidationError('filter must be an object');
  }
  const raw = input as Record<string, unknown>;
  const filter: DeleteFilter = {};

  if (raw.olderThan !== undefined && raw.olderThan !== null) {
    const ms = normaliseInstant(raw.olderThan);
    if (ms === null) {
      throw new ValidationError('olderThan must be an ISO-8601 date string or epoch millis');
    }
    filter.olderThan = ms;
  }

  if (raw.statuses !== undefined && raw.statuses !== null) {
    if (!Array.isArray(raw.statuses) || raw.statuses.length === 0) {
      throw new ValidationError('statuses must be a non-empty array');
    }
    const statuses: RecordStatus[] = [];
    for (const s of raw.statuses) {
      if (typeof s !== 'string' || !VALID_STATUSES.has(s as RecordStatus)) {
        throw new ValidationError(`unknown status: ${JSON.stringify(s)}`);
      }
      if (!statuses.includes(s as RecordStatus)) statuses.push(s as RecordStatus);
    }
    filter.statuses = statuses;
  }

  if (filter.olderThan === undefined && filter.statuses === undefined) {
    throw new ValidationError(
      'filter must contain at least one condition (olderThan and/or statuses)',
    );
  }

  return filter;
}

function normaliseInstant(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

/**
 * A short, stable fingerprint of exactly which records a preview covered.
 * The client echoes this back on delete; if the live match no longer produces
 * the same fingerprint (records changed underneath the admin), we refuse and
 * make them re-preview. This is the guard against TOCTOU surprises.
 */
export function fingerprint(ids: string[]): string {
  // djb2 over the sorted, joined ids. Not cryptographic — a change detector.
  let h = 5381;
  const joined = ids.join(',');
  for (let i = 0; i < joined.length; i++) {
    h = ((h << 5) + h + joined.charCodeAt(i)) | 0;
  }
  return `${ids.length}:${(h >>> 0).toString(16)}`;
}

// ---------------------------------------------------------------------------
// Core deletion logic
// ---------------------------------------------------------------------------

export interface DeleteResult {
  requested: number;
  deleted: number;
  mode: 'soft' | 'hard';
  deletedIds: string[];
}

export interface DeleteOptions {
  actor: string;
  hard?: boolean;
  now?: () => number;
}

/**
 * Delete every live record matching `filter`. Enforces the batch ceiling,
 * deletes in chunks, and writes an audit entry. Soft by default.
 */
export function bulkDelete(
  store: RecordStore,
  filter: DeleteFilter,
  options: DeleteOptions,
): DeleteResult {
  const now = options.now ?? Date.now;
  const mode: 'soft' | 'hard' = options.hard ? 'hard' : 'soft';

  const matches = store.match(filter);
  if (matches.length > MAX_DELETE_BATCH) {
    throw new LimitExceededError(
      `filter matches ${matches.length} records, exceeding the limit of ${MAX_DELETE_BATCH}; narrow the filter`,
    );
  }

  const deletedIds: string[] = [];
  for (let i = 0; i < matches.length; i += DELETION_CHUNK_SIZE) {
    const chunk = matches.slice(i, i + DELETION_CHUNK_SIZE);
    const at = now();
    for (const r of chunk) {
      const ok =
        mode === 'hard' ? store.hardDelete(r.id) : store.softDelete(r.id, options.actor, at);
      if (ok) deletedIds.push(r.id);
    }
  }

  store.recordAudit({
    at: now(),
    actor: options.actor,
    filter,
    mode,
    deletedIds,
  });

  return {
    requested: matches.length,
    deleted: deletedIds.length,
    mode,
    deletedIds,
  };
}

// ---------------------------------------------------------------------------
// HTTP layer
// ---------------------------------------------------------------------------

export interface AdminContext {
  userId: string;
  isAdmin: boolean;
}

/**
 * Resolve the caller. In production this reads a verified session/JWT set by
 * upstream auth middleware. Here it is pluggable so the routes stay testable.
 */
export type Authenticator = (req: Request) => AdminContext | null;

function requireAdmin(auth: Authenticator, req: Request): AdminContext {
  const ctx = auth(req);
  if (!ctx) throw new AuthError('authentication required');
  if (!ctx.isAdmin) throw new AuthError('admin privileges required');
  return ctx;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(err: unknown): Response {
  if (
    err instanceof ValidationError ||
    err instanceof AuthError ||
    err instanceof ConfirmationError ||
    err instanceof LimitExceededError
  ) {
    return json({ error: err.code, message: err.message }, err.status);
  }
  // Never leak internals on an unexpected failure.
  return json({ error: 'internal_error', message: 'unexpected error' }, 500);
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ValidationError('request body must be valid JSON');
  }
}

export interface RouteDeps {
  store: RecordStore;
  auth: Authenticator;
  now?: () => number;
}

/**
 * POST /admin/records/bulk-delete/preview
 *
 * Body: { filter: DeleteFilter }
 * Returns the count, a sample, and a confirmation token. Read-only — deletes
 * nothing. The UI shows this to the admin before enabling the delete button.
 */
export async function handlePreview(req: Request, deps: RouteDeps): Promise<Response> {
  try {
    requireAdmin(deps.auth, req);
    const body = (await readJson(req)) as Record<string, unknown>;
    const filter = parseFilter(body.filter);

    const matches = deps.store.match(filter);
    const ids = matches.map(r => r.id);
    const overLimit = matches.length > MAX_DELETE_BATCH;

    return json({
      count: matches.length,
      overLimit,
      limit: MAX_DELETE_BATCH,
      confirmationToken: fingerprint(ids),
      sample: matches.slice(0, 20).map(r => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * POST /admin/records/bulk-delete
 *
 * Body: { filter, confirmationToken, hard? }
 *
 * The confirmationToken must match a fresh evaluation of the filter, proving
 * the admin is deleting the exact set they previewed. If the data shifted
 * underneath them, we return 409 and force a re-preview.
 */
export async function handleDelete(req: Request, deps: RouteDeps): Promise<Response> {
  try {
    const ctx = requireAdmin(deps.auth, req);
    const body = (await readJson(req)) as Record<string, unknown>;
    const filter = parseFilter(body.filter);

    if (typeof body.confirmationToken !== 'string') {
      throw new ConfirmationError(
        'confirmationToken is required; call the preview endpoint first',
        'confirmation_required',
      );
    }
    const hard = body.hard === true;

    // Re-evaluate now and verify the set is unchanged since the preview.
    const currentIds = deps.store.match(filter).map(r => r.id);
    if (fingerprint(currentIds) !== body.confirmationToken) {
      throw new ConfirmationError(
        'the set of matching records changed since preview; re-run the preview and confirm again',
        'confirmation_stale',
      );
    }

    const result = bulkDelete(deps.store, filter, {
      actor: ctx.userId,
      hard,
      now: deps.now,
    });

    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Minimal router so the two handlers can be mounted without a framework.
 * Returns null for unmatched routes so a host app can fall through.
 *
 * In a real app you would instead register `handlePreview` / `handleDelete`
 * on your framework of choice, behind auth middleware, with rate limiting on
 * the delete route and structured request logging.
 */
export function createRouter(deps: RouteDeps) {
  return async function route(req: Request): Promise<Response | null> {
    const { pathname } = new URL(req.url);
    if (req.method !== 'POST') return null;
    if (pathname === '/admin/records/bulk-delete/preview') {
      return handlePreview(req, deps);
    }
    if (pathname === '/admin/records/bulk-delete') {
      return handleDelete(req, deps);
    }
    return null;
  };
}
