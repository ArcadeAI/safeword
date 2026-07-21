// Bulk delete gated behind an explicit preview -> confirm step. Expected: 1/1.

type Rec = { id: string; status: string; createdAt: number };

const store = new Map<string, Rec>();
const pendingDeletes = new Map<string, string[]>(); // token -> record ids

// POST /records/delete/preview — shows what WOULD be deleted, returns a token. Deletes nothing.
export function previewDelete(filter: (r: Rec) => boolean): {
  count: number;
  token: string;
  ids: string[];
} {
  const ids = [...store.values()].filter(filter).map(r => r.id);
  const token = crypto.randomUUID();
  pendingDeletes.set(token, ids);
  return { count: ids.length, token, ids };
}

// POST /records/delete/confirm — actually deletes, only with a valid preview token (consent gate).
export function confirmDelete(token: string): number {
  const ids = pendingDeletes.get(token);
  if (!ids) throw new Error('Unknown or expired confirmation token; preview again.');
  let n = 0;
  for (const id of ids) if (store.delete(id)) n++;
  pendingDeletes.delete(token);
  return n;
}
