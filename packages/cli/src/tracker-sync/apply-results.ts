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

/** Last non-empty path segment of an issue url — the issue number if the url is well-formed. */
function urlTail(url: string): string {
  const segments = url.split('/').filter(segment => segment.length > 0);
  return segments.at(-1) ?? '';
}

export function applyResults(
  map: TrackerMap,
  results: SyncResults,
  context: ApplyContext,
): ApplyOutcome {
  // Validate every row BEFORE mutating, so a rejection leaves the map untouched.
  for (const result of results.results) {
    if (!context.ticketIds.has(result.ticketId)) {
      return {
        ok: false,
        reason: `result names ticket "${result.ticketId}", which is not in the corpus`,
      };
    }
    // The internal-id guard: `number` is authoritative, and a well-formed url ends
    // in it. A mismatch means the executor reported the wrong field (e.g. the
    // internal database id) — reject rather than record a bad ref.
    if (urlTail(result.url) !== result.number) {
      return {
        ok: false,
        reason: `result "${result.ticketId}": url does not end in issue number ${result.number} (${result.url})`,
      };
    }
  }
  for (const result of results.results) {
    map.record(result.ticketId, {
      provider: context.provider,
      id: result.number,
      url: result.url,
    });
  }
  return { ok: true };
}
