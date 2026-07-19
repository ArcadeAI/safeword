/**
 * Scheduled email feature.
 *
 * A single self-contained module: domain types, validation, an in-memory
 * store, a scheduler/dispatcher, and HTTP route handlers.
 *
 * Design notes (the lifecycle a real deployment has to survive):
 *  - Users are non-technical, so validation errors are specific and plain.
 *  - A scheduled email is a durable *intent*, not a fire-and-forget timer.
 *    It has an explicit status (scheduled -> sending -> sent | failed |
 *    canceled) so the UI can always answer "what happened to my email?".
 *  - Sending is retried with backoff on transient failure, and the dispatch
 *    loop is crash-tolerant: it re-derives what is due from stored state on
 *    every tick rather than trusting in-process setTimeout handles.
 *  - A per-email lock prevents a slow send from being dispatched twice if a
 *    tick overlaps the previous one (at-least-once delivery, guarded against
 *    obvious double-sends).
 *
 * Swap the in-memory store for a database and `send` for a real provider
 * without touching the route handlers or the scheduler.
 */

/* ------------------------------------------------------------------ */
/* Domain types                                                        */
/* ------------------------------------------------------------------ */

export type EmailStatus = 'scheduled' | 'sending' | 'sent' | 'failed' | 'canceled';

export interface ScheduledEmail {
  id: string;
  subject: string;
  body: string;
  recipients: string[];
  /** Absolute time to send, as epoch milliseconds (UTC). */
  sendAt: number;
  status: EmailStatus;
  attempts: number;
  /** Set once the email reaches a terminal state. */
  lastError?: string;
  createdAt: number;
  updatedAt: number;
  sentAt?: number;
}

/** What a client sends to schedule an email. */
export interface ScheduleEmailInput {
  subject: string;
  body: string;
  recipients: string[];
  /** ISO-8601 timestamp, e.g. "2026-08-01T09:00:00Z". */
  sendAt: string;
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/** A client-fixable problem. Carries an HTTP status and a human message. */
export class ValidationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  readonly status = 404;
  constructor(message = 'Scheduled email not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** Raised when an operation is invalid for the email's current status. */
export class ConflictError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

/* ------------------------------------------------------------------ */
/* Configuration & tunables                                            */
/* ------------------------------------------------------------------ */

const MAX_SUBJECT_LEN = 998; // RFC 5322 line-length ceiling for a header.
const MAX_BODY_LEN = 500_000; // ~500 KB of text; guards against abuse.
const MAX_RECIPIENTS = 100;
const MAX_ATTEMPTS = 5;
/** Refuse schedules further out than this; catches obvious date-entry typos. */
const MAX_LEAD_MS = 1000 * 60 * 60 * 24 * 365; // 1 year.
/** Small grace window so a "send now" that lands microseconds in the past is OK. */
const PAST_GRACE_MS = 1000 * 60; // 1 minute.

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

// Deliberately pragmatic, not RFC-exhaustive: one @, non-empty local part,
// a dotted domain, no spaces. Good enough to catch fat-finger mistakes
// without rejecting valid-but-unusual addresses the provider would accept.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`"${field}" must be a string.`);
  }
  return value;
}

export function validateScheduleInput(
  raw: unknown,
  now: number = Date.now(),
): { subject: string; body: string; recipients: string[]; sendAt: number } {
  if (typeof raw !== 'object' || raw === null) {
    throw new ValidationError('Request body must be a JSON object.');
  }
  const input = raw as Record<string, unknown>;

  const subject = asString(input.subject, 'subject').trim();
  if (subject.length === 0) {
    throw new ValidationError('Please enter a subject for your email.');
  }
  if (subject.length > MAX_SUBJECT_LEN) {
    throw new ValidationError(`Subject is too long (max ${MAX_SUBJECT_LEN} characters).`);
  }

  // Body may be empty (some people send subject-only). But it must be a string.
  const body = asString(input.body, 'body');
  if (body.length > MAX_BODY_LEN) {
    throw new ValidationError('Email body is too large.');
  }

  if (!Array.isArray(input.recipients)) {
    throw new ValidationError('"recipients" must be a list of email addresses.');
  }
  if (input.recipients.length === 0) {
    throw new ValidationError('Please add at least one recipient.');
  }
  if (input.recipients.length > MAX_RECIPIENTS) {
    throw new ValidationError(`Too many recipients (max ${MAX_RECIPIENTS} per email).`);
  }

  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const entry of input.recipients) {
    if (typeof entry !== 'string') {
      throw new ValidationError('Each recipient must be an email address.');
    }
    const addr = entry.trim().toLowerCase();
    if (!EMAIL_RE.test(addr)) {
      throw new ValidationError(`"${entry}" is not a valid email address.`);
    }
    if (seen.has(addr)) continue; // silently de-dupe; not an error.
    seen.add(addr);
    recipients.push(addr);
  }

  const sendAtRaw = asString(input.sendAt, 'sendAt');
  const sendAt = Date.parse(sendAtRaw);
  if (Number.isNaN(sendAt)) {
    throw new ValidationError(
      '"sendAt" must be an ISO-8601 date-time, e.g. "2026-08-01T09:00:00Z".',
    );
  }
  if (sendAt < now - PAST_GRACE_MS) {
    throw new ValidationError('The scheduled time is in the past.');
  }
  if (sendAt > now + MAX_LEAD_MS) {
    throw new ValidationError('The scheduled time is too far in the future.');
  }

  return { subject, body, recipients, sendAt };
}

