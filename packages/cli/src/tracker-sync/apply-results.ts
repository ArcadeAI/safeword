/**
 * applyResults — fold an executor's SyncResults back into the tracker-map
 * (CBTDK8). Pure over the map + a corpus id set. Records each result's bare
 * `number` + `url` as `recorded` (no `pending` — the network already happened in
 * the executor); idempotent by ticket id; validates every row BEFORE mutating so
 * a rejection leaves the map untouched. Rejects a result naming a ticket outside
 * the corpus, and (GitHub) a non-numeric `number` or a `url` whose tail ≠ `number`
 * (the internal-id guard).
 */

import type { SyncResults } from './contract.js';
import type { TrackerMap } from './tracker-map.js';
import type { Provider } from './types.js';

export interface ApplyContext {
  provider: Provider;
  ticketIds: Set<string>;
}

export type ApplyOutcome = { ok: true } | { ok: false; reason: string };

type ResultRow = SyncResults['results'][number];

/**
 * The issue number if the url is well-formed: strip any query/fragment, then take
 * the last non-empty path segment (so `.../549`, `.../549/`, `.../549?x=1`, and
 * `.../549#c` all yield `549`).
 */
function urlTail(url: string): string {
  const [path = url] = url.split(/[?#]/, 1);
  const segments = path.split('/').filter(segment => segment.length > 0);
  return segments.at(-1) ?? '';
}

/** Validate one result against the corpus + provider shape; a reason string means reject. */
function rejectReason(result: ResultRow, context: ApplyContext): string | undefined {
  if (!context.ticketIds.has(result.ticketId)) {
    return `result names ticket "${result.ticketId}", which is not in the corpus`;
  }
  // GitHub: `number` is the bare issue number (authoritative) and a well-formed url
  // ends in it — both guard the internal-id trap (a numeric internal db id whose url
  // tail differs). Linear (out of scope, unwired) uses slug urls that never end in the
  // number, so the url-tail guard does not apply there; validation for a wired Linear
  // executor is deferred to that provider's slice.
  if (context.provider === 'github') {
    if (!/^\d+$/.test(result.number)) {
      return `result "${result.ticketId}": "${result.number}" is not a numeric GitHub issue number`;
    }
    if (urlTail(result.url) !== result.number) {
      return `result "${result.ticketId}": url does not end in issue number ${result.number} (${result.url})`;
    }
  }
  return undefined;
}

export function applyResults(
  map: TrackerMap,
  results: SyncResults,
  context: ApplyContext,
): ApplyOutcome {
  // Validate every row BEFORE mutating, so a rejection leaves the map untouched.
  for (const result of results.results) {
    const reason = rejectReason(result, context);
    if (reason !== undefined) return { ok: false, reason };
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
