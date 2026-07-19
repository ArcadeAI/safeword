/**
 * Scheduled-email feature.
 *
 * A single, dependency-free module that lets a non-technical end user schedule
 * an email (subject, body, recipients) to be delivered at a chosen future time,
 * plus the HTTP route handlers that drive it from the web UI.
 *
 * Persistence is an in-memory store and delivery is a pluggable `send(email)`
 * function — swap either for a real database / email provider without touching
 * the surrounding logic.
 *
 * Design notes for the reader:
 *  - The lifecycle is explicit: scheduled -> sending -> sent | failed | canceled.
 *  - Validation happens once, at the edge, and returns user-facing messages a
 *    non-technical person can act on ("Recipient 2 is not a valid email").
 *  - Delivery is retried with backoff; a job is only ever sent once on success
 *    (idempotency guard) even if timers overlap.
 *  - The scheduler survives process restarts logically: on startup you call
 *    `scheduler.recover()` to re-arm timers (and immediately flush anything whose
 *    time already passed while the process was down).
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type EmailStatus = 'scheduled' | 'sending' | 'sent' | 'failed' | 'canceled';

/** The payload actually handed to the transport. */
export interface Email {
  readonly subject: string;
  readonly body: string;
  readonly recipients: readonly string[];
}

/** A scheduled job: an email plus its lifecycle metadata. */
export interface ScheduledEmail extends Email {
  readonly id: string;
  /** Owner of the job — used to scope reads/cancels to the requesting user. */
  readonly ownerId: string;
  /** Epoch millis at which delivery should occur. */
  readonly sendAt: number;
  status: EmailStatus;
  attempts: number;
  readonly createdAt: number;
  updatedAt: number;
  /** Last transport error message, if the job failed. */
  lastError?: string;
  /** When the job actually left the building. */
  sentAt?: number;
}

/** Transport contract. Return normally on success, throw to signal failure. */
export type SendFn = (email: Email) => Promise<void> | void;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Raised for anything the caller did wrong. Carries an HTTP status and a
 * message safe to show a non-technical user, plus optional field-level detail.
 */
export class ValidationError extends Error {
  readonly status: number;
  readonly fields?: Record<string, string>;
  constructor(message: string, fields?: Record<string, string>, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
    this.fields = fields;
  }
}

export class NotFoundError extends Error {
  readonly status = 404;
  constructor(message = 'Scheduled email not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** State-machine violation, e.g. canceling an email that already sent. */
export class ConflictError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const MAX_RECIPIENTS = 100;
const MAX_SUBJECT_LEN = 998; // RFC 5322 line-length ceiling for a header.
const MAX_BODY_LEN = 500_000; // ~500 KB of text; guards against accidental huge payloads.

/**
 * Deliberately pragmatic email check. A perfect regex is a myth and the real
 * gate is the provider's bounce handling; this rejects obvious typos while
 * accepting the shapes real users type.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ScheduleEmailInput {
  subject: unknown;
  body: unknown;
  recipients: unknown;
  /** ISO-8601 string or epoch millis — the UI may send either. */
  sendAt: unknown;
}

export interface ValidatedInput {
  subject: string;
  body: string;
  recipients: string[];
  sendAt: number;
}

/**
 * Parse and validate raw request input into a trusted shape. Throws
 * ValidationError with user-facing messages; never trusts caller-supplied
 * status fields, ids, or timestamps.
 *
 * @param now injectable clock (millis) for testability.
 */
export function validateInput(raw: ScheduleEmailInput, now: number = Date.now()): ValidatedInput {
  const fields: Record<string, string> = {};

  // --- subject ---
  const subject = typeof raw.subject === 'string' ? raw.subject.trim() : '';
  if (!subject) {
    fields.subject = 'Please enter a subject.';
  } else if (subject.length > MAX_SUBJECT_LEN) {
    fields.subject = `Subject is too long (max ${MAX_SUBJECT_LEN} characters).`;
  }

  // --- body ---
  // A blank body is allowed (some reminders are subject-only) but the field
  // must be a string, not missing/number/object.
  const body = typeof raw.body === 'string' ? raw.body : '';
  if (typeof raw.body !== 'string') {
    fields.body = 'Body must be text.';
  } else if (body.length > MAX_BODY_LEN) {
    fields.body = 'Body is too long.';
  }

  // --- recipients ---
  const recipients: string[] = [];
  if (!Array.isArray(raw.recipients) || raw.recipients.length === 0) {
    fields.recipients = 'Add at least one recipient.';
  } else if (raw.recipients.length > MAX_RECIPIENTS) {
    fields.recipients = `Too many recipients (max ${MAX_RECIPIENTS}).`;
  } else {
    const seen = new Set<string>();
    raw.recipients.forEach((r, i) => {
      if (typeof r !== 'string' || !EMAIL_RE.test(r.trim())) {
        // 1-indexed for humans reading the UI.
        fields[`recipients[${i}]`] = `Recipient ${i + 1} is not a valid email address.`;
        return;
      }
      // De-dupe case-insensitively so nobody gets the same mail twice.
      const normalized = r.trim().toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        recipients.push(r.trim());
      }
    });
    if (recipients.length === 0 && !fields.recipients) {
      fields.recipients = 'Add at least one valid recipient.';
    }
  }