/* ------------------------------------------------------------------ */
/* Store (in-memory; swap for a DB)                                    */
/* ------------------------------------------------------------------ */

export interface EmailStore {
  create(email: ScheduledEmail): ScheduledEmail;
  get(id: string): ScheduledEmail | undefined;
  update(id: string, patch: Partial<ScheduledEmail>): ScheduledEmail;
  list(): ScheduledEmail[];
  /** Emails whose time has come and are eligible to send. */
  due(now: number): ScheduledEmail[];
}

export class InMemoryEmailStore implements EmailStore {
  private readonly emails = new Map<string, ScheduledEmail>();

  create(email: ScheduledEmail): ScheduledEmail {
    this.emails.set(email.id, { ...email });
    return this.get(email.id)!;
  }

  get(id: string): ScheduledEmail | undefined {
    const found = this.emails.get(id);
    return found ? { ...found } : undefined; // hand out copies, not refs.
  }

  update(id: string, patch: Partial<ScheduledEmail>): ScheduledEmail {
    const current = this.emails.get(id);
    if (!current) throw new NotFoundError();
    const next = { ...current, ...patch, id, updatedAt: Date.now() };
    this.emails.set(id, next);
    return { ...next };
  }

  list(): ScheduledEmail[] {
    return [...this.emails.values()].map(e => ({ ...e })).sort((a, b) => a.sendAt - b.sendAt);
  }

