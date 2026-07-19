// Scheduled email with the delegation-gulf affordances wired in.
// Expected grade: 3/3 (calibration upper bound).

type Status = 'pending' | 'confirmed' | 'sent' | 'failed';
type Scheduled = {
  id: string;
  to: string[];
  subject: string;
  body: string;
  at: number;
  status: Status;
  attempts: number;
};

const store = new Map<string, Scheduled>();
const deadLetter: Scheduled[] = [];

// POST /schedule — creates a draft the user must confirm before it can ever send.
export function schedule(input: {
  to: string[];
  subject: string;
  body: string;
  at: number;
}): Scheduled {
  const item: Scheduled = { ...input, id: crypto.randomUUID(), status: 'pending', attempts: 0 };
  store.set(item.id, item);
  return item;
}

// GET /schedule — user can see what is delegated and its state (evaluation).
export function list(): Scheduled[] {
  return [...store.values()];
}

// POST /schedule/:id/confirm — the send is gated on explicit confirmation (execution).
export function confirm(id: string): Scheduled | undefined {
  const item = store.get(id);
  if (item && item.status === 'pending') item.status = 'confirmed';
  return item;
}

// DELETE /schedule/:id — user can interrupt/cancel before it fires (delegation: bound).
export function cancel(id: string): boolean {
  return store.delete(id);
}

// worker loop: only sends CONFIRMED items; retries, then dead-letters (delegation: recovery).
export async function runDue(now: number, send: (s: Scheduled) => Promise<void>) {
  for (const item of store.values()) {
    if (item.status !== 'confirmed' || item.at > now) continue;
    try {
      await send(item);
      item.status = 'sent';
    } catch (err) {
      item.attempts += 1;
      if (item.attempts >= 3) {
        item.status = 'failed';
        deadLetter.push(item); // visible failed state, not silently lost
      }
    }
  }
}
