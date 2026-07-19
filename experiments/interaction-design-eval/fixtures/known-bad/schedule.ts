// Happy-path scheduled email — no interaction-design affordances.
// Expected grade: 0/3 (calibration lower bound).

type Scheduled = { id: string; to: string[]; subject: string; body: string; at: number };

const store: Scheduled[] = [];

// POST /schedule
export function schedule(input: Omit<Scheduled, 'id'>): Scheduled {
  const item = { ...input, id: crypto.randomUUID() };
  store.push(item);
  return item;
}

// worker loop: send everything due
export async function runDue(now: number, send: (s: Scheduled) => Promise<void>) {
  for (const item of store) {
    if (item.at <= now) {
      await send(item); // if this throws, the item is gone
    }
  }
}
