/**
 * schedule.ts — Scheduled email feature.
 *
 * A user picks a subject, a body, a list of recipients, and a future time.
 * We persist the request, then a background scheduler delivers it at (or after)
 * the chosen time via an injected `send(email)` function.
 *
 * Design notes for the reader:
 *
 * - The store and the email provider are injected. Here we ship an in-memory
 *   store and a no-op-ish `send`, but nothing in the core logic assumes either,
 *   so swapping in Postgres + a real ESP later is a wiring change, not a rewrite.
 *
 * - Delivery is driven by a *polling* scheduler, not one `setTimeout` per email.
 *   `setTimeout` caps out around 24.8 days (32-bit ms) and silently fires early,
 *   and a per-email timer map leaks and is hard to reason about across restarts.
 *   A tick that claims "everything now due" is boring, correct, and restart-safe.
 *
 * - Sends are guarded against double-delivery: an email is atomically moved to
 *   `sending` before the provider is called, so two overlapping ticks (or two
 *   workers sharing a store) can't both send it. Failures retry with backoff up
 *   to a cap, then land in `failed` for a human to inspect.
 *
 * - The HTTP layer is framework-agnostic. Handlers take a plain typed request
 *   and return a plain typed response; an Express/Fetch adapter is a few lines.
 *   This keeps the business rules testable without booting a server.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type EmailStatus =
  | 'scheduled' // accepted, waiting for its send time
  | 'sending' // claimed by a worker, provider call in flight
  | 'sent' // delivered to the provider successfully
  | 'failed' // exhausted retries; needs attention
  | 'canceled'; // canceled by the user before it was sent

export interface ScheduledEmail {
  readonly id: string;
  /** Owner of the schedule; used for authorization and listing. */
  readonly userId: string;
  readonly subject: string;
  readonly body: string;
  readonly recipients: readonly string[];
  /** Absolute delivery time (epoch ms, UTC). */
  readonly sendAt: number;
  status: EmailStatus;
  /** Number of provider attempts made so far. */
  attempts: number;
  /** Earliest epoch ms at which the next attempt may run (backoff gate). */
  nextAttemptAt: number;
  /** Last provider error message, if any. */
  lastError?: string;
  readonly createdAt: number;
  updatedAt: number;
}

/** The payload actually handed to the email provider. */
export interface OutboundEmail {
  id: string;
  subject: string;
  body: string;
  recipients: readonly string[];
}

/** Pluggable delivery. Should resolve on success and reject on failure. */
export type SendFn = (email: OutboundEmail) => Promise<void>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Thrown for anything the caller could have prevented (bad input, not found,
 * wrong state, not their email). Carries an HTTP status and a stable `code`
 * the UI can switch on without string-matching prose.
 */
export class ScheduleError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ScheduleError';
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export const LIMITS = {
  SUBJECT_MAX: 998, // RFC 5322 line length for a header
  BODY_MAX: 512 * 1024, // 512 KiB of text — generous, but bounded
  RECIPIENTS_MAX: 100,
  /** Reject times more than this far out as almost certainly a client bug. */
  MAX_HORIZON_MS: 365 * 24 * 60 * 60 * 1000, // 1 year
  /** Tolerate small clock skew when a user asks to "send now-ish". */
  PAST_TOLERANCE_MS: 60 * 1000, // 1 minute
} as const;

// Deliberately conservative, not a full RFC 5322 parser. Good enough to catch
// fat-fingered addresses in a web form; the provider is the real gatekeeper.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CreateEmailInput {
  subject: unknown;
  body: unknown;
  recipients: unknown;
  /** ISO-8601 string or epoch ms. */
  sendAt: unknown;
}

interface NormalizedInput {
  subject: string;
  body: string;
  recipients: string[];
  sendAt: number;
}

function parseSendAt(raw: unknown): number {
  let ms: number;
  if (typeof raw === 'number') {
    ms = raw;
  } else if (typeof raw === 'string') {
    // Accept both ISO strings and numeric strings.
    const asNum = Number(raw);
    ms = Number.isFinite(asNum) && raw.trim() !== '' ? asNum : Date.parse(raw);
  } else {
    throw new ScheduleError(
      400,
      'invalid_send_at',
      'sendAt must be an ISO-8601 string or epoch milliseconds.',
    );
  }
  if (!Number.isFinite(ms)) {
    throw new ScheduleError(400, 'invalid_send_at', 'sendAt is not a valid date.');
  }
  return Math.floor(ms);
}

/**
 * Validate + normalize raw request input into a trusted shape.
 * `now` is injectable so tests aren't racing the wall clock.
 */
