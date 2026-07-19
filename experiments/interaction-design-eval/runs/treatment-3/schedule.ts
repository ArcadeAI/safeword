/**
 * Scheduled email feature.
 *
 * A user hands off an email — subject, body, recipients — for the system to
 * send at a chosen future time, while they're not watching. That hand-off
 * opens gaps between the user and the system. This module is designed to close
 * them:
 *
 *  - Evaluation      — the user can list what they've scheduled and see the
 *                      live state of each job (`listScheduledEmails`, `getScheduledEmail`).
 *  - Interrupt       — the user can edit or cancel a pending send before it
 *                      fires (`updateScheduledEmail`, `cancelScheduledEmail`).
 *  - Recovery        — an unattended failure (bad recipient, provider error,
 *                      process restart) is never silently lost: it is retried
 *                      with backoff, then parked in a `failed` state the user
 *                      can see and re-drive (`retryScheduledEmail`). Nothing
 *                      transitions to `sent` unless `send()` actually succeeds.
 *  - Confirmation    — a schedule starts life as a `draft`. It does not run
 *                      until the user explicitly confirms intent
 *                      (`confirmScheduledEmail`), so a mistaken send is caught
 *                      before it can go out.
 *
 * No database and no real email provider are required: an in-memory store and
 * a pluggable `send(email)` function are enough. Route handlers at the bottom
 * expose the whole lifecycle over HTTP for a non-technical web UI.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/** The email payload the user composes. */
export interface EmailContent {
  subject: string;
  body: string;
  recipients: string[];
}

/** What we hand to the provider when it is time to actually send. */
export interface OutgoingEmail extends EmailContent {
  id: string;
}

/**
 * Lifecycle of a scheduled email. Every transition is observable by the user.
 *
 *   draft ──confirm──▶ scheduled ──(time reached)──▶ sending ──▶ sent
 *     │                    │                             │
 *     │                    │                             └─(all retries fail)─▶ failed
 *   cancel               cancel / edit                          │
 *     ▼                    ▼                                   retry
 *  canceled            canceled                                  ▼
 *                                                            scheduled
 */
export type ScheduleStatus =
  | 'draft' // composed, awaiting explicit user confirmation
  | 'scheduled' // confirmed, waiting for its send time
  | 'sending' // send in progress right now
  | 'sent' // provider accepted it
  | 'failed' // gave up after retries — surfaced to the user
  | 'canceled'; // user stopped it before it went out

export interface ScheduledEmail {
  id: string;
  content: EmailContent;
  /** Epoch millis at which the email should be sent. */
  sendAt: number;
  status: ScheduleStatus;
  attempts: number;
  maxAttempts: number;
  /** Populated when status is 'failed' (or after a recoverable attempt). */
  lastError?: string;
  createdAt: number;
  updatedAt: number;
  /** Set once the send succeeds. */
  sentAt?: number;
}

/** Public view — same shape, but a stable snapshot for the UI/JSON. */
export type ScheduledEmailView = Readonly<ScheduledEmail>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ScheduleError extends Error {
  constructor(
    message: string,
    /** HTTP-friendly status so route handlers can map cleanly. */
    public readonly httpStatus: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ScheduleError';
  }
}

const notFound = (id: string) =>
  new ScheduleError(`No scheduled email with id "${id}".`, 404, 'not_found');

const badState = (msg: string) => new ScheduleError(msg, 409, 'invalid_state');

const badRequest = (msg: string) => new ScheduleError(msg, 400, 'invalid_request');

// ---------------------------------------------------------------------------
// Validation — catch mistakes at compose time, not at send time
// ---------------------------------------------------------------------------

