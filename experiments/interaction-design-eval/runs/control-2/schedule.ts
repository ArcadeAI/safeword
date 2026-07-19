/**
 * Scheduled-email feature.
 *
 * A user (working from the web UI) schedules an email — subject, body, and a
 * list of recipients — to be delivered at a chosen future time. This module
 * provides:
 *
 *   - an in-memory store of scheduled emails,
 *   - a scheduler that fires each email at its send time,
 *   - a `send(email)` function that does the actual delivery (stubbed), and
 *   - HTTP route handlers (schedule / list / get / cancel).
 *
 * There is no database and no real email provider — an in-memory Map and a
 * `send()` stub stand in for both, which is enough to exercise the logic.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailInput {
  subject: string;
  body: string;
  recipients: string[];
  /** ISO-8601 timestamp for when the email should be sent. */
  sendAt: string;
}

export interface Email {
  subject: string;
  body: string;
  recipients: string[];
}

export type ScheduledStatus = 'scheduled' | 'sent' | 'failed' | 'cancelled';

export interface ScheduledEmail {
  id: string;
  subject: string;
  body: string;
  recipients: string[];
  /** When the email is due to be sent (epoch millis). */
  sendAt: number;
  status: ScheduledStatus;
  createdAt: number;
  sentAt?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// send() — stub for a real email provider
// ---------------------------------------------------------------------------

/**
 * Delivers an email. In a real system this would call an email provider
 * (SES, SendGrid, SMTP, ...). Here it just logs so the flow is observable.
 *
 * Swap this implementation for a real provider without touching the scheduler.
 */
export async function send(email: Email): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[send] "${email.subject}" -> ${email.recipients.join(', ')}\n${email.body}`);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

// Deliberately simple, permissive-but-sane address check. A non-technical user
// typing an address should get a clear rejection, not a silent failure later.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  /** Present only when ok === true. */
  value?: {
    subject: string;
    body: string;
    recipients: string[];
    sendAt: number;
  };
}

export function validate(input: unknown, now: number = Date.now()): ValidationResult {
  const errors: string[] = [];

  if (typeof input !== 'object' || input === null) {
    return { ok: false, errors: ['Request body must be a JSON object.'] };
  }

  const { subject, body, recipients, sendAt } = input as Record<string, unknown>;

  if (typeof subject !== 'string' || subject.trim() === '') {
    errors.push('Subject is required.');
  }

  if (typeof body !== 'string' || body.trim() === '') {
    errors.push('Body is required.');
  }

  let cleanRecipients: string[] = [];
  if (!Array.isArray(recipients) || recipients.length === 0) {
    errors.push('At least one recipient is required.');
  } else {
    cleanRecipients = recipients.map(r => (typeof r === 'string' ? r.trim() : ''));
    const bad = cleanRecipients.filter(r => !EMAIL_RE.test(r));
    if (bad.length > 0) {
      errors.push(
        `These recipients are not valid email addresses: ${bad
          .map(b => (b === '' ? '(empty)' : b))
          .join(', ')}.`,
      );
    }
  }

  let sendAtMs = NaN;
  if (typeof sendAt !== 'string' || sendAt.trim() === '') {
    errors.push('A send time (sendAt) is required.');
  } else {
    sendAtMs = Date.parse(sendAt);
    if (Number.isNaN(sendAtMs)) {
      errors.push('Send time (sendAt) is not a valid date/time.');
    } else if (sendAtMs <= now) {
      errors.push('Send time (sendAt) must be in the future.');
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: [],
    value: {
      subject: (subject as string).trim(),
      body: (body as string).trim(),
      recipients: cleanRecipients,
      sendAt: sendAtMs,
    },
  };
}

// ---------------------------------------------------------------------------
// Store + scheduler
// ---------------------------------------------------------------------------

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `sched_${Date.now().toString(36)}_${idCounter}`;
}

/**
 * In-memory store and timer-driven scheduler for outgoing emails.
 *
 * Each scheduled email gets its own timer. When the timer fires we re-check
 * status (it may have been cancelled) and then attempt delivery via `send`.
 */
export class EmailScheduler {
  private readonly store = new Map<string, ScheduledEmail>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly sender: (email: Email) => Promise<void> = send) {}

  /** Schedule a validated email. Returns the stored record. */
  schedule(value: {
    subject: string;
    body: string;
    recipients: string[];
    sendAt: number;
  }): ScheduledEmail {
    const record: ScheduledEmail = {
      id: nextId(),
      subject: value.subject,
      body: value.body,
      recipients: value.recipients,
      sendAt: value.sendAt,
      status: 'scheduled',
      createdAt: Date.now(),
    };
    this.store.set(record.id, record);
    this.arm(record);
    return record;
  }

  /** List all scheduled emails, newest first. */
  list(): ScheduledEmail[] {
    return [...this.store.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  get(id: string): ScheduledEmail | undefined {
    return this.store.get(id);
  }

  /**
   * Cancel a still-pending email. Returns false if it doesn't exist or has
   * already been sent / failed / cancelled.
   */
  cancel(id: string): boolean {
    const record = this.store.get(id);
    if (!record || record.status !== 'scheduled') {
      return false;
    }
    this.clearTimer(id);
    record.status = 'cancelled';
    return true;
  }

  /** Cancel every timer — useful for shutdown / tests. */
  stop(): void {
    for (const id of [...this.timers.keys()]) {
      this.clearTimer(id);
    }
  }

  private arm(record: ScheduledEmail): void {
    const delay = Math.max(0, record.sendAt - Date.now());
    // setTimeout caps out around 24.8 days; clamp so long delays don't fire
    // immediately. Re-arm when the interim timer elapses.
    const MAX_DELAY = 2_147_483_647;
    if (delay > MAX_DELAY) {
      const timer = setTimeout(() => {
        this.timers.delete(record.id);
        if (record.status === 'scheduled') this.arm(record);
      }, MAX_DELAY);
      this.timers.set(record.id, timer);
      return;
    }

    const timer = setTimeout(() => {
      this.timers.delete(record.id);
      void this.fire(record.id);
    }, delay);
    this.timers.set(record.id, timer);
  }

  private async fire(id: string): Promise<void> {
    const record = this.store.get(id);
    if (!record || record.status !== 'scheduled') {
      return; // cancelled or already handled
    }
    try {
      await this.sender({
        subject: record.subject,
        body: record.body,
        recipients: record.recipients,
      });
      record.status = 'sent';
      record.sentAt = Date.now();
    } catch (err) {
      record.status = 'failed';
      record.error = err instanceof Error ? err.message : String(err);
    }
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}

// ---------------------------------------------------------------------------
// HTTP route handlers
// ---------------------------------------------------------------------------
//
// Framework-agnostic: each handler takes a small request shape and returns a
// { status, body } pair. Adapting to Express / Fastify / a Fetch handler is a
// thin wrapper around these.

export interface RouteRequest {
  body?: unknown;
  params?: Record<string, string>;
}

export interface RouteResponse {
  status: number;
  body: unknown;
}

function publicView(record: ScheduledEmail) {
  return {
    id: record.id,
    subject: record.subject,
    body: record.body,
    recipients: record.recipients,
    sendAt: new Date(record.sendAt).toISOString(),
    status: record.status,
    createdAt: new Date(record.createdAt).toISOString(),
    sentAt: record.sentAt ? new Date(record.sentAt).toISOString() : undefined,
    error: record.error,
  };
}

/** Default scheduler instance used by the exported route handlers. */
export const scheduler = new EmailScheduler();

export const routes = {
  /** POST /emails — schedule a new email. */
  schedule(req: RouteRequest): RouteResponse {
    const result = validate(req.body);
    if (!result.ok || !result.value) {
      return { status: 400, body: { errors: result.errors } };
    }
    const record = scheduler.schedule(result.value);
    return { status: 201, body: publicView(record) };
  },

  /** GET /emails — list scheduled emails. */
  list(): RouteResponse {
    return { status: 200, body: scheduler.list().map(publicView) };
  },

  /** GET /emails/:id — fetch one. */
  get(req: RouteRequest): RouteResponse {
    const id = req.params?.id ?? '';
    const record = scheduler.get(id);
    if (!record) {
      return { status: 404, body: { error: 'Scheduled email not found.' } };
    }
    return { status: 200, body: publicView(record) };
  },

  /** DELETE /emails/:id — cancel a pending email. */
  cancel(req: RouteRequest): RouteResponse {
    const id = req.params?.id ?? '';
    const record = scheduler.get(id);
    if (!record) {
      return { status: 404, body: { error: 'Scheduled email not found.' } };
    }
    const cancelled = scheduler.cancel(id);
    if (!cancelled) {
      return {
        status: 409,
        body: {
          error: `Email cannot be cancelled because its status is "${record.status}".`,
        },
      };
    }
    return { status: 200, body: publicView(scheduler.get(id)!) };
  },
};
