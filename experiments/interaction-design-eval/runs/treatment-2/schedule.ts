/**
 * Scheduled email — schedule a subject/body/recipients to send at a future time.
 *
 * This feature is a hand-off: the user asks the system to do something later,
 * while they are not watching. The design goal is to keep a non-technical
 * end-user in control across the whole gap between "I scheduled it" and "it sent."
 *
 * The four gaps that a delegated, unattended send opens — and how we close them:
 *
 *   Evaluation      — GET /scheduled-emails and GET /scheduled-emails/:id let the
 *                     user see everything they've delegated and each one's live
 *                     state (draft / scheduled / sending / sent / failed / canceled).
 *
 *   Confirmation    — a schedule is a two-step commit. POST creates it in `draft`
 *                     and echoes back exactly what will go out (rendered recipients,
 *                     subject, body, send time in the user's words). Nothing is armed
 *                     until the user POSTs .../confirm. A mistaken send is caught
 *                     before it is ever queued.
 *
 *   Interrupt       — while a send is still pending the user can cancel it
 *                     (DELETE) or edit it (PATCH re-opens it to `draft` for
 *                     re-confirmation). We bound the actor: a claim/lease means the
 *                     worker will not fire an email the user canceled a moment ago.
 *
 *   Recovery        — if a send fails unattended (bad recipient, provider error,
 *                     worker died mid-send) it does not vanish. It moves to `failed`
 *                     with the reason recorded, is retried with backoff up to a
 *                     bound, and a leased-but-never-finished job is reclaimed by the
 *                     next worker tick instead of being lost.
 *
 * No database and no real provider: an in-memory Map and an injectable
 * `send(email)` are enough to show the shape.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Domain types
// ─────────────────────────────────────────────────────────────────────────────

export type ScheduleStatus =
  | 'draft' // created, not yet confirmed — will NOT send
  | 'scheduled' // confirmed and armed — will send at/after sendAt
  | 'sending' // claimed by a worker, send in flight
  | 'sent' // delivered to the provider
  | 'failed' // exhausted retries — needs the user
  | 'canceled'; // user stopped it before it sent

export interface EmailPayload {
  subject: string;
  body: string;
  recipients: string[];
}

export interface AttemptRecord {
  at: number; // epoch ms of the attempt
  ok: boolean;
  error?: string;
}

export interface ScheduledEmail {
  id: string;
  status: ScheduleStatus;
  payload: EmailPayload;
  sendAt: number; // epoch ms — when it should go out
  createdAt: number;
  updatedAt: number;

  // Delegation / recovery bookkeeping.
  attempts: AttemptRecord[];
  maxAttempts: number;
  lastError?: string;

  // Interrupt bookkeeping — a lease so a worker can't fire a job the user
  // canceled after the worker picked it up.
  leaseOwner?: string;
  leaseExpiresAt?: number;
}

/** A send transport. Return normally on success, throw on failure. */
export type SendFn = (email: {
  subject: string;
  body: string;
  recipients: string[];
}) => Promise<void> | void;

// ─────────────────────────────────────────────────────────────────────────────
// Errors → HTTP. Keeps route handlers small and messages user-legible.
// ─────────────────────────────────────────────────────────────────────────────

export class ScheduleError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ScheduleError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation — reject nonsense at the door so the user learns before delegating,
// not after a silent failure hours later.
// ─────────────────────────────────────────────────────────────────────────────

// Deliberately simple; good enough to catch typos like "alexarcade.dev".
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LEASE_MS = 30_000; // a worker gets 30s to finish a claimed send
const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 60_000; // wait a minute between retries

export interface DraftInput {
  subject?: unknown;
  body?: unknown;
  recipients?: unknown;
  sendAt?: unknown; // ISO string or epoch ms
}

interface CleanDraft {
  payload: EmailPayload;
  sendAt: number;
}

function parseSendAt(raw: unknown, now: number): number {
  let ms: number;
  if (typeof raw === 'number') {
    ms = raw;
  } else if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    if (Number.isNaN(parsed)) {
      throw new ScheduleError(
        400,
        `Could not read the send time "${raw}". Use an ISO date like 2026-07-20T09:00:00Z.`,
      );
    }
    ms = parsed;
  } else {
    throw new ScheduleError(400, 'A send time (sendAt) is required.');
  }
  if (ms <= now) {
    throw new ScheduleError(
      400,
      'The send time is in the past. Pick a moment in the future so you have time to review it.',
    );
  }
  return ms;
}