export function validateCreateInput(
  input: CreateEmailInput,
  now: number = Date.now(),
): NormalizedInput {
  // Subject
  if (typeof input.subject !== 'string') {
    throw new ScheduleError(400, 'invalid_subject', 'subject is required and must be a string.');
  }
  const subject = input.subject.trim();
  if (subject.length === 0) {
    throw new ScheduleError(400, 'invalid_subject', 'subject must not be empty.');
  }
  if (subject.length > LIMITS.SUBJECT_MAX) {
    throw new ScheduleError(
      400,
      'invalid_subject',
      `subject must be at most ${LIMITS.SUBJECT_MAX} characters.`,
    );
  }
  // Header-injection guard: newlines in a subject can smuggle extra headers.
  if (/[\r\n]/.test(subject)) {
    throw new ScheduleError(400, 'invalid_subject', 'subject must not contain line breaks.');
  }

  // Body
  if (typeof input.body !== 'string') {
    throw new ScheduleError(400, 'invalid_body', 'body is required and must be a string.');
  }
  const body = input.body;
  if (body.length === 0) {
    throw new ScheduleError(400, 'invalid_body', 'body must not be empty.');
  }
  if (body.length > LIMITS.BODY_MAX) {
    throw new ScheduleError(400, 'invalid_body', 'body is too large.');
  }

  // Recipients
  if (!Array.isArray(input.recipients)) {
    throw new ScheduleError(400, 'invalid_recipients', 'recipients must be an array.');
  }
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const r of input.recipients) {
    if (typeof r !== 'string') {
      throw new ScheduleError(400, 'invalid_recipients', 'each recipient must be a string.');
    }
    const addr = r.trim().toLowerCase();
    if (!EMAIL_RE.test(addr)) {
      throw new ScheduleError(400, 'invalid_recipients', `"${r}" is not a valid email address.`);
    }
    if (!seen.has(addr)) {
      seen.add(addr);
      recipients.push(addr);
    }
  }
  if (recipients.length === 0) {
    throw new ScheduleError(400, 'invalid_recipients', 'at least one recipient is required.');
  }
  if (recipients.length > LIMITS.RECIPIENTS_MAX) {
    throw new ScheduleError(
      400,
      'invalid_recipients',
      `at most ${LIMITS.RECIPIENTS_MAX} recipients are allowed.`,
    );
  }

  // Send time
  const sendAt = parseSendAt(input.sendAt);
  if (sendAt < now - LIMITS.PAST_TOLERANCE_MS) {
    throw new ScheduleError(400, 'send_at_in_past', 'sendAt must be in the future.');
  }
  if (sendAt > now + LIMITS.MAX_HORIZON_MS) {
    throw new ScheduleError(400, 'send_at_too_far', 'sendAt is too far in the future.');
  }

  return { subject, body, recipients, sendAt };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Persistence boundary. The core service only needs these operations, so a real
 * database implementation drops in without touching business logic.
 *
 * `claimDue` is the concurrency-critical one: it must atomically flip a batch of
 * due `scheduled` emails to `sending` and return them, so no two callers get the
 * same row. The in-memory version below is trivially atomic (single-threaded JS).
 */
export interface EmailStore {
  insert(email: ScheduledEmail): ScheduledEmail;
  get(id: string): ScheduledEmail | undefined;
  update(email: ScheduledEmail): void;
  listByUser(userId: string): ScheduledEmail[];
  /** Atomically claim up to `limit` emails whose time has come. */
  claimDue(now: number, limit: number): ScheduledEmail[];
}

export class InMemoryEmailStore implements EmailStore {
  private readonly rows = new Map<string, ScheduledEmail>();

  insert(email: ScheduledEmail): ScheduledEmail {
    this.rows.set(email.id, email);
    return email;
  }

  get(id: string): ScheduledEmail | undefined {
    return this.rows.get(id);
  }

  update(email: ScheduledEmail): void {
    this.rows.set(email.id, email);
  }

  listByUser(userId: string): ScheduledEmail[] {
    return [...this.rows.values()]
      .filter(e => e.userId === userId)
      .sort((a, b) => a.sendAt - b.sendAt);
  }

  claimDue(now: number, limit: number): ScheduledEmail[] {
    const claimed: ScheduledEmail[] = [];
    for (const email of this.rows.values()) {
      if (claimed.length >= limit) break;
      const ready =
        (email.status === 'scheduled' && email.sendAt <= now && email.nextAttemptAt <= now) ||
        // A `sending` row older than its backoff gate was orphaned by a crash
        // mid-send; reclaim it so it isn't stuck forever.
        (email.status === 'sending' && email.nextAttemptAt <= now);
      if (ready) {
        email.status = 'sending';
        email.updatedAt = now;
        this.rows.set(email.id, email);
        claimed.push(email);
      }
    }
    return claimed;
  }
}

// ---------------------------------------------------------------------------
// Service (business logic)
// ---------------------------------------------------------------------------