// Deliberately simple; a UI should validate too, but the server is the
// authority. Rejecting a bad recipient here means the user hears about it
// immediately, not silently at 3am when the job fires unattended.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateContent(content: Partial<EmailContent>): EmailContent {
  const subject = (content.subject ?? '').trim();
  const body = content.body ?? '';
  const recipients = content.recipients ?? [];

  if (!subject) throw badRequest('Subject is required.');
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw badRequest('At least one recipient is required.');
  }

  const cleaned: string[] = [];
  const invalid: string[] = [];
  for (const raw of recipients) {
    const addr = String(raw).trim();
    if (!addr) continue;
    if (EMAIL_RE.test(addr)) cleaned.push(addr);
    else invalid.push(addr);
  }
  if (invalid.length) {
    throw badRequest(
      `These recipients don't look like valid email addresses: ${invalid.join(', ')}`,
    );
  }
  if (cleaned.length === 0) throw badRequest('At least one recipient is required.');

  return { subject, body, recipients: cleaned };
}

function validateSendAt(sendAt: unknown, now: number): number {
  const t =
    typeof sendAt === 'number' ? sendAt : typeof sendAt === 'string' ? Date.parse(sendAt) : NaN;
  if (!Number.isFinite(t)) throw badRequest('sendAt must be a valid time.');
  if (t <= now) throw badRequest('sendAt must be in the future.');
  return t;
}

// ---------------------------------------------------------------------------
// The pluggable sender
// ---------------------------------------------------------------------------

/**
 * Swap this for a real provider in production. It must reject (throw / return
 * a rejected promise) on failure so the scheduler can retry and recover rather
 * than marking a failed send as delivered.
 */
export type SendFn = (email: OutgoingEmail) => Promise<void>;

