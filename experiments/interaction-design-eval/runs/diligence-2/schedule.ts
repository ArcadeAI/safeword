/**
 * schedule.ts — Scheduled-email feature.
 *
 * A single module that lets an end-user schedule an email (subject, body,
 * recipients) to be delivered at a chosen future time, plus the HTTP route
 * handlers that drive it from a web UI.
 *
 * Design notes for whoever maintains this next:
 *
 *  - The store and the timer wheel are in-memory on purpose (per spec). Every
 *    place that would need durability if this were real is called out with a
 *    `DURABILITY:` comment so the swap to a DB + a poll-the-DB dispatcher is a
 *    mechanical change, not a redesign.
 *  - Sending is modeled as an injected `send(email)` function so the transport
 *    (SES, Postmark, SMTP, a fake in tests) is not this module's concern.
 *  - The lifecycle is explicit: scheduled -> sending -> sent | failed, plus
 *    canceled as a terminal state reachable only from `scheduled`. Every state
 *    transition goes through one guarded function so we can't half-send.
 *  - setTimeout can't be trusted for far-future times (32-bit ms overflow,
 *    ~24.8 days) or across process restarts, so the dispatcher re-arms in
 *    bounded hops and, more importantly, a `tick()` sweep is the real source of
 *    truth — the timer is just an optimization to wake us near the due time.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type EmailAddress = string;

/** What the caller wants sent. Transport-agnostic. */
export interface EmailMessage {
  subject: string;
  body: string;
  recipients: EmailAddress[];
}

export type ScheduledEmailStatus = 'scheduled' | 'sending' | 'sent' | 'failed' | 'canceled';

export interface ScheduledEmail {
  id: string;
  /** Owner of the schedule; used to scope list/get/cancel. */
  userId: string;
  message: EmailMessage;
  /** Absolute delivery time, epoch millis (UTC). */
  sendAt: number;
  status: ScheduledEmailStatus;
  attempts: number;
  createdAt: number;
  updatedAt: number;
  /** Set once delivery succeeds. */
  sentAt?: number;
  /** Last error message when status is "failed" (after retries exhausted). */
  lastError?: string;
}

/** The transport. Throw to signal a send failure (retryable). */
export type SendFn = (email: DispatchableEmail) => Promise<void>;

/** What actually gets handed to the transport for one delivery. */
export interface DispatchableEmail {
  id: string;
  subject: string;
  body: string;
  recipients: EmailAddress[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * A validation / precondition failure with an HTTP status and a message safe
 * to show a non-technical user. Thrown by the service, mapped to a response by
 * the route handlers.
 */
export class ScheduleError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ScheduleError';
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

// Deliberately conservative but not clever. We are not trying to fully validate
// RFC 5321 — we reject the obviously-wrong so a typo doesn't silently drop a
// recipient, and leave true deliverability to the transport (bounces).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_SUBJECT_LEN = 998; // RFC 5322 line-length ceiling for a header.
const MAX_BODY_LEN = 500_000; // ~500KB of text; generous, but bounded.
const MAX_RECIPIENTS = 100; // Guardrail against fan-out / accidental blasts.
// Far enough out to cover "next quarter" reminders, bounded so a fat-fingered
// year (e.g. 20260 instead of 2026) is caught instead of scheduled for the
// year 20260.
const MAX_LEAD_MS = 365 * 24 * 60 * 60 * 1000; // 1 year.

// Small skew tolerance so "send in a moment" from a UI whose clock is a hair
// behind the server isn't rejected as being in the past.
const CLOCK_SKEW_TOLERANCE_MS = 60 * 1000;

export interface ScheduleRequest {
  subject?: unknown;
  body?: unknown;
  recipients?: unknown;
  /** ISO 8601 string (preferred — carries the offset) or epoch millis. */
  sendAt?: unknown;
}

interface ValidatedRequest {
  message: EmailMessage;
  sendAt: number;
}

function normalizeEmail(raw: string): EmailAddress {
  return raw.trim().toLowerCase();
}

function validateSendAt(sendAt: unknown, now: number): number {
  let ts: number;

  if (typeof sendAt === 'number') {
    ts = sendAt;
  } else if (typeof sendAt === 'string') {
    const trimmed = sendAt.trim();
    // Accept a numeric string as epoch millis, otherwise parse as a date.
    ts = /^\d+$/.test(trimmed) ? Number(trimmed) : Date.parse(trimmed);
  } else {
    throw new ScheduleError(400, 'A send time is required.', 'send_at_required');
  }

  if (!Number.isFinite(ts)) {
    throw new ScheduleError(
      400,
      "The send time isn't a valid date. Please pick a date and time.",
      'send_at_invalid',
    );
  }

  if (ts < now - CLOCK_SKEW_TOLERANCE_MS) {
    throw new ScheduleError(
      400,
      'That send time is in the past. Please choose a future time.',
      'send_at_in_past',
    );
  }

  if (ts > now + MAX_LEAD_MS) {
    throw new ScheduleError(
      400,
      'That send time is too far in the future (max 1 year out).',
      'send_at_too_far',
    );
  }

  return ts;
}

function validateRecipients(recipients: unknown): EmailAddress[] {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new ScheduleError(400, 'Add at least one recipient.', 'recipients_required');
  }

  const seen = new Set<EmailAddress>();
  const out: EmailAddress[] = [];

  for (const raw of recipients) {
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new ScheduleError(
        400,
        'One of the recipients is empty. Please remove it or fix it.',
        'recipient_invalid',
      );
    }
    const email = normalizeEmail(raw);
    if (!EMAIL_RE.test(email)) {
      throw new ScheduleError(
        400,
        `"${raw}" doesn't look like a valid email address.`,
        'recipient_invalid',
      );
    }
    // De-dupe so a user pasting a list twice doesn't get double emails.
    if (!seen.has(email)) {
      seen.add(email);
      out.push(email);
    }
  }

