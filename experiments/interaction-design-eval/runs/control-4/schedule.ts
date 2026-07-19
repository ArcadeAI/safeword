/**
 * Scheduled-email feature.
 *
 * Lets a web-UI user schedule an email (subject, body, recipients) to be sent
 * at a chosen future time. Ships with an in-memory store, a pluggable
 * `send(email)` function, a background scheduler, and route handlers.
 *
 * A single self-contained module — no database, no real email provider.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScheduledEmailStatus = 'scheduled' | 'sent' | 'failed' | 'canceled';

/** The payload a user submits from the web UI. */
export interface ScheduleEmailInput {
  subject: string;
  body: string;
  recipients: string[];
  /** ISO-8601 string or epoch milliseconds for when to send. */
  sendAt: string | number;
}

/** The email as handed to the transport at send time. */
export interface Email {
  subject: string;
  body: string;
  recipients: string[];
}

/** A stored, scheduled email plus its lifecycle metadata. */
export interface ScheduledEmail extends Email {
  id: string;
  /** Epoch milliseconds. */
  sendAt: number;
  status: ScheduledEmailStatus;
  createdAt: number;
  sentAt?: number;
  error?: string;
}

/** Transport used to actually deliver an email. Swap for a real provider. */
export type SendFn = (email: Email) => Promise<void> | void;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Scheduled email not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

// Deliberately simple, forgiving check — good enough for a UI-facing feature
// while rejecting obviously malformed addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_SUBJECT_LEN = 998; // RFC 5322 line-length guidance.
const MAX_BODY_LEN = 100_000;
const MAX_RECIPIENTS = 100;

function normalizeSendAt(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') {
    throw new ValidationError('sendAt is required', 'sendAt');
  }

  let ms: number;
  if (typeof raw === 'number') {
    ms = raw;
  } else if (typeof raw === 'string') {
    // Accept both numeric strings and ISO dates.
    const asNumber = Number(raw);
    ms = Number.isFinite(asNumber) && raw.trim() !== '' ? asNumber : Date.parse(raw);
  } else {
    throw new ValidationError('sendAt must be an ISO date string or epoch ms', 'sendAt');
  }

  if (!Number.isFinite(ms)) {
    throw new ValidationError('sendAt is not a valid date', 'sendAt');
  }
  return ms;
}

/**
 * Validate and normalize raw user input into the fields we can safely store.
 * Throws {@link ValidationError} on the first problem found.
 */
export function validateInput(
  input: Partial<ScheduleEmailInput> | undefined,
  now: number = Date.now(),
): { subject: string; body: string; recipients: string[]; sendAt: number } {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('Request body must be a JSON object');
  }

  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  if (!subject) {
    throw new ValidationError('subject is required', 'subject');
  }
  if (subject.length > MAX_SUBJECT_LEN) {
    throw new ValidationError(`subject must be at most ${MAX_SUBJECT_LEN} characters`, 'subject');
  }

  // Body may be empty-ish but must be a string.
  const body = typeof input.body === 'string' ? input.body : '';
  if (input.body !== undefined && typeof input.body !== 'string') {
    throw new ValidationError('body must be a string', 'body');
  }
  if (body.length > MAX_BODY_LEN) {
    throw new ValidationError(`body must be at most ${MAX_BODY_LEN} characters`, 'body');
  }

  if (!Array.isArray(input.recipients) || input.recipients.length === 0) {
    throw new ValidationError('recipients must be a non-empty array', 'recipients');
  }
  if (input.recipients.length > MAX_RECIPIENTS) {
    throw new ValidationError(
      `recipients must contain at most ${MAX_RECIPIENTS} addresses`,
      'recipients',
    );
  }

  const recipients: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.recipients) {
    if (typeof raw !== 'string') {
      throw new ValidationError('each recipient must be a string', 'recipients');
    }
    const addr = raw.trim().toLowerCase();
    if (!EMAIL_RE.test(addr)) {
      throw new ValidationError(`"${raw}" is not a valid email address`, 'recipients');
    }
    if (!seen.has(addr)) {
      seen.add(addr);
      recipients.push(addr);
    }
  }

  const sendAt = normalizeSendAt(input.sendAt);
  if (sendAt <= now) {
    throw new ValidationError('sendAt must be in the future', 'sendAt');
  }

  return { subject, body, recipients, sendAt };
}