/** Default in-memory sender: records what "went out" so tests/UI can inspect it. */
export function createInMemorySender() {
  const outbox: OutgoingEmail[] = [];
  const send: SendFn = async email => {
    outbox.push({ ...email, recipients: [...email.recipients] });
  };
  return { send, outbox };
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

export interface SchedulerOptions {
  send: SendFn;
  /** How often to wake up and look for due emails. Default 1s. */
  tickMs?: number;
  /** How many times to try sending before parking as `failed`. Default 3. */
  maxAttempts?: number;
  /** Base backoff between retries in ms (exponential). Default 30s. */
  retryBackoffMs?: number;
  /** Injectable clock for testing. */
  now?: () => number;
  idFactory?: () => string;
}

let seq = 0;
const defaultId = () => `sched_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export class EmailScheduler {
  private store = new Map<string, ScheduledEmail>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly send: SendFn;
  private readonly tickMs: number;
  private readonly maxAttempts: number;
  private readonly retryBackoffMs: number;
  private readonly now: () => number;
  private readonly idFactory: () => string;
  /** Ids currently being sent, so overlapping ticks never double-send. */
  private inFlight = new Set<string>();
  /** When a failed attempt should next be retried. */
  private retryAt = new Map<string, number>();

  constructor(opts: SchedulerOptions) {
    this.send = opts.send;
    this.tickMs = opts.tickMs ?? 1_000;
    this.maxAttempts = opts.maxAttempts ?? 3;
    this.retryBackoffMs = opts.retryBackoffMs ?? 30_000;
    this.now = opts.now ?? (() => Date.now());
    this.idFactory = opts.idFactory ?? defaultId;
  }

  // ---- lifecycle of the scheduler itself ----

  /** Begin the background loop that sends due emails while the user is away. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.tickMs);
    // Don't keep a Node process alive just for the scheduler.
    (this.timer as { unref?: () => void }).unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // ---- Confirmation: create as a draft, don't run until confirmed ----

  /**
   * Compose a schedule. It starts as a `draft` and will NOT be sent until the
   * user confirms it — this is the guard against a mistaken send. A UI can
   * show the draft ("You're about to send to 42 people at 9am — confirm?")
   * before anything is committed.
   */
  create(input: {
    subject: string;
    body: string;
    recipients: string[];
    sendAt: number | string;
    /** Set true to confirm in the same call (e.g. an explicit UI confirm step). */
    confirm?: boolean;
  }): ScheduledEmailView {
    const now = this.now();
    const content = validateContent(input);
    const sendAt = validateSendAt(input.sendAt, now);

    const email: ScheduledEmail = {
      id: this.idFactory(),
      content,
      sendAt,
      status: input.confirm ? 'scheduled' : 'draft',
      attempts: 0,
      maxAttempts: this.maxAttempts,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(email.id, email);
    return this.snapshot(email);
  }

  /** Explicit intent gate: move a draft to scheduled so it can actually fire. */
  confirm(id: string): ScheduledEmailView {
    const email = this.require(id);
    if (email.status !== 'draft') {
      throw badState(`Only a draft can be confirmed; "${id}" is "${email.status}".`);
    }
    if (email.sendAt <= this.now()) {
      throw badRequest('sendAt is now in the past — pick a new time before confirming.');
    }
    email.status = 'scheduled';
    email.updatedAt = this.now();
    return this.snapshot(email);
  }

  // ---- Evaluation: see what's delegated and its state ----

  list(filter?: { status?: ScheduleStatus }): ScheduledEmailView[] {
    const all = [...this.store.values()].sort((a, b) => a.sendAt - b.sendAt);
    const filtered = filter?.status ? all.filter(e => e.status === filter.status) : all;
    return filtered.map(e => this.snapshot(e));
  }

  get(id: string): ScheduledEmailView {
    return this.snapshot(this.require(id));
  }

  // ---- Interrupt: edit or cancel before it acts ----

  /**
   * Change the content or time of a not-yet-sent email. Editing content
   * re-validates and drops it back to `draft` so intent is re-confirmed —
   * you can't quietly rewrite who a scheduled blast goes to. Editing only the
   * time of an already-scheduled email keeps it scheduled.
   */
  update(
    id: string,
    patch: Partial<EmailContent> & { sendAt?: number | string },
  ): ScheduledEmailView {
    const email = this.require(id);
    if (!this.isMutable(email.status)) {
      throw badState(`"${id}" is "${email.status}" and can no longer be edited.`);
    }
    if (this.inFlight.has(id)) {
      throw badState(`"${id}" is being sent right now and can't be edited.`);
    }

    const now = this.now();
    const touchesContent =
      patch.subject !== undefined || patch.body !== undefined || patch.recipients !== undefined;

    if (touchesContent) {
      email.content = validateContent({
        subject: patch.subject ?? email.content.subject,
        body: patch.body ?? email.content.body,
        recipients: patch.recipients ?? email.content.recipients,
      });
    }
    if (patch.sendAt !== undefined) {
      email.sendAt = validateSendAt(patch.sendAt, now);
    }

    // Any content change re-opens the confirmation gate.
    if (touchesContent) {
      email.status = 'draft';
      email.attempts = 0;
      email.lastError = undefined;
      this.retryAt.delete(id);
    }
    email.updatedAt = now;
    return this.snapshot(email);
  }

  /** Stop a pending send. Irreversible, but only ever stops an unsent email. */
  cancel(id: string): ScheduledEmailView {
    const email = this.require(id);
    if (email.status === 'sent') {
      throw badState(`"${id}" already went out and can't be canceled.`);
    }
    if (email.status === 'canceled') return this.snapshot(email);
    if (this.inFlight.has(id)) {
      throw badState(`"${id}" is being sent right now and can't be canceled.`);
    }
    email.status = 'canceled';
    email.updatedAt = this.now();
    this.retryAt.delete(id);
    return this.snapshot(email);
  }

  // ---- Recovery: re-drive a failed send ----

  /** Put a `failed` email back on the schedule so the user can recover it. */
  retry(id: string, sendAt?: number | string): ScheduledEmailView {
    const email = this.require(id);
    if (email.status !== 'failed') {
      throw badState(`Only a failed email can be retried; "${id}" is "${email.status}".`);
    }
    const now = this.now();
    email.sendAt = sendAt !== undefined ? validateSendAt(sendAt, now) : now;
    email.status = 'scheduled';
    email.attempts = 0;
    email.lastError = undefined;
    email.updatedAt = now;
    this.retryAt.delete(id);
    return this.snapshot(email);
  }

  // ---- The unattended loop ----

  /**
   * One pass of the scheduler. Public so a UI ("send now") or a test can drive
   * it deterministically without waiting on wall-clock time.
   */
  async tick(): Promise<void> {
    const now = this.now();
    const due = [...this.store.values()].filter(e => this.isDue(e, now));
    await Promise.all(due.map(e => this.attemptSend(e)));
  }

  private isDue(email: ScheduledEmail, now: number): boolean {
    if (email.status !== 'scheduled') return false;
    if (this.inFlight.has(email.id)) return false;
    if (email.sendAt > now) return false;
    const retryAt = this.retryAt.get(email.id);
    if (retryAt !== undefined && retryAt > now) return false;
    return true;
  }

  private async attemptSend(email: ScheduledEmail): Promise<void> {
    // Guard against overlapping ticks double-sending the same email.
    if (this.inFlight.has(email.id)) return;
    this.inFlight.add(email.id);

    const now = this.now();
    email.status = 'sending';
    email.attempts += 1;
    email.updatedAt = now;

    try {
      await this.send({
        id: email.id,
        subject: email.content.subject,
        body: email.content.body,
        recipients: [...email.content.recipients],
      });
      // Only here — after the provider actually accepted it — is it "sent".
      email.status = 'sent';
      email.sentAt = this.now();
      email.lastError = undefined;
      email.updatedAt = email.sentAt;
      this.retryAt.delete(email.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      email.lastError = message;
      email.updatedAt = this.now();
      if (email.attempts >= email.maxAttempts) {
        // Give up automatically, but never silently: park it visibly as
        // `failed` with the reason, so the user finds out and can recover.
        email.status = 'failed';
        this.retryAt.delete(email.id);
      } else {
        // Recoverable: back off and let a later tick try again on its own.
        email.status = 'scheduled';
        const backoff = this.retryBackoffMs * 2 ** (email.attempts - 1);
        this.retryAt.set(email.id, this.now() + backoff);
      }
    } finally {
      this.inFlight.delete(email.id);
    }
  }

  // ---- helpers ----

  private require(id: string): ScheduledEmail {
    const email = this.store.get(id);
    if (!email) throw notFound(id);
    return email;
  }

  private isMutable(status: ScheduleStatus): boolean {
    return status === 'draft' || status === 'scheduled' || status === 'failed';
  }

  private snapshot(email: ScheduledEmail): ScheduledEmailView {
    // Freeze a copy so callers can't mutate internal state out from under us.
    return Object.freeze({
      ...email,
      content: Object.freeze({
        ...email.content,
        recipients: Object.freeze([...email.content.recipients]) as string[],
      }),
    });
  }
}