function validateDraft(input: DraftInput, now: number): CleanDraft {
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  if (!subject) {
    throw new ScheduleError(400, 'A subject is required.');
  }

  const body = typeof input.body === 'string' ? input.body : '';
  if (!body.trim()) {
    throw new ScheduleError(400, 'A body is required.');
  }

  if (!Array.isArray(input.recipients) || input.recipients.length === 0) {
    throw new ScheduleError(400, 'At least one recipient is required.');
  }
  const recipients = input.recipients.map(r => (typeof r === 'string' ? r.trim() : ''));
  const bad = recipients.filter(r => !EMAIL_RE.test(r));
  if (bad.length > 0) {
    // Naming the bad address is the whole point of recovery-before-the-fact:
    // the user fixes the typo now instead of discovering a bounce later.
    throw new ScheduleError(
      400,
      `These recipients don't look like valid email addresses: ${bad
        .map(b => `"${b}"`)
        .join(', ')}. Fix them before scheduling.`,
    );
  }

  const sendAt = parseSendAt(input.sendAt, now);
  return { payload: { subject, body, recipients }, sendAt };
}

// ─────────────────────────────────────────────────────────────────────────────
// The scheduler — in-memory store + worker loop.
// ─────────────────────────────────────────────────────────────────────────────

export interface SchedulerOptions {
  send: SendFn;
  now?: () => number;
  id?: () => string;
  maxAttempts?: number;
  retryBackoffMs?: number;
}

let idCounter = 0;

export class EmailScheduler {
  private store = new Map<string, ScheduledEmail>();
  private send: SendFn;
  private now: () => number;
  private id: () => string;
  private maxAttempts: number;
  private retryBackoffMs: number;
  private ticking = false;

  constructor(opts: SchedulerOptions) {
    this.send = opts.send;
    this.now = opts.now ?? (() => Date.now());
    this.id = opts.id ?? (() => `sch_${Date.now().toString(36)}_${++idCounter}`);
    this.maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.retryBackoffMs = opts.retryBackoffMs ?? RETRY_BACKOFF_MS;
  }

  // ── Confirmation: step 1 of 2. Creates a draft; nothing will send yet. ──
  createDraft(input: DraftInput): ScheduledEmail {
    const now = this.now();
    const clean = validateDraft(input, now);
    const email: ScheduledEmail = {
      id: this.id(),
      status: 'draft',
      payload: clean.payload,
      sendAt: clean.sendAt,
      createdAt: now,
      updatedAt: now,
      attempts: [],
      maxAttempts: this.maxAttempts,
    };
    this.store.set(email.id, email);
    return email;
  }

  // ── Confirmation: step 2 of 2. Arms the send. ──
  confirm(id: string): ScheduledEmail {
    const email = this.require(id);
    if (email.status === 'scheduled') return email; // idempotent
    if (email.status !== 'draft') {
      throw new ScheduleError(
        409,
        `This email is "${email.status}" and can no longer be confirmed.`,
      );
    }
    if (email.sendAt <= this.now()) {
      throw new ScheduleError(
        400,
        'The send time has already passed. Update the time, then confirm again.',
      );
    }
    email.status = 'scheduled';
    email.updatedAt = this.now();
    return email;
  }

  // ── Interrupt: edit a not-yet-sent email. Re-opens it to draft so the
  //    change is re-confirmed rather than silently re-armed. ──
  update(id: string, input: DraftInput): ScheduledEmail {
    const email = this.require(id);
    if (!this.isPending(email)) {
      throw new ScheduleError(409, `This email is "${email.status}" and can no longer be edited.`);
    }
    const now = this.now();
    const clean = validateDraft(input, now);
    email.payload = clean.payload;
    email.sendAt = clean.sendAt;
    email.status = 'draft'; // must be confirmed again
    email.updatedAt = now;
    return email;
  }

  // ── Interrupt: stop a pending send. ──
  cancel(id: string): ScheduledEmail {
    const email = this.require(id);
    if (email.status === 'canceled') return email; // idempotent
    if (!this.isPending(email)) {
      throw new ScheduleError(
        409,
        `This email is "${email.status}" and can no longer be canceled.`,
      );
    }
    email.status = 'canceled';
    email.leaseOwner = undefined;
    email.leaseExpiresAt = undefined;
    email.updatedAt = this.now();
    return email;
  }

