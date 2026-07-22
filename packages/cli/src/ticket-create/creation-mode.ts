/**
 * Provider routing for `ticket new` (KKNFZA TB1.AC1). A pure decision over the
 * ticketBridge config + command options: provider:none (or an unsupported
 * provider — sync-tracker AC1 parity) stays on the local-id path; epics stay
 * local too (a coordination container, not off-boarded work); an otherwise
 * configured GitHub/Linear provider goes issue-first, adopting an existing key
 * when `--issue` is given, otherwise creating. No fs, no network — the caller
 * builds the identity source from this decision.
 */

import { normalizeTrackerKey } from '../tracker-sync/resolve-by-key.js';

const ISSUE_FIRST_PROVIDERS = new Set(['github', 'linear']);

export type CreationMode = { mode: 'local' } | { mode: 'create' } | { mode: 'adopt'; key: string };

export function resolveCreationMode(
  config: { provider: string },
  options: { issue?: string; type?: string },
): CreationMode {
  if (!ISSUE_FIRST_PROVIDERS.has(config.provider)) return { mode: 'local' };
  // Epics stay local even with a tracker connected: an epic is a safeword-internal
  // coordination container whose `children[]` reverse-index is over local folder
  // ids, so its identity does not off-board to the tracker (work tickets do).
  if (options.type === 'epic') return { mode: 'local' };
  // Normalize the adopted key to the SAME canonical form the create path stores
  // and the join reader looks up by ("#123" → "123") — so adopt-via-# round-trips.
  // A key that is empty after normalization (a lone "#") has nothing to adopt, so
  // fall through to create rather than key a ticket to an empty ref.
  if (options.issue !== undefined) {
    const key = normalizeTrackerKey(options.issue);
    if (key !== '') return { mode: 'adopt', key };
  }
  return { mode: 'create' };
}
