/**
 * applyResults — fold an executor's SyncResults back into the tracker-map
 * (CBTDK8). Pure over the map + a corpus id set. Records each result's bare
 * `number` + `url` as `recorded` (no `pending` — the network already happened in
 * the executor); idempotent by ticket id; validates every row BEFORE mutating so
 * a rejection leaves the map untouched. Rejects a result naming a ticket outside
 * the corpus, one carrying a blank number or a non-http url (the provider-neutral
 * floor), and — for GitHub — a non-numeric `number` or a `url` whose tail ≠
 * `number` (the internal-id guard).
 */

import type { SyncResults } from './contract.js';
import type { TrackerMap } from './tracker-map.js';
import type { Provider } from './types.js';

export interface ApplyResultsInput {
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
function rejectReason(result: ResultRow, input: ApplyResultsInput): string | undefined {
  if (!input.ticketIds.has(result.ticketId)) {
    return `result names ticket "${result.ticketId}", which is not in the corpus`;
  }
  // Provider-neutral floor, applied to EVERY provider (including ones added later):
  // a ref is only useful if it carries a non-blank id and a real http(s) url. The
  // provider-specific block below can only tighten this, never replace it — without
  // the floor, a non-github provider would fail open and record whitespace/garbage
  // into the sidecar, which `computePlan` would then echo back as an update ref.
  if (result.number.trim().length === 0) {
    return `result "${result.ticketId}": issue number is blank`;
  }
  if (!isHttpUrl(result.url)) {
    return `result "${result.ticketId}": "${result.url}" is not an http(s) issue url`;
  }
  // GitHub adds the identity guard: `number` is the bare issue number (authoritative)
  // and a well-formed url ends in it — together they catch the internal-id trap (a
  // numeric internal db id whose url tail differs). Linear uses slug urls that never
  // end in the number, so the tail check cannot apply there; its executor slice owns
  // any tighter Linear-specific validation.
  if (input.provider === 'github') {
    if (!/^\d+$/.test(result.number)) {
      return `result "${result.ticketId}": "${result.number}" is not a numeric GitHub issue number`;
    }
    if (urlTail(result.url) !== result.number) {
      return `result "${result.ticketId}": url does not end in issue number ${result.number} (${result.url})`;
    }
  }
  return undefined;
}

/** True for a syntactically valid http/https URL — the floor every provider's ref must clear. */
function isHttpUrl(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const { protocol } = new URL(value);
  return protocol === 'http:' || protocol === 'https:';
}

/** Fold an executor's results into the map, or reject without mutating it. */
export function applyResults(
  map: TrackerMap,
  results: SyncResults,
  context: ApplyResultsInput,
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