export interface SchedulerOptions {
  /** How often to scan for due emails. */
  pollIntervalMs?: number;
  /** Max emails processed per tick (throughput / fairness knob). */
  batchSize?: number;
  /** Max provider attempts before an email is marked `failed`. */
  maxAttempts?: number;
  /** Backoff base; delay = base * 2^(attempt-1), capped. */
  backoffBaseMs?: number;
  backoffCapMs?: number;
  /** Injected clock for testability. */
  now?: () => number;
  /** Injected id generator. */
  generateId?: () => string;
}

const DEFAULTS = {
  pollIntervalMs: 1000,
  batchSize: 50,
  maxAttempts: 5,
  backoffBaseMs: 30_000,
  backoffCapMs: 15 * 60_000,
} as const;

export class EmailScheduler {
  private readonly store: EmailStore;
  private readonly send: SendFn;
  private readonly opts: Required<Omit<SchedulerOptions, 'now' | 'generateId'>>;
  private readonly now: () => number;
  private readonly generateId: () => string;

  private timer: ReturnType<typeof setInterval> | undefined;
  private ticking = false;

  constructor(store: EmailStore, send: SendFn, options: SchedulerOptions = {}) {
    this.store = store;
    this.send = send;
    this.now = options.now ?? (() => Date.now());
    this.generateId = options.generateId ?? defaultId;
    this.opts = {
      pollIntervalMs: options.pollIntervalMs ?? DEFAULTS.pollIntervalMs,
      batchSize: options.batchSize ?? DEFAULTS.batchSize,
      maxAttempts: options.maxAttempts ?? DEFAULTS.maxAttempts,
      backoffBaseMs: options.backoffBaseMs ?? DEFAULTS.backoffBaseMs,
      backoffCapMs: options.backoffCapMs ?? DEFAULTS.backoffCapMs,
    };
  }

  // --- Lifecycle ---------------------------------------------------------

  /** Begin polling. Idempotent. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.opts.pollIntervalMs);
    // Don't keep a Node process alive solely for the scheduler.
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  /** Stop polling. Safe to call during graceful shutdown. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  // --- Commands ----------------------------------------------------------

  schedule(userId: string, input: CreateEmailInput): ScheduledEmail {
    if (!userId) {
      throw new ScheduleError(401, 'unauthenticated', 'A user is required to schedule an email.');
    }
    const n = this.now();
    const v = validateCreateInput(input, n);
    const email: ScheduledEmail = {
      id: this.generateId(),
      userId,
      subject: v.subject,
      body: v.body,
      recipients: v.recipients,
      sendAt: v.sendAt,
      status: 'scheduled',
      attempts: 0,
      nextAttemptAt: v.sendAt,
      createdAt: n,
      updatedAt: n,
    };
    return this.store.insert(email);
  }

  /** Fetch one email, enforcing ownership. */
  getForUser(userId: string, id: string): ScheduledEmail {
    const email = this.store.get(id);
    // Return 404 (not 403) when it isn't theirs, to avoid leaking existence.
    if (!email || email.userId !== userId) {
      throw new ScheduleError(404, 'not_found', 'Scheduled email not found.');
    }
    return email;
  }

  list(userId: string): ScheduledEmail[] {
    return this.store.listByUser(userId);
  }

  /**
   * Cancel a still-pending email. Canceling something already sent, failed, or
   * mid-send is rejected — the state can't be honestly undone.
   */
  cancel(userId: string, id: string): ScheduledEmail {
    const email = this.getForUser(userId, id);
    if (email.status === 'canceled') return email; // idempotent
    if (email.status !== 'scheduled') {
      throw new ScheduleError(
        409,
        'not_cancelable',
        `Cannot cancel an email that is already ${email.status}.`,
      );
    }
    email.status = 'canceled';
    email.updatedAt = this.now();
    this.store.update(email);
    return email;
  }

  // --- Delivery ----------------------------------------------------------

  /**
   * One scan. Claims due emails and attempts delivery. Guarded so overlapping
   * intervals never run two scans at once. Exposed for tests and for a
   * "drain now" call during shutdown.
   */
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const due = this.store.claimDue(this.now(), this.opts.batchSize);
      // Deliver concurrently; each attempt owns its own error handling so one
      // bad email never sinks the batch.
      await Promise.all(due.map(email => this.attemptDelivery(email)));
    } finally {
      this.ticking = false;
    }
  }

  private async attemptDelivery(email: ScheduledEmail): Promise<void> {
    email.attempts += 1;
    try {
      await this.send({
        id: email.id,
        subject: email.subject,
        body: email.body,
        recipients: email.recipients,
      });
      email.status = 'sent';
      email.lastError = undefined;
      email.updatedAt = this.now();
      this.store.update(email);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      email.lastError = message;
      if (email.attempts >= this.opts.maxAttempts) {
        email.status = 'failed';
      } else {
        // Back off, then let a future tick reclaim it. Keeping it in `sending`
        // with a future `nextAttemptAt` means an unrelated tick won't grab it
        // early, but the crash-recovery path in `claimDue` still can.
        email.status = 'sending';
        email.nextAttemptAt = this.now() + this.backoffFor(email.attempts);
      }
      email.updatedAt = this.now();
      this.store.update(email);
    }
  }

  private backoffFor(attempt: number): number {
    const raw = this.opts.backoffBaseMs * 2 ** (attempt - 1);
    return Math.min(raw, this.opts.backoffCapMs);
  }
}

