/**
 * applyResults — fold an executor's SyncResults back into the tracker-map
 * (CBTDK8). Pure over the map + a corpus id set. Records each result's bare
 * `number` + `url` as `recorded` (no `pending` — the network already happened in
 * the executor); idempotent by ticket id; rejects a result naming a ticket
 * outside the corpus or whose `url` tail ≠ `number` (the internal-id guard),
 * leaving the map untouched. Slice-4 GREEN implements the body.
 */

import type { SyncResults } from './contract.js';
import type { TrackerMap } from './tracker-map.js';
import type { Provider } from './types.js';

export interface ApplyContext {
  provider: Provider;
  ticketIds: Set<string>;
}

export type ApplyOutcome = { ok: true } | { ok: false; reason: string };

export function applyResults(
  _map: TrackerMap,
  results: SyncResults,
  _context: ApplyContext,
): ApplyOutcome {
  return { ok: false, reason: `unimplemented (${results.results.length} results)` };
}