// ---------------------------------------------------------------------------
// Store + scheduler
// ---------------------------------------------------------------------------

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `email_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export interface SchedulerOptions {
  /** Transport that actually delivers a due email. */
  send: SendFn;
  /** How often (ms) to scan the store for due emails. Default 1000. */
  tickIntervalMs?: number;
  /** Injectable clock, mainly for tests. Default `Date.now`. */
  now?: () => number;
}

/**
 * Owns the in-memory store and a background timer that dispatches due emails.
 *
 * Usage:
 *   const scheduler = new EmailScheduler({ send });
 *   scheduler.start();
 *   const email = scheduler.schedule({ subject, body, recipients, sendAt });
 */
export class EmailScheduler {
  private readonly store = new Map<string, ScheduledEmail>();
  private readonly send: SendFn;
  private readonly tickIntervalMs: number;
  private readonly now: () => number;
  private timer: ReturnType<typeof setInterval> | undefined;
  private draining = false;

  constructor(options: SchedulerOptions) {
    this.send = options.send;
    this.tickIntervalMs = options.tickIntervalMs ?? 1000;
    this.now = options.now ?? Date.now;
  }

  /** Begin the background dispatch loop. Idempotent. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.tickIntervalMs);
    // Don't keep the process alive purely for the scheduler, if supported.
    if (typeof this.timer === 'object' && typeof (this.timer as any).unref === 'function') {
      (this.timer as any).unref();
    }
  }

  /** Stop the background dispatch loop. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /** Validate input and enqueue a new scheduled email. */
  schedule(input: Partial<ScheduleEmailInput> | undefined): ScheduledEmail {
    const { subject, body, recipients, sendAt } = validateInput(input, this.now());
    const record: ScheduledEmail = {
      id: generateId(),
      subject,
      body,
      recipients,
      sendAt,
      status: 'scheduled',
      createdAt: this.now(),
    };
    this.store.set(record.id, record);
    return { ...record };
  }

  /** Fetch a single scheduled email by id. */
  get(id: string): ScheduledEmail {
    const record = this.store.get(id);
    if (!record) throw new NotFoundError();
    return { ...record };
  }

  /** List all scheduled emails, newest first. */
  list(): ScheduledEmail[] {
    return [...this.store.values()].sort((a, b) => b.createdAt - a.createdAt).map(r => ({ ...r }));
  }

  /** Cancel a still-pending email. Throws if already sent or missing. */
  cancel(id: string): ScheduledEmail {
    const record = this.store.get(id);
    if (!record) throw new NotFoundError();
    if (record.status !== 'scheduled') {
      throw new ValidationError(`Cannot cancel an email with status "${record.status}"`);
    }
    record.status = 'canceled';
    return { ...record };
  }

  /**
   * Scan for due emails and dispatch them. Runs on the timer, but is also
   * safe (and useful) to call directly in tests. Serialized so a slow send
   * never overlaps the next tick.
   */
  async tick(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      const now = this.now();
      const due = [...this.store.values()]
        .filter(r => r.status === 'scheduled' && r.sendAt <= now)
        .sort((a, b) => a.sendAt - b.sendAt);

      for (const record of due) {
        // Re-check: a concurrent cancel may have landed.
        if (record.status !== 'scheduled') continue;
        try {
          await this.send({
            subject: record.subject,
            body: record.body,
            recipients: [...record.recipients],
          });
          record.status = 'sent';
          record.sentAt = this.now();
          record.error = undefined;
        } catch (err) {
          record.status = 'failed';
          record.error = err instanceof Error ? err.message : String(err);
        }
      }
    } finally {
      this.draining = false;
    }
  }
}

// ---------------------------------------------------------------------------
// HTTP route handlers
// ---------------------------------------------------------------------------

export interface HttpRequest {
  body?: unknown;
  params?: Record<string, string>;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}

function errorResponse(err: unknown): HttpResponse {
  if (err instanceof ValidationError) {
    return { status: 400, body: { error: err.message, field: err.field } };
  }
  if (err instanceof NotFoundError) {
    return { status: 404, body: { error: err.message } };
  }
  return {
    status: 500,
    body: { error: err instanceof Error ? err.message : 'Internal error' },
  };
}

/**
 * Framework-agnostic handlers. Adapt to Express/Fastify/etc. by mapping their
 * req/res onto {@link HttpRequest}/{@link HttpResponse}.
 */
export function createRoutes(scheduler: EmailScheduler) {
  return {
    /** POST /scheduled-emails — schedule a new email. */
    create(req: HttpRequest): HttpResponse {
      try {
        const record = scheduler.schedule(req.body as Partial<ScheduleEmailInput>);
        return { status: 201, body: record };
      } catch (err) {
        return errorResponse(err);
      }
    },

    /** GET /scheduled-emails — list all scheduled emails. */
    list(): HttpResponse {
      return { status: 200, body: scheduler.list() };
    },

    /** GET /scheduled-emails/:id — fetch one. */
    get(req: HttpRequest): HttpResponse {
      try {
        const id = req.params?.id ?? '';
        return { status: 200, body: scheduler.get(id) };
      } catch (err) {
        return errorResponse(err);
      }
    },

    /** DELETE /scheduled-emails/:id — cancel a pending email. */
    cancel(req: HttpRequest): HttpResponse {
      try {
        const id = req.params?.id ?? '';
        return { status: 200, body: scheduler.cancel(id) };
      } catch (err) {
        return errorResponse(err);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Example wiring (in-memory store + stub transport)
// ---------------------------------------------------------------------------

/**
 * A trivial `send` implementation for demos/tests — logs and resolves.
 * Replace with a real provider (SES, SendGrid, SMTP, …) in production.
 */
export const consoleSend: SendFn = email => {
  // eslint-disable-next-line no-console
  console.log(`[send] to=${email.recipients.join(', ')} subject=${email.subject}`);
};

/** Convenience factory: scheduler + routes wired together and started. */
export function createScheduledEmailFeature(send: SendFn = consoleSend) {
  const scheduler = new EmailScheduler({ send });
  scheduler.start();
  const routes = createRoutes(scheduler);
  return { scheduler, routes };
}
