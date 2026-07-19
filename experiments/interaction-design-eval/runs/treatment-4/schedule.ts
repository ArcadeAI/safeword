/**
 * Scheduled email — a single module plus HTTP route handlers.
 *
 * A user hands off an email to be sent later, while they are not watching.
 * That hand-off opens gaps between the user and the system. The design below
 * is organised around closing them:
 *
 *   Evaluation        — GET /scheduled-emails and GET /scheduled-emails/:id
 *                        let the user see everything they have delegated and
 *                        the exact state of each one (with a human "why" on
 *                        anything that failed).
 *
 *   Confirmation      — scheduling is two steps. POST creates a DRAFT and
 *                        returns a preview; nothing sends until the user
 *                        confirms it with POST /:id/confirm. A mistaken send
 *                        is caught before it goes out, not after.
 *
 *   Interrupt         — while an email is still PENDING the user can cancel it
 *                        (DELETE) or edit it (PATCH) — recipients, subject,
 *                        body, or time. Once it is actually sending or sent,
 *                        those edits are refused rather than silently ignored.
 *
 *   Recovery          — the worker runs unattended. If a send fails (bad
 *                        recipient, provider error, a crash mid-flight) the job
 *                        is never lost: it is retried with backoff, and if it
 *                        exhausts its retries it moves to FAILED with a reason
 *                        the user can read. A process that dies mid-send leaves
 *                        the job in SENDING; on restart recover() sweeps those
 *                        back to PENDING so they are retried, never stranded.
 *
 * No database and no real provider — an in-memory store and an injectable
 * send(email) function are enough to show the shape.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type ScheduledEmailStatus =
  | 'draft' // created, awaiting the user's explicit confirmation
  | 'pending' // confirmed, waiting for its scheduled time
  | 'sending' // the worker is delivering it right now
  | 'sent' // delivered successfully
  | 'failed' // gave up after exhausting retries — see failureReason
  | 'cancelled'; // the user stopped it before it sent

export interface EmailDraft {
  subject: string;
  body: string;
  recipients: string[];
  /** Absolute send time, epoch milliseconds. */
  sendAt: number;
}

export interface Attempt {
  at: number;
  ok: boolean;
  error?: string;
}

export interface ScheduledEmail extends EmailDraft {
  id: string;
  status: ScheduledEmailStatus;
  createdAt: number;
  updatedAt: number;
  /** Populated once the email actually goes out. */
  sentAt?: number;
  /** Human-readable explanation when status is "failed". */
  failureReason?: string;
  /** Delivery attempts, newest last — the audit trail for recovery. */
  attempts: Attempt[];
  retriesRemaining: number;
}

/** The function that actually delivers an email. Swap in a real provider. */
export type SendFn = (email: {
  subject: string;
  body: string;
  recipients: string[];
}) => Promise<void>;

// ---------------------------------------------------------------------------
// Validation — cheap guards so a mistake is caught at schedule time, not at
// send time when the user is no longer watching.
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 60_000; // 1 minute between retries

export class ValidationError extends Error {}
export class NotFoundError extends Error {}
export class ConflictError extends Error {}

function validateDraft(input: Partial<EmailDraft>, now: number): EmailDraft {
  const subject = (input.subject ?? '').trim();
  const body = (input.body ?? '').trim();
  const recipients = (input.recipients ?? []).map(r => r.trim()).filter(Boolean);

  if (!subject) throw new ValidationError('Subject is required.');
  if (!body) throw new ValidationError('Body is required.');
  if (recipients.length === 0) throw new ValidationError('At least one recipient is required.');

  const bad = recipients.filter(r => !EMAIL_RE.test(r));
  if (bad.length > 0)
    throw new ValidationError(`These recipient addresses look invalid: ${bad.join(', ')}.`);

  if (typeof input.sendAt !== 'number' || Number.isNaN(input.sendAt))
    throw new ValidationError('A valid send time (sendAt) is required.');
  if (input.sendAt <= now) throw new ValidationError('Send time must be in the future.');

  return { subject, body, recipients, sendAt: input.sendAt };
}

// ---------------------------------------------------------------------------
// The scheduler — in-memory store + unattended worker
// ---------------------------------------------------------------------------

