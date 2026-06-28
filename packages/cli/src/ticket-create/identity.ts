/**
 * Build the identity source for issue-first `ticket new` (KKNFZA TB1.AC1) from a
 * routing decision and the tracker writer. `create` mints a new issue via the
 * writer (the network boundary — a failure here propagates so the command fails
 * loud with no orphan folder). `adopt` takes an existing key and makes NO create
 * call. The `local` mode has no identity source (the command uses the local
 * minter path) and is not handled here.
 */

import type { IssuePayload } from '../tracker-sync/types.js';
import type { TrackerWriter } from '../tracker-sync/writers.js';
import type { IdentitySource } from '../utils/ticket-writer.js';
import type { CreationMode } from './creation-mode.js';

export function buildIdentitySource(
  mode: Exclude<CreationMode, { mode: 'local' }>,
  writer: TrackerWriter,
  payload: IssuePayload,
): IdentitySource {
  if (mode.mode === 'adopt') {
    const key = mode.key;
    return () => Promise.resolve({ id: key, ref: { provider: writer.provider, id: key } });
  }
  return async () => {
    const ref = await writer.create(payload);
    return { id: ref.id, ref };
  };
}