// ---------------------------------------------------------------------------
// HTTP route handlers
// ---------------------------------------------------------------------------
//
// Framework-agnostic: each handler takes a small request shape and returns a
// { status, body } pair, so it drops into Express, Fetch/Hono, Next, etc.
// Wiring for Express is shown at the bottom.

export interface HandlerRequest {
  params?: Record<string, string>;
  query?: Record<string, string | undefined>;
  body?: unknown;
}

export interface HandlerResponse {
  status: number;
  body: unknown;
}

const ok = (body: unknown, status = 200): HandlerResponse => ({ status, body });

function handleError(err: unknown): HandlerResponse {
  if (err instanceof ScheduleError) {
    return { status: err.httpStatus, body: { error: err.message, code: err.code } };
  }
  return {
    status: 500,
    body: { error: 'Unexpected error.', code: 'internal' },
  };
}

/**
 * Build the set of route handlers bound to a scheduler instance.
 *
 *   POST   /scheduled-emails                 create (draft, or confirm:true)
 *   GET    /scheduled-emails                 list (?status=…)
 *   GET    /scheduled-emails/:id             read one
 *   POST   /scheduled-emails/:id/confirm     confirm a draft   (intent gate)
 *   PATCH  /scheduled-emails/:id             edit subject/body/recipients/time
 *   POST   /scheduled-emails/:id/cancel      stop a pending send
 *   POST   /scheduled-emails/:id/retry       re-drive a failed send
 */