  if (out.length > MAX_RECIPIENTS) {
    throw new ScheduleError(
      400,
      `Too many recipients (max ${MAX_RECIPIENTS}).`,
      'too_many_recipients',
    );
  }

  return out;
}

function validateRequest(body: ScheduleRequest, now: number): ValidatedRequest {
  if (typeof body.subject !== 'string' || body.subject.trim() === '') {
    throw new ScheduleError(400, 'A subject is required.', 'subject_required');
  }
  const subject = body.subject.trim();
  if (subject.length > MAX_SUBJECT_LEN) {
    throw new ScheduleError(
      400,
      `The subject is too long (max ${MAX_SUBJECT_LEN} characters).`,
      'subject_too_long',
    );
  }

  if (typeof body.body !== 'string' || body.body.trim() === '') {
    throw new ScheduleError(400, "The email body can't be empty.", 'body_required');
  }
  if (body.body.length > MAX_BODY_LEN) {
    throw new ScheduleError(400, 'The email body is too long.', 'body_too_long');
  }

  const recipients = validateRecipients(body.recipients);
  const sendAt = validateSendAt(body.sendAt, now);

  return { message: { subject, body: body.body, recipients }, sendAt };
}

// ---------------------------------------------------------------------------
// Store (in-memory)
// ---------------------------------------------------------------------------

/**
 * DURABILITY: everything below is a Map. Replace with a table keyed by id and
 * indexed on (status, sendAt) so the dispatcher can `SELECT ... WHERE status =
 * 'scheduled' AND sendAt <= now FOR UPDATE SKIP LOCKED`. The service methods
 * are written so that swap touches only this class.
 */
class EmailStore {
  private readonly byId = new Map<string, ScheduledEmail>();

  insert(email: ScheduledEmail): void {
    this.byId.set(email.id, email);
  }

  get(id: string): ScheduledEmail | undefined {
    return this.byId.get(id);
  }

  update(email: ScheduledEmail): void {
    email.updatedAt = Date.now();
    this.byId.set(email.id, email);
  }