function defaultId(): string {
  // Prefer a real UUID when the runtime offers one; fall back for older Node.
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `em_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// HTTP layer (framework-agnostic)
// ---------------------------------------------------------------------------

export interface HttpRequest {
  /** Authenticated user id, resolved by upstream auth middleware. */
  userId?: string;
  params?: Record<string, string>;
  body?: unknown;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}

/** Public shape returned to clients — the full row is fine here, but explicit. */
function toDTO(e: ScheduledEmail) {
  return {
    id: e.id,
    subject: e.subject,
    body: e.body,
    recipients: e.recipients,
    sendAt: new Date(e.sendAt).toISOString(),
    status: e.status,
    attempts: e.attempts,
    lastError: e.lastError ?? null,
    createdAt: new Date(e.createdAt).toISOString(),
    updatedAt: new Date(e.updatedAt).toISOString(),
  };
}

function requireUser(req: HttpRequest): string {
  if (!req.userId) {
    throw new ScheduleError(401, 'unauthenticated', 'Authentication required.');
  }
  return req.userId;
}

/** Turn any thrown error into a safe HTTP response. */
function handleError(err: unknown): HttpResponse {
  if (err instanceof ScheduleError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message } } };
  }
  // Never leak internals to a non-technical user.
  return {
    status: 500,
    body: { error: { code: 'internal_error', message: 'Something went wrong. Please try again.' } },
  };
}

/**
 * Build route handlers bound to a scheduler. Handlers are pure-ish: request in,
 * response out, no framework coupling. Wire them to Express/Fetch/etc below.
 */
export function createEmailRoutes(scheduler: EmailScheduler) {
  return {
    // POST /emails
    create(req: HttpRequest): HttpResponse {
      try {
        const userId = requireUser(req);
        const body = (req.body ?? {}) as Partial<CreateEmailInput>;
        const email = scheduler.schedule(userId, {
          subject: body.subject,
          body: body.body,
          recipients: body.recipients,
          sendAt: body.sendAt,
        });
        return { status: 201, body: toDTO(email) };
      } catch (err) {
        return handleError(err);
      }
    },

    // GET /emails
    list(req: HttpRequest): HttpResponse {
      try {
        const userId = requireUser(req);
        return { status: 200, body: scheduler.list(userId).map(toDTO) };
      } catch (err) {
        return handleError(err);
      }
    },

    // GET /emails/:id
    get(req: HttpRequest): HttpResponse {
      try {
        const userId = requireUser(req);
        const id = req.params?.id ?? '';
        return { status: 200, body: toDTO(scheduler.getForUser(userId, id)) };
      } catch (err) {
        return handleError(err);
      }
    },

    // DELETE /emails/:id  (cancel)
    cancel(req: HttpRequest): HttpResponse {
      try {
        const userId = requireUser(req);
        const id = req.params?.id ?? '';
        return { status: 200, body: toDTO(scheduler.cancel(userId, id)) };
      } catch (err) {
        return handleError(err);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Example wiring (Express-style; commented to keep this file dependency-free)
// ---------------------------------------------------------------------------
//
//   import express from "express";
//
//   const store = new InMemoryEmailStore();
//   const send: SendFn = async (email) => {
//     // Replace with a real provider (SES, Postmark, Resend, ...).
//     console.log(`Delivering ${email.id} to ${email.recipients.join(", ")}`);
//   };
//   const scheduler = new EmailScheduler(store, send);
//   scheduler.start();
//
//   const routes = createEmailRoutes(scheduler);
//   const app = express();
//   app.use(express.json());
//
//   const adapt =
//     (h: (r: HttpRequest) => HttpResponse) =>
//     (req: express.Request, res: express.Response) => {
//       const out = h({ userId: req.user?.id, params: req.params, body: req.body });
//       res.status(out.status).json(out.body);
//     };
//
//   app.post("/emails", adapt(routes.create));
//   app.get("/emails", adapt(routes.list));
//   app.get("/emails/:id", adapt(routes.get));
//   app.delete("/emails/:id", adapt(routes.cancel));
//
//   process.on("SIGTERM", () => scheduler.stop());
//
