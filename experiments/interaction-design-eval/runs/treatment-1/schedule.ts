/**
 * schedule.ts — Scheduled email feature (single-module implementation).
 *
 * A user hands off an email to be sent later, while they are not watching.
 * The design goal is that the user stays in control across that gap in time.
 * The four things that keep them in control are called out inline:
 *
 *   [EVALUATION]   They can always see what they've delegated and its state
 *                  (listSchedules / getSchedule → GET routes).
 *   [INTERRUPT]    They can change or cancel a pending send before it fires
 *                  (updateSchedule / cancelSchedule → PATCH / DELETE routes).
 *   [CONFIRMATION] A scheduled email is created as a DRAFT and does nothing
 *                  until the user explicitly confirms it (confirmSchedule).
 *                  A mistaken send is caught before it is ever armed.
 *   [RECOVERY]     If a send fails while running unattended, the email is not
 *                  silently lost: it is retried with backoff, its error is
 *                  recorded and visible, and after exhausting retries it lands
 *                  in a terminal `failed` state the user can see and re-arm.
 *
 * No database and no real email provider are required — an in-memory store and
 * a pluggable `send(email)` function stand in for both.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScheduleStatus =
  | 'draft' //      created, awaiting user confirmation — will NOT send
  | 'scheduled' //  confirmed and armed — will send at sendAt
  | 'sending' //    a worker is actively attempting the send right now
  | 'sent' //       delivered successfully (terminal)
  | 'failed' //     all attempts exhausted or permanently rejected (terminal)
  | 'canceled'; //  user canceled before it sent (terminal)

export interface EmailPayload {
  subject: string;
  body: string;
  recipients: string[];
}

export interface Attempt {
  at: string; // ISO timestamp of the attempt
  ok: boolean;
  error?: string;
}

export interface ScheduledEmail extends EmailPayload {
  id: string;
  status: ScheduleStatus;
  sendAt: string; // ISO timestamp: when the email should go out
  createdAt: string;
  updatedAt: string;
  attempts: Attempt[]; // full audit trail, newest last  [EVALUATION/RECOVERY]
  lastError?: string; // surfaced reason for the most recent failure
  sentAt?: string; // set when status === "sent"
  maxRetries: number;
}

// The function that actually delivers mail. Swap for a real provider later.
export type SendFn = (email: EmailPayload) => Promise<void>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`No scheduled email with id "${id}"`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

interface DraftInput {
  subject?: unknown;
  body?: unknown;
  recipients?: unknown;
  sendAt?: unknown;
  maxRetries?: unknown;
}

/**
 * Validate raw user input into a clean payload + send time.
 * Runs at creation AND at update, so a user can never edit a schedule into an
 * invalid state that would only blow up later, unattended.  [RECOVERY]
 */
function validate(
  input: DraftInput,
  now: number,
): { payload: EmailPayload; sendAt: string; maxRetries: number } {
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  if (!subject) throw new ValidationError('Subject is required.', 'subject');
  if (subject.length > 255) throw new ValidationError('Subject is too long (max 255).', 'subject');

  const body = typeof input.body === 'string' ? input.body : '';
  if (!body.trim()) throw new ValidationError('Body is required.', 'body');

  if (!Array.isArray(input.recipients) || input.recipients.length === 0)
    throw new ValidationError('At least one recipient is required.', 'recipients');

  const recipients = input.recipients.map(r => (typeof r === 'string' ? r.trim() : ''));
  const bad = recipients.filter(r => !EMAIL_RE.test(r));
  if (bad.length > 0)
    throw new ValidationError(
      `Invalid recipient address${bad.length > 1 ? 'es' : ''}: ${bad.join(', ')}`,
      'recipients',
    );
  // Dedupe while preserving order.
  const uniqueRecipients = [...new Set(recipients)];

  const sendAtMs = Date.parse(String(input.sendAt));
  if (Number.isNaN(sendAtMs))
    throw new ValidationError('A valid send time (ISO 8601) is required.', 'sendAt');
  if (sendAtMs <= now) throw new ValidationError('Send time must be in the future.', 'sendAt');

  let maxRetries = 3;
  if (input.maxRetries !== undefined) {
    const n = Number(input.maxRetries);
    if (!Number.isInteger(n) || n < 0 || n > 10)
      throw new ValidationError('maxRetries must be an integer between 0 and 10.', 'maxRetries');
    maxRetries = n;
  }

  return {
    payload: { subject, body, recipients: uniqueRecipients },
    sendAt: new Date(sendAtMs).toISOString(),
    maxRetries,
  };
}

// ---------------------------------------------------------------------------
// The scheduler / store
// ---------------------------------------------------------------------------

export interface SchedulerOptions {
  send: SendFn;
  now?: () => number; // injectable clock (tests)
  tickMs?: number; // how often to scan for due emails
  retryBackoffMs?: (attempt: number) => number;
}

