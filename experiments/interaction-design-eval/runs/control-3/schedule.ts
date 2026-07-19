/**
 * Scheduled-email feature.
 *
 * A small, self-contained module that lets a web app schedule an email
 * (subject, body, recipients) to be delivered at a chosen future time.
 *
 * It provides:
 *   - an in-memory store of scheduled emails
 *   - a background scheduler that fires due emails
 *   - `send(email)` — the seam where a real provider would plug in
 *   - framework-agnostic HTTP route handlers (schedule / list / get / cancel)
 *
 * No database and no real email provider are required.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Email {
  subject: string;
  body: string;
  /** One or more recipient email addresses. */
  recipients: string[];
}

export type ScheduledStatus = 'scheduled' | 'sent' | 'failed' | 'canceled';

export interface ScheduledEmail {
  id: string;
  email: Email;
  /** When the email should be sent, as epoch milliseconds (UTC). */
  sendAt: number;
  status: ScheduledStatus;
  createdAt: number;
  /** Set once the email has been sent (or a send was attempted). */
  sentAt?: number;
  /** Populated when status is "failed". */
  error?: string;
}

/** Shape accepted from the web UI when scheduling. */
export interface ScheduleRequest {
  subject: unknown;
  body: unknown;
  recipients: unknown;
  /** ISO-8601 timestamp or epoch milliseconds for the desired send time. */
  sendAt: unknown;
}

// ---------------------------------------------------------------------------
// Sending (provider seam)
// ---------------------------------------------------------------------------

/**
 * Delivers an email. In production this would call a real provider
 * (SES, Postmark, SMTP, ...). Here it just records the attempt.
 *
 * Returns a promise so callers can await real network delivery. It may
 * reject to signal a delivery failure.
 */
export async function send(email: Email): Promise<void> {
  // Replace this body with a real provider integration.
  // eslint-disable-next-line no-console
  console.log(`[send] to=${email.recipients.join(', ')} subject=${JSON.stringify(email.subject)}`);
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

// Deliberately permissive but non-empty check; good enough to catch the
// common UI mistakes (blank field, obvious typo) without rejecting valid
// but unusual addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ParsedSchedule {
  email: Email;
  sendAt: number;
}

/**
 * Validates and normalizes a raw request from the web UI.
 * Throws ValidationError with a user-friendly message on bad input.
 */
export function parseScheduleRequest(
  raw: ScheduleRequest,
  now: number = Date.now(),
): ParsedSchedule {
  const subject = raw.subject;
  if (typeof subject !== 'string' || subject.trim() === '') {
    throw new ValidationError('A subject is required.');
  }

  const body = raw.body;
  if (typeof body !== 'string' || body.trim() === '') {
    throw new ValidationError('A message body is required.');
  }

  if (!Array.isArray(raw.recipients) || raw.recipients.length === 0) {
    throw new ValidationError('At least one recipient is required.');
  }

  const recipients: string[] = [];
  for (const r of raw.recipients) {
    if (typeof r !== 'string' || !EMAIL_RE.test(r.trim())) {
      throw new ValidationError(`"${String(r)}" is not a valid email address.`);
    }
    recipients.push(r.trim());
  }

  const sendAt = parseSendAt(raw.sendAt);
  if (sendAt <= now) {
    throw new ValidationError('The send time must be in the future.');
  }

  return {
    email: {
      subject: subject.trim(),
      body,
      recipients,
    },
    sendAt,
  };
}

function parseSendAt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const ms = Date.parse(value);
    if (!Number.isNaN(ms)) {
      return ms;
    }
  }
  throw new ValidationError('A valid send time (ISO-8601 or epoch milliseconds) is required.');
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