  // ── Recovery: user acts on a failed email — retry it now or give up. ──
  retryNow(id: string): ScheduledEmail {
    const email = this.require(id);
    if (email.status !== 'failed') {
      throw new ScheduleError(
        409,
        `Only failed emails can be retried; this one is "${email.status}".`,
      );
    }
    email.status = 'scheduled';
    email.sendAt = this.now(); // due immediately
    email.leaseOwner = undefined;
    email.leaseExpiresAt = undefined;
    email.updatedAt = this.now();
    return email;
  }

  // ── Evaluation: read state. ──
  get(id: string): ScheduledEmail {
    return this.require(id);
  }

  list(filter?: { status?: ScheduleStatus }): ScheduledEmail[] {
    const all = [...this.store.values()].sort((a, b) => a.sendAt - b.sendAt);
    return filter?.status ? all.filter(e => e.status === filter.status) : all;
  }

  // ── Worker tick: claim due sends, deliver, record, recover. ──
  // Call on an interval (setInterval) or on demand. Reentrancy-guarded.
  async tick(workerId = 'worker'): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const now = this.now();

      // Recovery: reclaim leases from workers that died mid-send. The lease
      // means a crashed worker never leaves a send stuck in "sending" forever.
      for (const email of this.store.values()) {
        if (
          email.status === 'sending' &&
          email.leaseExpiresAt !== undefined &&
          email.leaseExpiresAt <= now
        ) {
          email.status = 'scheduled';
          email.leaseOwner = undefined;
          email.leaseExpiresAt = undefined;
          email.updatedAt = now;
        }
      }

      const due = [...this.store.values()].filter(e => e.status === 'scheduled' && e.sendAt <= now);

