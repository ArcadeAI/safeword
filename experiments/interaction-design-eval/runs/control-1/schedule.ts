/**
 * Scheduled-email feature.
 *
 * Users schedule an email (subject, body, recipients) to be sent at a chosen
 * future time. This module provides:
 *   - an in-memory store of scheduled emails
 *   - a scheduler that fires due emails via a pluggable `send(email)` function
 *   - HTTP route handlers (framework-agnostic) to create / list / cancel
 *
 * No database or real email provider is required.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Email {
  subject: string;
  body: string;
  recipients: string[];
}

export type ScheduledStatus = 'scheduled' | 'sent' | 'failed' | 'cancelled';

export interface ScheduledEmail extends Email {
  id: string;
  /** Epoch milliseconds at which the email should be sent. */
  sendAt: number;
  status: ScheduledStatus;
  createdAt: number;
  /** Set when status becomes "sent" or "failed". */
  sentAt?: number;
  /** Error message when status is "failed". */
  error?: string;
}

/** A function that actually delivers an email. Swap in a real provider later. */
export type SendFn = (email: Email) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ScheduleInput {
  subject?: unknown;
  body?: unknown;
  recipients?: unknown;
  /** ISO-8601 string or epoch milliseconds. */
  sendAt?: unknown;
}

interface ValidatedInput {
  subject: string;
  body: string;
  recipients: string[];
  sendAt: number;
}

function parseSendAt(raw: unknown, now: number): number {
  let ms: number;
  if (typeof raw === 'number') {
    ms = raw;
  } else if (typeof raw === 'string') {
    // Accept either a numeric epoch string or an ISO date string.
    const asNum = Number(raw);
    ms = Number.isFinite(asNum) && raw.trim() !== '' ? asNum : Date.parse(raw);
  } else {
    throw new ValidationError('sendAt is required');
  }
  if (!Number.isFinite(ms)) {
    throw new ValidationError('sendAt is not a valid date/time');
  }
  if (ms <= now) {
    throw new ValidationError('sendAt must be in the future');
  }
  return ms;
}

export function validate(input: ScheduleInput, now: number): ValidatedInput {
  const subject = input.subject;
  if (typeof subject !== 'string' || subject.trim() === '') {
    throw new ValidationError('subject is required');
  }

  const body = input.body;
  if (typeof body !== 'string' || body.trim() === '') {
    throw new ValidationError('body is required');
  }

  const recipients = input.recipients;
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new ValidationError('at least one recipient is required');
  }
  const cleaned: string[] = [];
  for (const r of recipients) {
    if (typeof r !== 'string' || !EMAIL_RE.test(r.trim())) {
      throw new ValidationError(`invalid recipient address: ${String(r)}`);
    }
    cleaned.push(r.trim());
  }

  const sendAt = parseSendAt(input.sendAt, now);

  return { subject, body, recipients: cleaned, sendAt };
}

// ---------------------------------------------------------------------------
// Scheduler + in-memory store
// ---------------------------------------------------------------------------

export class EmailScheduler {
  private store = new Map<string, ScheduledEmail>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private seq = 0;

  constructor(
    private readonly send: SendFn,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private nextId(): string {
    this.seq += 1;
    return `email_${this.seq}`;
  }

  /** Schedule a new email. Throws ValidationError on bad input. */
  schedule(input: ScheduleInput): ScheduledEmail {
    const now = this.now();
    const v = validate(input, now);

    const record: ScheduledEmail = {
      id: this.nextId(),
      subject: v.subject,
      body: v.body,
      recipients: v.recipients,
      sendAt: v.sendAt,
      status: 'scheduled',
      createdAt: now,
    };
    this.store.set(record.id, record);
    this.arm(record);
    return record;
  }

  private arm(record: ScheduledEmail): void {
    const delay = Math.max(0, record.sendAt - this.now());
    const timer = setTimeout(() => {
      void this.fire(record.id);
    }, delay);
    // Don't keep the process alive solely for a pending email.
    if (typeof timer === 'object' && timer && 'unref' in timer) {
      (timer as { unref: () => void }).unref();
    }
    this.timers.set(record.id, timer);
  }

  private async fire(id: string): Promise<void> {
    const record = this.store.get(id);
    this.timers.delete(id);
    if (!record || record.status !== 'scheduled') return;

    try {
      await this.send({
        subject: record.subject,
        body: record.body,
        recipients: record.recipients,
      });
      record.status = 'sent';
      record.sentAt = this.now();
    } catch (err) {
      record.status = 'failed';
      record.sentAt = this.now();
      record.error = err instanceof Error ? err.message : String(err);
    }
  }

  /** Cancel a still-scheduled email. Returns true if it was cancelled. */
  cancel(id: string): boolean {
    const record = this.store.get(id);
    if (!record || record.status !== 'scheduled') return false;
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
    record.status = 'cancelled';
    return true;
  }

  get(id: string): ScheduledEmail | undefined {
    return this.store.get(id);
  }

  list(): ScheduledEmail[] {
    return [...this.store.values()].sort((a, b) => a.sendAt - b.sendAt);
  }
}

// ---------------------------------------------------------------------------
// HTTP route handlers (framework-agnostic)
// ---------------------------------------------------------------------------

export interface HttpResponse {
  status: number;
  body: unknown;
}

function ok(status: number, body: unknown): HttpResponse {
  return { status, body };
}

function error(status: number, message: string): HttpResponse {
  return { status, body: { error: message } };
}

/**
 * Route handlers keyed by intent. These take already-parsed JSON and return a
 * plain { status, body } object, so they can be adapted to Express, Fetch, etc.
 */
export function createRoutes(scheduler: EmailScheduler) {
  return {
    /** POST /emails */
    create(payload: unknown): HttpResponse {
      if (payload === null || typeof payload !== 'object') {
        return error(400, 'request body must be a JSON object');
      }
      try {
        const record = scheduler.schedule(payload as ScheduleInput);
        return ok(201, record);
      } catch (err) {
        if (err instanceof ValidationError) return error(400, err.message);
        return error(500, 'internal error');
      }
    },

    /** GET /emails */
    list(): HttpResponse {
      return ok(200, scheduler.list());
    },

    /** GET /emails/:id */
    get(id: string): HttpResponse {
      const record = scheduler.get(id);
      if (!record) return error(404, 'not found');
      return ok(200, record);
    },

    /** DELETE /emails/:id */
    cancel(id: string): HttpResponse {
      const cancelled = scheduler.cancel(id);
      if (!cancelled) {
        return error(409, 'email cannot be cancelled (not scheduled or unknown)');
      }
      return ok(200, scheduler.get(id));
    },
  };
}

// ---------------------------------------------------------------------------
// Example wiring (an in-memory send function you can call)
// ---------------------------------------------------------------------------

/** A trivial send() that "delivers" by logging. Replace with a real provider. */
export const consoleSend: SendFn = email => {
  // eslint-disable-next-line no-console
  console.log(`[send] to=${email.recipients.join(', ')} subject=${JSON.stringify(email.subject)}`);
};

/** Convenience factory: a scheduler + routes backed by consoleSend. */
export function createEmailScheduling(send: SendFn = consoleSend) {
  const scheduler = new EmailScheduler(send);
  const routes = createRoutes(scheduler);
  return { scheduler, routes };
}