export class EmailScheduler {
  private store = new Map<string, ScheduledEmail>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight = new Set<string>();

  private readonly send: SendFn;
  private readonly now: () => number;
  private readonly tickMs: number;
  private readonly backoff: (attempt: number) => number;

  constructor(opts: SchedulerOptions) {
    this.send = opts.send;
    this.now = opts.now ?? (() => Date.now());
    this.tickMs = opts.tickMs ?? 1000;
    // Exponential backoff, capped: 30s, 60s, 120s, ... max 15m.
    this.backoff =
      opts.retryBackoffMs ?? (attempt => Math.min(30_000 * 2 ** (attempt - 1), 900_000));
  }

  // --- lifecycle ---------------------------------------------------------

  /** Begin the background loop that sends due emails. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.tickMs);
    // Don't keep a Node process alive just for the scheduler.
    (this.timer as { unref?: () => void }).unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // --- commands ----------------------------------------------------------

  /**
   * Create a schedule. It starts as a DRAFT and will not send until the user
   * confirms it — nothing is armed on a single fat-fingered request.  [CONFIRMATION]
   */
  create(input: DraftInput): ScheduledEmail {
    const now = this.now();
    const { payload, sendAt, maxRetries } = validate(input, now);
    const nowIso = new Date(now).toISOString();
    const email: ScheduledEmail = {
      id: genId(),
      status: 'draft',
      ...payload,
      sendAt,
      maxRetries,
      attempts: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this.store.set(email.id, email);
    return clone(email);
  }

  /** Explicitly arm a draft so it will actually be sent.  [CONFIRMATION] */
  confirm(id: string): ScheduledEmail {
    const email = this.require(id);
    if (email.status === 'scheduled') return clone(email); // idempotent
    if (email.status !== 'draft')
      throw new ConflictError(`Cannot confirm an email that is "${email.status}".`);
    if (Date.parse(email.sendAt) <= this.now())
      throw new ConflictError('Send time has already passed; update it before confirming.');
    email.status = 'scheduled';
    email.updatedAt = new Date(this.now()).toISOString();
    return clone(email);
  }

  /**
   * Change a pending email — content or time — before it goes out.  [INTERRUPT]
   * Editing re-validates and, as a safety measure, returns the email to draft
   * so the user re-confirms the corrected version.
   */
  update(id: string, input: DraftInput): ScheduledEmail {
    const email = this.require(id);
    if (email.status !== 'draft' && email.status !== 'scheduled')
      throw new ConflictError(`Cannot edit an email that is "${email.status}".`);
    if (this.inFlight.has(id)) throw new ConflictError('Email is currently sending; cannot edit.');

    // Merge: only provided fields change; the rest are kept.
    const merged: DraftInput = {
      subject: input.subject ?? email.subject,
      body: input.body ?? email.body,
      recipients: input.recipients ?? email.recipients,
      sendAt: input.sendAt ?? email.sendAt,
      maxRetries: input.maxRetries ?? email.maxRetries,
    };
    const { payload, sendAt, maxRetries } = validate(merged, this.now());

    email.subject = payload.subject;
    email.body = payload.body;
    email.recipients = payload.recipients;
    email.sendAt = sendAt;
    email.maxRetries = maxRetries;
    email.status = 'draft'; // require re-confirmation of the edited version
    email.updatedAt = new Date(this.now()).toISOString();
    return clone(email);
  }

  /** Stop a pending email from ever sending.  [INTERRUPT] */
  cancel(id: string): ScheduledEmail {
    const email = this.require(id);
    if (email.status === 'canceled') return clone(email); // idempotent
    if (email.status === 'sent') throw new ConflictError('Email has already been sent.');
    if (email.status === 'sending' || this.inFlight.has(id))
      throw new ConflictError('Email is being sent right now and can no longer be canceled.');
    email.status = 'canceled';
    email.updatedAt = new Date(this.now()).toISOString();
    return clone(email);
  }

  /** Re-arm a failed email (optionally with a fresh future time).  [RECOVERY] */
  retry(id: string, newSendAt?: string): ScheduledEmail {
    const email = this.require(id);
    if (email.status !== 'failed')
      throw new ConflictError(`Only failed emails can be retried (this one is "${email.status}").`);
    const sendAt = newSendAt ?? new Date(this.now() + 60_000).toISOString();
    return this.update(id, { sendAt });
  }

  // --- queries  [EVALUATION] --------------------------------------------

  get(id: string): ScheduledEmail {
    return clone(this.require(id));
  }

  list(filter?: { status?: ScheduleStatus }): ScheduledEmail[] {
    let all = [...this.store.values()];
    if (filter?.status) all = all.filter(e => e.status === filter.status);
    all.sort((a, b) => a.sendAt.localeCompare(b.sendAt));
    return all.map(clone);
  }

  // --- internals ---------------------------------------------------------

  private require(id: string): ScheduledEmail {
    const email = this.store.get(id);
    if (!email) throw new NotFoundError(id);
    return email;
  }

  /** One scan: find armed emails whose time has come and send them. */
  private async tick(): Promise<void> {
    const now = this.now();
    const due = [...this.store.values()].filter(
      e => e.status === 'scheduled' && Date.parse(e.sendAt) <= now && !this.inFlight.has(e.id),
    );
    await Promise.all(due.map(e => this.deliver(e)));
  }

  private async deliver(email: ScheduledEmail): Promise<void> {
    this.inFlight.add(email.id);
    email.status = 'sending';
    email.updatedAt = new Date(this.now()).toISOString();
    try {
      await this.send({
        subject: email.subject,
        body: email.body,
        recipients: [...email.recipients],
      });
      email.attempts.push({ at: new Date(this.now()).toISOString(), ok: true });
      email.status = 'sent';
      email.sentAt = new Date(this.now()).toISOString();
      email.lastError = undefined;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      email.attempts.push({
        at: new Date(this.now()).toISOString(),
        ok: false,
        error: message,
      });
      email.lastError = message;

      const failedTries = email.attempts.filter(a => !a.ok).length;
      if (failedTries > email.maxRetries) {
        // Exhausted — land in a terminal, VISIBLE failed state.  [RECOVERY]
        email.status = 'failed';
      } else {
        // Re-arm for a later retry with backoff instead of losing the email.
        email.status = 'scheduled';
        email.sendAt = new Date(this.now() + this.backoff(failedTries)).toISOString();
      }
    } finally {
      email.updatedAt = new Date(this.now()).toISOString();
      this.inFlight.delete(email.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function genId(): string {
  // Prefer crypto.randomUUID when available; fall back for older runtimes.
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `sch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ---------------------------------------------------------------------------
// HTTP route handlers (framework-agnostic, Web Fetch API)
// ---------------------------------------------------------------------------
//
// Wire these into any router (Hono, Next.js, Bun.serve, Express-with-adapter).
// The handler dispatches on method + path so the whole surface lives here:
//
//   POST   /schedules              create a draft
//   GET    /schedules              list all (optional ?status=)          [EVALUATION]
//   GET    /schedules/:id          read one, incl. attempt history       [EVALUATION]
//   POST   /schedules/:id/confirm  arm the draft                         [CONFIRMATION]
//   PATCH  /schedules/:id          edit a pending email                  [INTERRUPT]
//   DELETE /schedules/:id          cancel a pending email                [INTERRUPT]
//   POST   /schedules/:id/retry    re-arm a failed email                 [RECOVERY]

export function createRouter(scheduler: EmailScheduler) {
  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    // Expect: ["schedules"] or ["schedules", id] or ["schedules", id, action]
    if (parts[0] !== 'schedules') return json({ error: 'Not found' }, 404);

    const id = parts[1];
    const action = parts[2];

    try {
      // Collection routes
      if (!id) {
        if (req.method === 'POST') return json(scheduler.create(await body(req)), 201);
        if (req.method === 'GET') {
          const status = url.searchParams.get('status') as ScheduleStatus | null;
          return json(scheduler.list(status ? { status } : undefined));
        }
        return json({ error: 'Method not allowed' }, 405);
      }

      // Item routes
      if (!action) {
        if (req.method === 'GET') return json(scheduler.get(id));
        if (req.method === 'PATCH') return json(scheduler.update(id, await body(req)));
        if (req.method === 'DELETE') return json(scheduler.cancel(id));
        return json({ error: 'Method not allowed' }, 405);
      }

      // Action routes
      if (req.method === 'POST' && action === 'confirm') return json(scheduler.confirm(id));
      if (req.method === 'POST' && action === 'retry') {
        const b = (await body(req)) as { sendAt?: string };
        return json(scheduler.retry(id, b.sendAt));
      }
      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new ValidationError('Request body must be valid JSON.');
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(err: unknown): Response {
  if (err instanceof ValidationError) return json({ error: err.message, field: err.field }, 400);
  if (err instanceof NotFoundError) return json({ error: err.message }, 404);
  if (err instanceof ConflictError) return json({ error: err.message }, 409);
  const message = err instanceof Error ? err.message : 'Internal error';
  return json({ error: message }, 500);
}

// ---------------------------------------------------------------------------
// Example wiring (commented — no side effects on import)
// ---------------------------------------------------------------------------
//
//   const scheduler = new EmailScheduler({
//     send: async (email) => { await myProvider.send(email); },
//   });
//   scheduler.start();
//   const handle = createRouter(scheduler);
//   // Bun:    Bun.serve({ fetch: handle });
//   // Others: adapt `handle(req: Request): Promise<Response>` to your framework.
