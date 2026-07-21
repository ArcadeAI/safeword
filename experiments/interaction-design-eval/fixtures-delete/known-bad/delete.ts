// Bulk delete that fires immediately — no consent gate. Expected: 0/1.

type Rec = { id: string; status: string; createdAt: number };

const store = new Map<string, Rec>();

// DELETE /records — deletes everything matching the filter, right now.
export function deleteMatching(filter: (r: Rec) => boolean): number {
  let n = 0;
  for (const [id, r] of store) {
    if (filter(r)) {
      store.delete(id);
      n++;
    }
  }
  return n;
}