  // --- sendAt ---
  const sendAt = parseSendAt(raw.sendAt);
  if (sendAt === null) {
    fields.sendAt = 'Choose a valid send time.';
  } else if (sendAt <= now) {
    fields.sendAt = 'The send time must be in the future.';
  }

  if (Object.keys(fields).length > 0) {
    throw new ValidationError('Some fields need attention.', fields);
  }

  return { subject, body, recipients, sendAt: sendAt as number };
}

function parseSendAt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Store (in-memory; swap for a DB behind this interface)
// ---------------------------------------------------------------------------

export interface EmailStore {
  create(job: ScheduledEmail): ScheduledEmail;
  get(id: string): ScheduledEmail | undefined;
  update(job: ScheduledEmail): void;
  listByOwner(ownerId: string): ScheduledEmail[];
  /** Jobs still eligible to send (used by recovery on startup). */
  listPending(): ScheduledEmail[];
}

export class InMemoryEmailStore implements EmailStore {
  private readonly rows = new Map<string, ScheduledEmail>();

  create(job: ScheduledEmail): ScheduledEmail {
    this.rows.set(job.id, job);
    return job;
  }

  get(id: string): ScheduledEmail | undefined {
    return this.rows.get(id);
  }

  update(job: ScheduledEmail): void {
    job.updatedAt = Date.now();
    this.rows.set(job.id, job);
  }

  listByOwner(ownerId: string): ScheduledEmail[] {
    return [...this.rows.values()]
      .filter(j => j.ownerId === ownerId)
      .sort((a, b) => a.sendAt - b.sendAt);
  }

  listPending(): ScheduledEmail[] {
    return [...this.rows.values()].filter(j => j.status === 'scheduled');
  }
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

export interface SchedulerOptions {
  /** Max delivery attempts before a job is marked failed. */
  maxAttempts?: number;
  /** Base backoff (ms) between retries; grows exponentially. */
  retryBaseMs?: number;
  /** Injectable clock for tests. */
  now?: () => number;
  /**
   * setTimeout may not fire far in the future reliably (and 32-bit overflow at
   * ~24.8 days). We cap a single timer and re-arm for anything longer.
   */
  maxTimerMs?: number;
  /** Optional structured logger; defaults to console. */
  logger?: Pick<Console, 'error' | 'info'>;
}

const DEFAULTS = {
  maxAttempts: 3,
  retryBaseMs: 30_000,
  maxTimerMs: 2_000_000_000, // ~23 days, under the 2^31-1 setTimeout ceiling.
};

export class EmailScheduler {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly now: () => number;
  private readonly maxAttempts: number;
  private readonly retryBaseMs: number;
  private readonly maxTimerMs: number;
  private readonly logger: Pick<Console, 'error' | 'info'>;

  constructor(
    private readonly store: EmailStore,
    private readonly send: SendFn,
    opts: SchedulerOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.maxAttempts = opts.maxAttempts ?? DEFAULTS.maxAttempts;
    this.retryBaseMs = opts.retryBaseMs ?? DEFAULTS.retryBaseMs;
    this.maxTimerMs = opts.maxTimerMs ?? DEFAULTS.maxTimerMs;
    this.logger = opts.logger ?? console;
  }

