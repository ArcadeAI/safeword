// Reading the declared intent a project exposes (ticket 36EEMY, Rule TB1.R6).
//
// Every arcade pull request carries a mandatory, pre-committed tracker issue —
// a contract written before the code that nobody currently checks the diff
// against. Reading it is the whole wedge. But reading it has a cost and a
// permission story, so R6 is a LADDER, cheapest rung first:
//
//   1. the linkback already quotes the issue body  → free, no tracker call
//   2. a bare identifier                           → one brokered read
//   3. the broker cannot answer                    → the identifier alone,
//                                                     and R7 caps what the
//                                                     review may then claim
//   4. no linkback at all                          → no intent

import type { IdentityMode } from './config.js';

export interface Linkback {
  /** The tracker identifier parsed from the PR body or branch name. */
  identifier?: string;
  /** The issue body, when the linkback comment already carries it. */
  body?: string;
}

/** Reads one tracker issue. Injected — arcade MCP in production, a stub in tests. */
export type TrackerReader = (identifier: string) => Promise<string | undefined>;

export interface IntentSource {
  kind: 'linkback-body' | 'brokered' | 'bare-identifier' | 'none';
  /** The intent text, when there is any. */
  text?: string;
}

/**
 * Whether the reviewer may read the tracker for this pull request.
 *
 * The reviewer's findings quote ticket contents into a PR comment — that is the
 * feature, not a leak in it. So while ONE shared identity does the reading, a
 * fork pull request becomes a disclosure channel: a contributor who cannot see
 * the ticket opens a PR, and the reviewer prints it for them. Gate the read
 * there and let the bare-linkback rung cover those reviews.
 *
 * Per-author brokering closes this by construction rather than by policy — the
 * reviewer reads exactly what the author could, so it can disclose nothing the
 * author did not already have.
 */
export function shouldReadTracker(context: {
  isFork: boolean;
  identityMode: IdentityMode;
}): boolean {
  return context.identityMode === 'per-author' || !context.isFork;
}

/**
 * Walk the ladder and return the best intent available.
 *
 * A broker that fails — unreachable, or an author who never authorized it, which
 * raises an OAuth interrupt CI cannot satisfy because no human is present — is
 * NOT an error. It is rung 3. The review still runs; R7 caps the certainty it
 * may claim from a thinner source.
 */
export async function resolveIntent(
  linkback: Linkback,
  tracker: TrackerReader | undefined,
): Promise<IntentSource> {
  if (linkback.body !== undefined && linkback.body.length > 0) {
    return { kind: 'linkback-body', text: linkback.body };
  }

  if (linkback.identifier === undefined || linkback.identifier.length === 0) {
    return { kind: 'none' };
  }

  if (tracker === undefined) return { kind: 'bare-identifier', text: linkback.identifier };

  let brokered: string | undefined;
  try {
    brokered = await tracker(linkback.identifier);
  } catch {
    return { kind: 'bare-identifier', text: linkback.identifier };
  }

  return brokered === undefined || brokered.length === 0
    ? { kind: 'bare-identifier', text: linkback.identifier }
    : { kind: 'brokered', text: brokered };
}