export interface SchedulerOptions {
  /** How often to check for due emails, in ms. Defaults to 1000. */
  tickMs?: number;
  /** Injectable clock, for testing. Defaults to Date.now. */
  now?: () => number;
  /** Injectable sender, for testing. Defaults to the module `send`. */
  sender?: (email: Email) => Promise<void>;
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `sched_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export class EmailScheduler {
  private readonly store = new Map<string, ScheduledEmail>();
  private readonly tickMs: number;
  private readonly now: () => number;
  private readonly sender: (email: Email) => Promise<void>;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: SchedulerOptions = {}) {
    this.tickMs = options.tickMs ?? 1000;
    this.now = options.now ?? Date.now;
    this.sender = options.sender ?? send;
  }

  /** Begin the background loop that dispatches due emails. */
  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      void this.dispatchDue();
    }, this.tickMs);
    // Do not keep the process alive solely for the scheduler.
    if (typeof this.timer === 'object' && this.timer && 'unref' in this.timer) {
      (this.timer as { unref: () => void }).unref();
    }
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Schedule a validated email. */
  schedule(email: Email, sendAt: number): ScheduledEmail {
    const record: ScheduledEmail = {
      id: nextId(),
      email,
      sendAt,
      status: 'scheduled',
      createdAt: this.now(),
    };
    this.store.set(record.id, record);
    return record;
  }

  get(id: string): ScheduledEmail | undefined {
    return this.store.get(id);
  }

  list(): ScheduledEmail[] {
    return [...this.store.values()].sort((a, b) => a.sendAt - b.sendAt);
  }

  /**
   * Cancel a scheduled email. Only emails still in the "scheduled" state
   * can be canceled. Returns the updated record, or undefined if unknown.
   */
  cancel(id: string): ScheduledEmail | undefined {
    const record = this.store.get(id);
    if (!record) return undefined;
    if (record.status === 'scheduled') {
      record.status = 'canceled';
    }
    return record;
  }

  /** Send every email whose time has come. Safe to call repeatedly. */
  async dispatchDue(): Promise<void> {
    const now = this.now();
    const due = [...this.store.values()].filter(r => r.status === 'scheduled' && r.sendAt <= now);
    for (const record of due) {
      // Guard against re-entrancy: mark before awaiting.
      record.status = 'sent';
      record.sentAt = this.now();
      try {
        await this.sender(record.email);
      } catch (err) {
        record.status = 'failed';
        record.error = err instanceof Error ? err.message : String(err);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// HTTP route handlers (framework-agnostic)
// ---------------------------------------------------------------------------
//
// These use a tiny adapter shape so they can be wired into Express, Fastify,
// a Fetch-based router, or tested directly without a server.

export interface RouteResult {
  status: number;
  body: unknown;
}

/** Public view of a scheduled email (safe to return to the UI). */
function toView(record: ScheduledEmail) {
  return {
    id: record.id,
    subject: record.email.subject,
    body: record.email.body,
    recipients: record.email.recipients,
    sendAt: new Date(record.sendAt).toISOString(),
    status: record.status,
    createdAt: new Date(record.createdAt).toISOString(),
    sentAt: record.sentAt ? new Date(record.sentAt).toISOString() : undefined,
    error: record.error,
  };
}

export function createRoutes(scheduler: EmailScheduler) {
  return {
    /** POST /emails — schedule a new email. */
    schedule(rawBody: unknown): RouteResult {
      try {
        const { email, sendAt } = parseScheduleRequest((rawBody ?? {}) as ScheduleRequest);
        const record = scheduler.schedule(email, sendAt);
        return { status: 201, body: toView(record) };
      } catch (err) {
        if (err instanceof ValidationError) {
          return { status: 400, body: { error: err.message } };
        }
        return { status: 500, body: { error: 'Internal error.' } };
      }
    },

    /** GET /emails — list all scheduled emails. */
    list(): RouteResult {
      return { status: 200, body: scheduler.list().map(toView) };
    },

    /** GET /emails/:id — fetch one scheduled email. */
    get(id: string): RouteResult {
      const record = scheduler.get(id);
      if (!record) {
        return { status: 404, body: { error: 'Not found.' } };
      }
      return { status: 200, body: toView(record) };
    },

    /** DELETE /emails/:id — cancel a scheduled email. */
    cancel(id: string): RouteResult {
      const record = scheduler.cancel(id);
      if (!record) {
        return { status: 404, body: { error: 'Not found.' } };
      }
      if (record.status !== 'canceled') {
        return {
          status: 409,
          body: { error: `Cannot cancel an email that is already ${record.status}.` },
        };
      }
      return { status: 200, body: toView(record) };
    },
  };
}

// ---------------------------------------------------------------------------
// Example wiring (default singletons)
// ---------------------------------------------------------------------------

export const scheduler = new EmailScheduler();
export const routes = createRoutes(scheduler);

// Start dispatching when this module is loaded in a server context.
scheduler.start();