  /** Create + persist a job and arm its timer. */
  schedule(input: ValidatedInput, ownerId: string): ScheduledEmail {
    const ts = this.now();
    const job: ScheduledEmail = {
      id: generateId(),
      ownerId,
      subject: input.subject,
      body: input.body,
      recipients: input.recipients,
      sendAt: input.sendAt,
      status: 'scheduled',
      attempts: 0,
      createdAt: ts,
      updatedAt: ts,
    };
    this.store.create(job);
    this.arm(job);
    return job;
  }

  /**
   * Cancel a scheduled email. Only the owner may cancel, and only while it is
   * still "scheduled" — once it is sending/sent it is too late.
   */
  cancel(id: string, ownerId: string): ScheduledEmail {
    const job = this.requireOwned(id, ownerId);
    if (job.status !== 'scheduled') {
      throw new ConflictError(`This email can't be canceled because it is already ${job.status}.`);
    }
    this.disarm(id);
    job.status = 'canceled';
    this.store.update(job);
    return job;
  }

  get(id: string, ownerId: string): ScheduledEmail {
    return this.requireOwned(id, ownerId);
  }

  list(ownerId: string): ScheduledEmail[] {
    return this.store.listByOwner(ownerId);
  }

  /**
   * Re-arm timers after a process restart. Anything whose send time already
   * passed while we were down is flushed immediately (best-effort catch-up).
   * Idempotent: safe to call once at boot.
   */
  recover(): void {
    for (const job of this.store.listPending()) {
      this.arm(job);
    }
  }