export function createRouteHandlers(scheduler: EmailScheduler) {
  return {
    create(req: HandlerRequest): HandlerResponse {
      try {
        const b = (req.body ?? {}) as Record<string, unknown>;
        const created = scheduler.create({
          subject: String(b.subject ?? ''),
          body: String(b.body ?? ''),
          recipients: (b.recipients as string[]) ?? [],
          sendAt: b.sendAt as number | string,
          confirm: b.confirm === true,
        });
        return ok(created, 201);
      } catch (err) {
        return handleError(err);
      }
    },

    list(req: HandlerRequest): HandlerResponse {
      try {
        const status = req.query?.status as ScheduleStatus | undefined;
        return ok({ items: scheduler.list(status ? { status } : undefined) });
      } catch (err) {
        return handleError(err);
      }
    },

    get(req: HandlerRequest): HandlerResponse {
      try {
        return ok(scheduler.get(req.params?.id ?? ''));
      } catch (err) {
        return handleError(err);
      }
    },

    confirm(req: HandlerRequest): HandlerResponse {
      try {
        return ok(scheduler.confirm(req.params?.id ?? ''));
      } catch (err) {
        return handleError(err);
      }
    },

    update(req: HandlerRequest): HandlerResponse {
      try {
        const b = (req.body ?? {}) as Partial<EmailContent> & {
          sendAt?: number | string;
        };
        return ok(scheduler.update(req.params?.id ?? '', b));
      } catch (err) {
        return handleError(err);
      }
    },

    cancel(req: HandlerRequest): HandlerResponse {
      try {
        return ok(scheduler.cancel(req.params?.id ?? ''));
      } catch (err) {
        return handleError(err);
      }
    },

    retry(req: HandlerRequest): HandlerResponse {
      try {
        const b = (req.body ?? {}) as { sendAt?: number | string };
        return ok(scheduler.retry(req.params?.id ?? '', b.sendAt));
      } catch (err) {
        return handleError(err);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Optional Express wiring (kept dependency-free: `app` is a duck-typed router)
// ---------------------------------------------------------------------------

interface MinimalRouter {
  get(path: string, fn: (req: any, res: any) => void): void;
  post(path: string, fn: (req: any, res: any) => void): void;
  patch(path: string, fn: (req: any, res: any) => void): void;
}

/**
 * Mount the routes on any Express-compatible app/router. Example:
 *
 *   const { send, outbox } = createInMemorySender();
 *   const scheduler = new EmailScheduler({ send });
 *   scheduler.start();
 *   mountRoutes(express().use(express.json()), scheduler);
 */
export function mountRoutes(app: MinimalRouter, scheduler: EmailScheduler): void {
  const h = createRouteHandlers(scheduler);
  const adapt = (fn: (req: HandlerRequest) => HandlerResponse) => (req: any, res: any) => {
    const out = fn({ params: req.params, query: req.query, body: req.body });
    res.status(out.status).json(out.body);
  };

  app.post('/scheduled-emails', adapt(h.create));
  app.get('/scheduled-emails', adapt(h.list));
  app.get('/scheduled-emails/:id', adapt(h.get));
  app.post('/scheduled-emails/:id/confirm', adapt(h.confirm));
  app.patch('/scheduled-emails/:id', adapt(h.update));
  app.post('/scheduled-emails/:id/cancel', adapt(h.cancel));
  app.post('/scheduled-emails/:id/retry', adapt(h.retry));
}