  due(now: number): ScheduledEmail[] {
    return [...this.emails.values()]
      .filter(e => e.status === 'scheduled' && e.sendAt <= now)
      .sort((a, b) => a.sendAt - b.sendAt)
      .map(e => ({ ...e }));
  }
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

export interface OutboundEmail {
  subject: string;
  body: string;
  recipients: string[];
}

/**
 * The pluggable email sink. In production this wraps a real provider
 * (SES / Postmark / etc.). It should throw on failure; the dispatcher
 * decides whether the failure is retryable.
 */
export type SendFn = (email: OutboundEmail) => Promise<void>;

/** Default no-op sink for local dev / tests: logs and resolves. */
export const consoleSend: SendFn = async email => {
  // eslint-disable-next-line no-console
  console.log(`[send] "${email.subject}" -> ${email.recipients.join(', ')}`);
};

/* ------------------------------------------------------------------ */
/* ID generation                                                       */
/* ------------------------------------------------------------------ */

function newId(): string {
  // Prefer crypto UUID when available; fall back for older runtimes.
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `em_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ */
/* Service: schedule / cancel / query                                  */
/* ------------------------------------------------------------------ */

export class EmailScheduler {
  private timer: ReturnType<typeof setInterval> | undefined;
  /** IDs currently being dispatched, to avoid overlapping sends. */
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly store: EmailStore,
    private readonly send: SendFn,
    private readonly opts: {
      /** How often the dispatch loop wakes up. */
      tickMs?: number;
      now?: () => number;
    } = {},
  ) {}

  private now(): number {
    return this.opts.now ? this.opts.now() : Date.now();
  }

  schedule(input: unknown): ScheduledEmail {
    const clean = validateScheduleInput(input, this.now());
    const ts = this.now();
    return this.store.create({
      id: newId(),
      subject: clean.subject,
      body: clean.body,
      recipients: clean.recipients,
      sendAt: clean.sendAt,
      status: 'scheduled',
      attempts: 0,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  get(id: string): ScheduledEmail {
    const email = this.store.get(id);
    if (!email) throw new NotFoundError();
    return email;
  }

  list(): ScheduledEmail[] {
    return this.store.list();
  }

  /** Cancel a still-pending email. Idempotent-ish: only valid while scheduled. */
  cancel(id: string): ScheduledEmail {
    const email = this.store.get(id);
    if (!email) throw new NotFoundError();
    if (email.status === 'canceled') return email; // already done.
    if (email.status !== 'scheduled') {
      throw new ConflictError(`Cannot cancel an email that is already "${email.status}".`);
    }
    return this.store.update(id, { status: 'canceled' });
  }

  /* ---------------------------------------------------------------- */
  /* Dispatch loop                                                     */
  /* ---------------------------------------------------------------- */

  start(): void {
    if (this.timer) return;
    const tickMs = this.opts.tickMs ?? 1000;
    this.timer = setInterval(() => {
      void this.tick();
    }, tickMs);
    // Don't keep the process alive solely for the scheduler (Node).
    (this.timer as { unref?: () => void }).unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * Process everything currently due. Exposed for tests and for a
   * cron-driven deployment that prefers to pull the trigger explicitly.
   */
  async tick(): Promise<void> {
    const due = this.store.due(this.now());
    await Promise.all(due.map(email => this.dispatch(email.id)));
  }

  private async dispatch(id: string): Promise<void> {
    if (this.inFlight.has(id)) return; // a prior tick is still sending this.
    this.inFlight.add(id);
    try {
      const email = this.store.get(id);
      // Re-check under "lock": it may have been canceled or already sent
      // between due() and now.
      if (!email || email.status !== 'scheduled') return;

      const attempt = email.attempts + 1;
      this.store.update(id, { status: 'sending', attempts: attempt });

      try {
        await this.send({
          subject: email.subject,
          body: email.body,
          recipients: email.recipients,
        });
        this.store.update(id, {
          status: 'sent',
          sentAt: this.now(),
          lastError: undefined,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (attempt >= MAX_ATTEMPTS) {
          this.store.update(id, { status: 'failed', lastError: message });
        } else {
          // Back off: push sendAt out and return to "scheduled" so a later
          // tick retries. Exponential-ish, capped.
          const backoffMs = Math.min(2 ** attempt * 1000, 1000 * 60 * 5);
          this.store.update(id, {
            status: 'scheduled',
            sendAt: this.now() + backoffMs,
            lastError: message,
          });
        }
      }
    } finally {
      this.inFlight.delete(id);
    }
  }
}

/* ------------------------------------------------------------------ */
/* HTTP route handlers (framework-agnostic)                            */
/* ------------------------------------------------------------------ */

export interface HttpResult {
  status: number;
  body: unknown;
}

function errorToResult(err: unknown): HttpResult {
  if (
    err instanceof ValidationError ||
    err instanceof NotFoundError ||
    err instanceof ConflictError
  ) {
    return { status: err.status, body: { error: err.message } };
  }
  // Unknown failure: don't leak internals to the end-user.
  return { status: 500, body: { error: 'Something went wrong. Please try again.' } };
}

/**
 * Thin handlers that adapt any HTTP framework to the scheduler. Each takes
 * already-parsed inputs (path params, JSON body) and returns a status+body.
 * Wire these into Express/Fastify/Hono/etc. with a few lines of glue.
 */
export function createEmailRoutes(scheduler: EmailScheduler) {
  return {
    // POST /emails
    schedule(body: unknown): HttpResult {
      try {
        return { status: 201, body: scheduler.schedule(body) };
      } catch (err) {
        return errorToResult(err);
      }
    },

    // GET /emails
    list(): HttpResult {
      return { status: 200, body: scheduler.list() };
    },

    // GET /emails/:id
    get(id: string): HttpResult {
      try {
        return { status: 200, body: scheduler.get(id) };
      } catch (err) {
        return errorToResult(err);
      }
    },

    // DELETE /emails/:id  (cancel)
    cancel(id: string): HttpResult {
      try {
        return { status: 200, body: scheduler.cancel(id) };
      } catch (err) {
        return errorToResult(err);
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* Composition helper                                                  */
/* ------------------------------------------------------------------ */

/**
 * Build a ready-to-use scheduler with an in-memory store. Call `.start()`
 * on the returned scheduler to begin the dispatch loop.
 */
export function createEmailScheduler(send: SendFn = consoleSend): {
  scheduler: EmailScheduler;
  routes: ReturnType<typeof createEmailRoutes>;
  store: InMemoryEmailStore;
} {
  const store = new InMemoryEmailStore();
  const scheduler = new EmailScheduler(store, send);
  const routes = createEmailRoutes(scheduler);
  return { scheduler, routes, store };
}