  /** Owner-scoped list, newest schedules first. */
  listForUser(userId: string): ScheduledEmail[] {
    const out: ScheduledEmail[] = [];
    for (const e of this.byId.values()) {
      if (e.userId === userId) out.push(e);
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Everything currently due (or overdue) and still awaiting send. */
  dueBefore(cutoff: number): ScheduledEmail[] {
    const out: ScheduledEmail[] = [];
    for (const e of this.byId.values()) {
      if (e.status === 'scheduled' && e.sendAt <= cutoff) out.push(e);
    }
    // Oldest-due first so a backlog drains in order.
    return out.sort((a, b) => a.sendAt - b.sendAt);
  }

  /** Earliest future due time among scheduled emails, for timer arming. */
  nextDueAt(): number | undefined {
    let min: number | undefined;
    for (const e of this.byId.values()) {
      if (e.status !== 'scheduled') continue;
      if (min === undefined || e.sendAt < min) min = e.sendAt;
    }
    return min;
  }
}

// ---------------------------------------------------------------------------
// Service + dispatcher
// ---------------------------------------------------------------------------

export interface SchedulerOptions {
  send: SendFn;
  /** Max retry attempts per email before it's marked failed. Default 3. */
  maxAttempts?: number;
  /** Base backoff between retries, ms. Default 30s, doubled per attempt. */
  retryBackoffMs?: number;
  /** Injectable id generator (tests). Default random. */
  generateId?: () => string;
  /** Injectable clock (tests). Default Date.now. */
  now?: () => number;
}

// setTimeout delays above this overflow its 32-bit signed int and fire almost
// immediately. Cap each hop and let the sweep re-arm.
const MAX_TIMER_MS = 2 ** 31 - 1;

export class EmailScheduler {
  private readonly store = new EmailStore();
  private readonly send: SendFn;
  private readonly maxAttempts: number;
  private readonly retryBackoffMs: number;
  private readonly genId: () => string;
  private readonly now: () => number;

  private timer: ReturnType<typeof setTimeout> | undefined;
  private ticking = false;
  private stopped = false;
  /** Guards against dispatching the same email twice concurrently. */
  private readonly inFlight = new Set<string>();

  constructor(opts: SchedulerOptions) {
    this.send = opts.send;
    this.maxAttempts = opts.maxAttempts ?? 3;
    this.retryBackoffMs = opts.retryBackoffMs ?? 30_000;
    this.genId = opts.generateId ?? defaultId;
    this.now = opts.now ?? Date.now;
    this.arm();
  }

  // -- Public API ----------------------------------------------------------

  schedule(userId: string, req: ScheduleRequest): ScheduledEmail {
    if (!userId) {
      throw new ScheduleError(401, 'You must be signed in.', 'unauthenticated');
    }
    const now = this.now();
    const { message, sendAt } = validateRequest(req, now);

    const email: ScheduledEmail = {
      id: this.genId(),
      userId,
      message,
      sendAt: Math.max(sendAt, now), // never schedule "before now" internally
      status: 'scheduled',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.store.insert(email);
    this.arm(); // this email might be the new soonest-due.
    return email;
  }

  get(userId: string, id: string): ScheduledEmail {
    const email = this.store.get(id);
    // Same 404 for "doesn't exist" and "not yours" — don't leak existence.
    if (!email || email.userId !== userId) {
      throw new ScheduleError(404, "That scheduled email wasn't found.", 'not_found');
    }
    return email;
  }

  list(userId: string): ScheduledEmail[] {
    return this.store.listForUser(userId);
  }

  /**
   * Cancel a still-pending email. Idempotent-ish: canceling an already-canceled
   * one is fine; canceling one that's already sent or mid-send is refused,
   * because at that point the mail is (or may be) out the door.
   */
  cancel(userId: string, id: string): ScheduledEmail {
    const email = this.get(userId, id);
    if (email.status === 'canceled') return email;
    if (email.status !== 'scheduled') {
      throw new ScheduleError(
        409,
        email.status === 'sent'
          ? "This email has already been sent and can't be canceled."
          : "This email is already being sent and can't be canceled.",
        'not_cancelable',
      );
    }
    email.status = 'canceled';
    this.store.update(email);
    return email;
  }

  /**
   * Stop the dispatcher (graceful shutdown). In-flight sends are allowed to
   * settle by the caller awaiting them; no new sends start after this.
   */
  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  // -- Dispatcher ----------------------------------------------------------

  /** Arm the wake-up timer for the next due email (bounded per hop). */
  private arm(): void {
    if (this.stopped) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    const nextDue = this.store.nextDueAt();
    if (nextDue === undefined) return;

    const delay = Math.min(Math.max(nextDue - this.now(), 0), MAX_TIMER_MS);
    this.timer = setTimeout(() => {
      void this.tick();
    }, delay);
    // Don't keep the event loop alive purely for a pending email — let the
    // process exit if nothing else is running. Guarded because some runtimes
    // (browsers) don't return an object with unref.
    if (typeof this.timer === 'object' && this.timer && 'unref' in this.timer) {
      (this.timer as { unref: () => void }).unref();
    }
  }

  /**
   * The real dispatch loop: sweep everything due, send it, re-arm. This is the
   * source of truth — safe to call at any time (e.g. on startup to recover
   * anything whose timer we missed while the process was down).
   */
  async tick(): Promise<void> {
    if (this.stopped) return;
    // Serialize sweeps so two overlapping ticks can't both grab the same email.
    if (this.ticking) return;
    this.ticking = true;
    try {
      const due = this.store.dueBefore(this.now());
      for (const email of due) {
        if (this.stopped) break;
        await this.dispatch(email);
      }
    } finally {
      this.ticking = false;
      this.arm();
    }
  }

  /** Attempt to deliver one email, with retry/backoff and terminal states. */
  private async dispatch(email: ScheduledEmail): Promise<void> {
    // Re-read: it may have been canceled between sweep and now.
    const current = this.store.get(email.id);
    if (!current || current.status !== 'scheduled') return;
    if (this.inFlight.has(current.id)) return;

    // DURABILITY: with a DB this claim is the SKIP LOCKED update to "sending",
    // which is what makes delivery at-most-once across multiple workers.
    this.inFlight.add(current.id);
    current.status = 'sending';
    current.attempts += 1;
    this.store.update(current);

    try {
      await this.send({
        id: current.id,
        subject: current.message.subject,
        body: current.message.body,
        recipients: [...current.message.recipients],
      });
      current.status = 'sent';
      current.sentAt = this.now();
      current.lastError = undefined;
      this.store.update(current);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err);
      if (current.attempts >= this.maxAttempts) {
        current.status = 'failed';
        current.lastError = messageText;
        this.store.update(current);
      } else {
        // Back to scheduled, pushed out by an exponential backoff, so the next
        // sweep picks it up again.
        const backoff = this.retryBackoffMs * 2 ** (current.attempts - 1);
        current.status = 'scheduled';
        current.sendAt = this.now() + backoff;
        current.lastError = messageText;
        this.store.update(current);
      }
    } finally {
      this.inFlight.delete(current.id);
    }
  }
}

function defaultId(): string {
  // crypto.randomUUID where available; fall back for older runtimes.
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `sch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// HTTP route handlers
// ---------------------------------------------------------------------------
//
// Framework-agnostic: each handler takes a tiny request shape and returns a
// { status, body } pair, so it drops into Express, Fastify, Hono, or a plain
// Node http server with a two-line adapter. Auth is assumed to have populated
// `userId` upstream (session middleware); we never trust a userId from the body.

export interface HandlerRequest {
  userId: string | undefined;
  params: Record<string, string | undefined>;
  body: unknown;
}

export interface HandlerResponse {
  status: number;
  body: unknown;
}

function requireUser(req: HandlerRequest): string {
  if (!req.userId) {
    throw new ScheduleError(401, 'You must be signed in.', 'unauthenticated');
  }
  return req.userId;
}

/** Present a stored record to the client (drops nothing sensitive here, but
 *  keeps the wire shape decoupled from the internal record). */
function toDto(email: ScheduledEmail) {
  return {
    id: email.id,
    subject: email.message.subject,
    body: email.message.body,
    recipients: email.message.recipients,
    sendAt: new Date(email.sendAt).toISOString(),
    status: email.status,
    attempts: email.attempts,
    createdAt: new Date(email.createdAt).toISOString(),
    updatedAt: new Date(email.updatedAt).toISOString(),
    sentAt: email.sentAt ? new Date(email.sentAt).toISOString() : null,
    error: email.lastError ?? null,
  };
}

function handle(fn: () => HandlerResponse): HandlerResponse {
  try {
    return fn();
  } catch (err) {
    if (err instanceof ScheduleError) {
      return { status: err.status, body: { error: err.message, code: err.code } };
    }
    // Never leak internals to a non-technical user.
    return {
      status: 500,
      body: { error: 'Something went wrong. Please try again.', code: 'internal' },
    };
  }
}

export function createRoutes(scheduler: EmailScheduler) {
  return {
    /** POST /api/scheduled-emails */
    create(req: HandlerRequest): HandlerResponse {
      return handle(() => {
        const userId = requireUser(req);
        if (typeof req.body !== 'object' || req.body === null) {
          throw new ScheduleError(400, 'Missing request body.', 'body_required');
        }
        const email = scheduler.schedule(userId, req.body as ScheduleRequest);
        return { status: 201, body: toDto(email) };
      });
    },

    /** GET /api/scheduled-emails */
    list(req: HandlerRequest): HandlerResponse {
      return handle(() => {
        const userId = requireUser(req);
        return { status: 200, body: scheduler.list(userId).map(toDto) };
      });
    },

    /** GET /api/scheduled-emails/:id */
    get(req: HandlerRequest): HandlerResponse {
      return handle(() => {
        const userId = requireUser(req);
        const id = req.params.id ?? '';
        return { status: 200, body: toDto(scheduler.get(userId, id)) };
      });
    },

    /** DELETE /api/scheduled-emails/:id  (cancel) */
    cancel(req: HandlerRequest): HandlerResponse {
      return handle(() => {
        const userId = requireUser(req);
        const id = req.params.id ?? '';
        return { status: 200, body: toDto(scheduler.cancel(userId, id)) };
      });
    },
  };
}

export type EmailRoutes = ReturnType<typeof createRoutes>;