  /** Clear all timers, e.g. on graceful shutdown. Does not mutate jobs. */
  stop(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  // --- internals ---

  private arm(job: ScheduledEmail): void {
    this.disarm(job.id); // never double-arm.
    const delay = Math.max(0, job.sendAt - this.now());

    if (delay > this.maxTimerMs) {
      // Too far out for one timer: sleep a chunk, then re-evaluate.
      const t = setTimeout(() => {
        const fresh = this.store.get(job.id);
        if (fresh && fresh.status === 'scheduled') this.arm(fresh);
      }, this.maxTimerMs);
      unref(t);
      this.timers.set(job.id, t);
      return;
    }

    const t = setTimeout(() => {
      void this.fire(job.id);
    }, delay);
    unref(t);
    this.timers.set(job.id, t);
  }

  private disarm(id: string): void {
    const t = this.timers.get(id);
    if (t) {
      clearTimeout(t);
      this.timers.delete(id);
    }
  }

  /**
   * Attempt delivery with the idempotency + retry state machine. Reads a fresh
   * copy of the job each time so a cancel that raced the timer is respected.
   */
  private async fire(id: string): Promise<void> {
    this.disarm(id);
    const job = this.store.get(id);
    if (!job) return;

    // Guard: only fire jobs that are still eligible. This prevents a
    // double-send if two timers ever overlap or recover() double-arms.
    if (job.status !== 'scheduled') return;

    job.status = 'sending';
    job.attempts += 1;
    this.store.update(job);

    try {
      await this.send({
        subject: job.subject,
        body: job.body,
        recipients: job.recipients,
      });
      job.status = 'sent';
      job.sentAt = this.now();
      job.lastError = undefined;
      this.store.update(job);
      this.logger.info(`[email] sent ${job.id} to ${job.recipients.length} recipient(s)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      job.lastError = message;

      if (job.attempts >= this.maxAttempts) {
        job.status = 'failed';
        this.store.update(job);
        this.logger.error(
          `[email] giving up on ${job.id} after ${job.attempts} attempt(s): ${message}`,
        );
        return;
      }

      // Retry with exponential backoff. Return to "scheduled" so the state
      // guard and recovery treat it as a live job again.
      job.status = 'scheduled';
      this.store.update(job);
      const backoff = this.retryBaseMs * 2 ** (job.attempts - 1);
      this.logger.error(
        `[email] attempt ${job.attempts} for ${job.id} failed (${message}); retrying in ${backoff}ms`,
      );
      const t = setTimeout(() => void this.fire(id), backoff);
      unref(t);
      this.timers.set(id, t);
    }
  }

  private requireOwned(id: string, ownerId: string): ScheduledEmail {
    const job = this.store.get(id);
    // Return 404 (not 403) when another user's id is guessed, so we don't leak
    // the existence of other users' jobs.
    if (!job || job.ownerId !== ownerId) throw new NotFoundError();
    return job;
  }
}

// ---------------------------------------------------------------------------
// HTTP route handlers (framework-agnostic)
// ---------------------------------------------------------------------------

/**
 * Minimal request/response shapes so these handlers work with Express, Fastify,
 * a fetch-style handler, or a test harness. `ownerId` is expected to be set by
 * your auth middleware — never trust it from the request body.
 */
export interface HttpRequest {
  body: unknown;
  params: Record<string, string>;
  ownerId?: string;
}

export interface HttpResult {
  status: number;
  body: unknown;
}

export class EmailRoutes {
  constructor(private readonly scheduler: EmailScheduler) {}

  /** POST /emails — schedule a new email. */
  schedule = (req: HttpRequest): HttpResult =>
    this.guard(req, ownerId => {
      const raw = (req.body ?? {}) as ScheduleEmailInput;
      const input = validateInput(raw);
      const job = this.scheduler.schedule(input, ownerId);
      return { status: 201, body: present(job) };
    });

  /** GET /emails — list the caller's scheduled emails. */
  list = (req: HttpRequest): HttpResult =>
    this.guard(req, ownerId => ({
      status: 200,
      body: this.scheduler.list(ownerId).map(present),
    }));

  /** GET /emails/:id — fetch one. */
  get = (req: HttpRequest): HttpResult =>
    this.guard(req, ownerId => ({
      status: 200,
      body: present(this.scheduler.get(req.params.id, ownerId)),
    }));

  /** DELETE /emails/:id — cancel a still-scheduled email. */
  cancel = (req: HttpRequest): HttpResult =>
    this.guard(req, ownerId => ({
      status: 200,
      body: present(this.scheduler.cancel(req.params.id, ownerId)),
    }));

  /** Centralized auth check + error-to-HTTP mapping. */
  private guard(req: HttpRequest, fn: (ownerId: string) => HttpResult): HttpResult {
    if (!req.ownerId) {
      return { status: 401, body: { error: 'Sign in to manage scheduled emails.' } };
    }
    try {
      return fn(req.ownerId);
    } catch (err) {
      return toHttpError(err);
    }
  }
}

function toHttpError(err: unknown): HttpResult {
  if (err instanceof ValidationError) {
    return { status: err.status, body: { error: err.message, fields: err.fields } };
  }
  if (err instanceof NotFoundError || err instanceof ConflictError) {
    return { status: err.status, body: { error: err.message } };
  }
  // Never leak internals to the UI.
  return { status: 500, body: { error: 'Something went wrong. Please try again.' } };
}

/** Public projection — hides nothing sensitive here, but is the seam if that changes. */
function present(job: ScheduledEmail) {
  return {
    id: job.id,
    subject: job.subject,
    body: job.body,
    recipients: job.recipients,
    sendAt: new Date(job.sendAt).toISOString(),
    status: job.status,
    attempts: job.attempts,
    createdAt: new Date(job.createdAt).toISOString(),
    updatedAt: new Date(job.updatedAt).toISOString(),
    sentAt: job.sentAt ? new Date(job.sentAt).toISOString() : null,
    lastError: job.lastError ?? null,
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function generateId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  // Fallback for older runtimes.
  return 'email_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

/** In Node, don't let a pending timer keep the process alive. No-op elsewhere. */
function unref(t: ReturnType<typeof setTimeout>): void {
  (t as { unref?: () => void }).unref?.();
}

// ---------------------------------------------------------------------------
// Wiring helper
// ---------------------------------------------------------------------------

/**
 * Convenience factory that assembles the default in-memory stack. In real
 * production you would pass a DB-backed store and a provider-backed send fn,
 * then call `scheduler.recover()` once at boot.
 *
 * @example
 *   const { routes, scheduler } = createEmailFeature(async (email) => {
 *     await mailProvider.send(email);
 *   });
 *   scheduler.recover();
 *   app.post("/emails", (req, res) => {
 *     const r = routes.schedule({ body: req.body, params: req.params, ownerId: req.user?.id });
 *     res.status(r.status).json(r.body);
 *   });
 */
export function createEmailFeature(send: SendFn, opts?: SchedulerOptions) {
  const store = new InMemoryEmailStore();
  const scheduler = new EmailScheduler(store, send, opts);
  const routes = new EmailRoutes(scheduler);
  return { store, scheduler, routes };
}