      for (const email of due) {
        // Claim (lease) before sending. A cancel that lands after this point
        // is refused by isPending, so we never fire a canceled email.
        email.status = 'sending';
        email.leaseOwner = workerId;
        email.leaseExpiresAt = now + LEASE_MS;
        email.updatedAt = now;

        try {
          await this.send({
            subject: email.payload.subject,
            body: email.payload.body,
            recipients: email.payload.recipients,
          });
          const at = this.now();
          email.attempts.push({ at, ok: true });
          email.status = 'sent';
          email.lastError = undefined;
          email.leaseOwner = undefined;
          email.leaseExpiresAt = undefined;
          email.updatedAt = at;
        } catch (err) {
          const at = this.now();
          const message = err instanceof Error ? err.message : String(err);
          email.attempts.push({ at, ok: false, error: message });
          email.lastError = message;
          email.leaseOwner = undefined;
          email.leaseExpiresAt = undefined;

          if (email.attempts.length >= email.maxAttempts) {
            // Recovery: out of retries — surface it for the user rather than
            // dropping it. list({status:"failed"}) is the user's outbox alarm.
            email.status = 'failed';
          } else {
            // Recovery: back off and try again automatically.
            email.status = 'scheduled';
            email.sendAt = at + this.retryBackoffMs;
          }
          email.updatedAt = at;
        }
      }
    } finally {
      this.ticking = false;
    }
  }

  private require(id: string): ScheduledEmail {
    const email = this.store.get(id);
    if (!email) throw new ScheduleError(404, `No scheduled email "${id}".`);
    return email;
  }

  private isPending(email: ScheduledEmail): boolean {
    // "sending" is intentionally excluded: once claimed it is mid-flight; the
    // lease/reclaim path owns it. Pending = still safely interruptible.
    return email.status === 'draft' || email.status === 'scheduled';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// A user-facing view. Turns internal state into something the web UI can show
// plainly, so "what did I delegate and what is it doing" is always answerable.
// ─────────────────────────────────────────────────────────────────────────────

export interface ScheduledEmailView {
  id: string;
  status: ScheduleStatus;
  statusLabel: string;
  subject: string;
  body: string;
  recipients: string[];
  sendAt: string; // ISO
  sendAtEpochMs: number;
  createdAt: string;
  updatedAt: string;
  attemptCount: number;
  lastError?: string;
  // What the user is allowed to do right now — lets the UI show/hide buttons.
  canConfirm: boolean;
  canEdit: boolean;
  canCancel: boolean;
  canRetry: boolean;
}

const STATUS_LABELS: Record<ScheduleStatus, string> = {
  draft: 'Draft — not scheduled yet. Confirm to arm it.',
  scheduled: 'Scheduled — will send at the chosen time.',
  sending: 'Sending now…',
  sent: 'Sent.',
  failed: 'Failed to send — needs your attention.',
  canceled: 'Canceled.',
};

export function toView(email: ScheduledEmail): ScheduledEmailView {
  const pending = email.status === 'draft' || email.status === 'scheduled';
  return {
    id: email.id,
    status: email.status,
    statusLabel: STATUS_LABELS[email.status],
    subject: email.payload.subject,
    body: email.payload.body,
    recipients: email.payload.recipients,
    sendAt: new Date(email.sendAt).toISOString(),
    sendAtEpochMs: email.sendAt,
    createdAt: new Date(email.createdAt).toISOString(),
    updatedAt: new Date(email.updatedAt).toISOString(),
    attemptCount: email.attempts.length,
    lastError: email.lastError,
    canConfirm: email.status === 'draft',
    canEdit: pending,
    canCancel: pending,
    canRetry: email.status === 'failed',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP route handlers (framework-agnostic).
//
// Wire these to Express/Fastify/Hono/etc. Each takes a plain request shape and
// returns a { status, body } — trivial to adapt. Routes:
//
//   POST   /scheduled-emails             create a draft (does NOT send)
//   POST   /scheduled-emails/:id/confirm arm the draft
//   GET    /scheduled-emails             list all (optional ?status=)
//   GET    /scheduled-emails/:id         read one
//   PATCH  /scheduled-emails/:id         edit a pending one (→ back to draft)
//   POST   /scheduled-emails/:id/retry   retry a failed one now
//   DELETE /scheduled-emails/:id         cancel a pending one
// ─────────────────────────────────────────────────────────────────────────────

export interface RouteRequest {
  params?: Record<string, string>;
  query?: Record<string, string | undefined>;
  body?: unknown;
}

export interface RouteResponse {
  status: number;
  body: unknown;
}

function ok(status: number, body: unknown): RouteResponse {
  return { status, body };
}

function handle(fn: () => RouteResponse): RouteResponse {
  try {
    return fn();
  } catch (err) {
    if (err instanceof ScheduleError) {
      return ok(err.status, { error: err.message });
    }
    return ok(500, { error: 'Something went wrong scheduling that email.' });
  }
}

export function makeRoutes(scheduler: EmailScheduler) {
  return {
    // Create — returns 201 with a draft the user must then confirm. The
    // response is the confirmation preview: exactly what will go out.
    create(req: RouteRequest): RouteResponse {
      return handle(() => {
        const draft = scheduler.createDraft((req.body ?? {}) as DraftInput);
        return ok(201, {
          message: 'Draft created. Review it and POST .../confirm to schedule the send.',
          email: toView(draft),
        });
      });
    },

    confirm(req: RouteRequest): RouteResponse {
      return handle(() => {
        const id = req.params?.id ?? '';
        const email = scheduler.confirm(id);
        return ok(200, {
          message: 'Scheduled. It will send at the chosen time.',
          email: toView(email),
        });
      });
    },

    list(req: RouteRequest): RouteResponse {
      return handle(() => {
        const status = req.query?.status as ScheduleStatus | undefined;
        const emails = scheduler.list(status ? { status } : undefined).map(toView);
        return ok(200, { emails });
      });
    },

    get(req: RouteRequest): RouteResponse {
      return handle(() => {
        const email = scheduler.get(req.params?.id ?? '');
        return ok(200, { email: toView(email) });
      });
    },

    update(req: RouteRequest): RouteResponse {
      return handle(() => {
        const id = req.params?.id ?? '';
        const email = scheduler.update(id, (req.body ?? {}) as DraftInput);
        return ok(200, {
          message: 'Updated. Because the content changed, confirm again to re-arm the send.',
          email: toView(email),
        });
      });
    },

    retry(req: RouteRequest): RouteResponse {
      return handle(() => {
        const email = scheduler.retryNow(req.params?.id ?? '');
        return ok(200, {
          message: 'Retrying now.',
          email: toView(email),
        });
      });
    },

    cancel(req: RouteRequest): RouteResponse {
      return handle(() => {
        const email = scheduler.cancel(req.params?.id ?? '');
        return ok(200, {
          message: 'Canceled. This email will not be sent.',
          email: toView(email),
        });
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Wiring example (in-memory store + a fake send). Not executed on import.
//
//   const scheduler = new EmailScheduler({
//     send: async (email) => { console.log("SENT", email.subject); },
//   });
//   const routes = makeRoutes(scheduler);
//   setInterval(() => { void scheduler.tick(); }, 1_000); // background worker
//
// Express adapter sketch:
//   app.post("/scheduled-emails", (req, res) => {
//     const r = routes.create({ body: req.body });
//     res.status(r.status).json(r.body);
//   });
//   // …and so on for the other routes.
// ─────────────────────────────────────────────────────────────────────────────