export class EmailScheduler {
  private readonly store = new Map<string, ScheduledEmail>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly send: SendFn,
    private readonly opts: {
      now?: () => number;
      tickMs?: number;
      maxRetries?: number;
      retryBackoffMs?: number;
    } = {},
  ) {}

  private now(): number {
    return this.opts.now ? this.opts.now() : Date.now();
  }

  private newId(): string {
    return `sch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // --- Confirmation step 1: create a draft (nothing is scheduled yet) -------

  /**
   * Create a DRAFT. This does NOT schedule a send — it validates the input and
   * returns a preview the user can look over. The email only enters the queue
   * once confirm() is called. This is the guard against a mistaken send.
   */
  createDraft(input: Partial<EmailDraft>): ScheduledEmail {
    const now = this.now();
    const draft = validateDraft(input, now);
    const email: ScheduledEmail = {
      id: this.newId(),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      attempts: [],
      retriesRemaining: this.opts.maxRetries ?? MAX_RETRIES,
      ...draft,
    };
    this.store.set(email.id, email);
    return email;
  }

  // --- Confirmation step 2: commit the draft to the queue ------------------

  /** Confirm a draft, moving it to PENDING so the worker will send it. */
  confirm(id: string): ScheduledEmail {
    const email = this.require(id);
    if (email.status !== 'draft')
      throw new ConflictError(`Only drafts can be confirmed; this email is "${email.status}".`);
    const now = this.now();
    if (email.sendAt <= now)
      throw new ConflictError(
        'The scheduled time has already passed. Please pick a new time before confirming.',
      );
    email.status = 'pending';
    email.updatedAt = now;
    return email;
  }

  // --- Evaluation: see what has been delegated -----------------------------

  list(filter?: { status?: ScheduledEmailStatus }): ScheduledEmail[] {
    const all = [...this.store.values()].sort((a, b) => a.sendAt - b.sendAt);
    return filter?.status ? all.filter(e => e.status === filter.status) : all;
  }

  get(id: string): ScheduledEmail {
    return this.require(id);
  }

  // --- Interrupt: change or stop a pending send before it acts --------------

  /** Edit a draft or pending email. Refused once it is sending/sent/etc. */
  update(id: string, patch: Partial<EmailDraft>): ScheduledEmail {
    const email = this.require(id);
    if (email.status !== 'draft' && email.status !== 'pending')
      throw new ConflictError(`This email is "${email.status}" and can no longer be edited.`);
    const now = this.now();
    const merged = validateDraft(
      {
        subject: patch.subject ?? email.subject,
        body: patch.body ?? email.body,
        recipients: patch.recipients ?? email.recipients,
        sendAt: patch.sendAt ?? email.sendAt,
      },
      now,
    );
    Object.assign(email, merged, { updatedAt: now });
    return email;
  }

  /** Cancel a draft or pending email so it never sends. */
  cancel(id: string): ScheduledEmail {
    const email = this.require(id);
    if (email.status !== 'draft' && email.status !== 'pending')
      throw new ConflictError(`This email is "${email.status}" and can no longer be cancelled.`);
    email.status = 'cancelled';
    email.updatedAt = this.now();
    return email;
  }

  // --- The unattended worker ------------------------------------------------

  /** Start the background worker. Safe to call once at boot. */
  start(): void {
    if (this.timer) return;
    this.recover();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.opts.tickMs ?? 1_000);
    // Do not keep the process alive just for the scheduler.
    if (typeof this.timer === 'object' && 'unref' in this.timer)
      (this.timer as { unref?: () => void }).unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Recovery on boot: anything left in SENDING means a previous process died
   * mid-flight. Return it to PENDING so it is retried rather than lost.
   */
  recover(): void {
    const now = this.now();
    for (const email of this.store.values()) {
      if (email.status === 'sending') {
        email.status = 'pending';
        email.updatedAt = now;
        email.attempts.push({
          at: now,
          ok: false,
          error: 'Interrupted before completion — requeued for retry.',
        });
      }
    }
  }

  /** One scheduler tick — deliver everything that is due. Exposed for tests. */
  async tick(): Promise<void> {
    const now = this.now();
    const due = [...this.store.values()].filter(e => e.status === 'pending' && e.sendAt <= now);
    for (const email of due) await this.deliver(email);
  }

  private async deliver(email: ScheduledEmail): Promise<void> {
    email.status = 'sending';
    email.updatedAt = this.now();
    try {
      await this.send({
        subject: email.subject,
        body: email.body,
        recipients: email.recipients,
      });
      const now = this.now();
      email.status = 'sent';
      email.sentAt = now;
      email.updatedAt = now;
      email.attempts.push({ at: now, ok: true });
    } catch (err) {
      const now = this.now();
      const reason = err instanceof Error ? err.message : String(err);
      email.attempts.push({ at: now, ok: false, error: reason });
      email.retriesRemaining -= 1;
      if (email.retriesRemaining > 0) {
        // Recover: back off and try again rather than dropping the send.
        email.status = 'pending';
        email.sendAt = now + (this.opts.retryBackoffMs ?? RETRY_BACKOFF_MS);
        email.updatedAt = now;
      } else {
        // Give up loudly — the user can see it FAILED and why, and resend.
        email.status = 'failed';
        email.failureReason = `Delivery failed after all retries: ${reason}`;
        email.updatedAt = now;
      }
    }
  }

  private require(id: string): ScheduledEmail {
    const email = this.store.get(id);
    if (!email) throw new NotFoundError(`No scheduled email with id "${id}".`);
    return email;
  }
}

// ---------------------------------------------------------------------------
// HTTP route handlers
//
// Framework-agnostic: each handler takes a small request shape and returns a
// { status, body } pair, so it drops into Express, Fetch/Hono, etc. Errors are
// translated to end-user-readable messages with the right status code.
// ---------------------------------------------------------------------------

export interface RouteRequest {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}

export interface RouteResponse {
  status: number;
  body: unknown;
}

export function createEmailRoutes(scheduler: EmailScheduler) {
  const ok = (body: unknown, status = 200): RouteResponse => ({ status, body });

  const handle = (fn: () => RouteResponse): RouteResponse => {
    try {
      return fn();
    } catch (err) {
      if (err instanceof ValidationError) return { status: 400, body: { error: err.message } };
      if (err instanceof NotFoundError) return { status: 404, body: { error: err.message } };
      if (err instanceof ConflictError) return { status: 409, body: { error: err.message } };
      return { status: 500, body: { error: 'Unexpected error.' } };
    }
  };

  return {
    // Evaluation — list everything delegated, optionally by status.
    // GET /scheduled-emails
    list: (req: RouteRequest): RouteResponse =>
      handle(() =>
        ok(
          scheduler.list({
            status: req.query?.status as ScheduledEmailStatus | undefined,
          }),
        ),
      ),

    // Evaluation — inspect one delegated email in full detail.
    // GET /scheduled-emails/:id
    get: (req: RouteRequest): RouteResponse => handle(() => ok(scheduler.get(req.params!.id))),

    // Confirmation step 1 — create a draft + preview. Nothing sends yet.
    // POST /scheduled-emails
    create: (req: RouteRequest): RouteResponse =>
      handle(() => {
        const email = scheduler.createDraft(req.body as Partial<EmailDraft>);
        return ok(
          {
            email,
            preview: {
              message:
                'Draft created. Review it, then POST to /scheduled-emails/' +
                `${email.id}/confirm to schedule the send. It will NOT be sent until you confirm.`,
              sendAtISO: new Date(email.sendAt).toISOString(),
              recipientCount: email.recipients.length,
            },
          },
          201,
        );
      }),

    // Confirmation step 2 — commit the draft to the queue.
    // POST /scheduled-emails/:id/confirm
    confirm: (req: RouteRequest): RouteResponse =>
      handle(() => ok(scheduler.confirm(req.params!.id))),

    // Interrupt — edit recipients/subject/body/time before it sends.
    // PATCH /scheduled-emails/:id
    update: (req: RouteRequest): RouteResponse =>
      handle(() => ok(scheduler.update(req.params!.id, req.body as Partial<EmailDraft>))),

    // Interrupt — stop it entirely before it sends.
    // DELETE /scheduled-emails/:id
    cancel: (req: RouteRequest): RouteResponse =>
      handle(() => ok(scheduler.cancel(req.params!.id))),
  };
}

// ---------------------------------------------------------------------------
// Example wiring (illustrative — not executed here)
// ---------------------------------------------------------------------------
//
//   const send: SendFn = async (email) => { /* call your provider */ };
//   const scheduler = new EmailScheduler(send);
//   scheduler.start();
//   const routes = createEmailRoutes(scheduler);
//
//   app.get("/scheduled-emails", (req, res) => {
//     const { status, body } = routes.list({ query: req.query });
//     res.status(status).json(body);
//   });
//   app.post("/scheduled-emails", (req, res) => {
//     const { status, body } = routes.create({ body: req.body });
//     res.status(status).json(body);
//   });
//   app.post("/scheduled-emails/:id/confirm", (req, res) => {
//     const { status, body } = routes.confirm({ params: req.params });
//     res.status(status).json(body);
//   });
//   app.patch("/scheduled-emails/:id", (req, res) => { /* routes.update */ });
//   app.delete("/scheduled-emails/:id", (req, res) => { /* routes.cancel */ });
//   app.get("/scheduled-emails/:id", (req, res) => { /* routes.get */ });
