// Safeword: stash the current Cursor conversation's transcript_path.
//
// Cursor delivers `transcript_path` only in hook payloads — never via env — so a
// user-invoked `/retro` command (which receives no payload) cannot resolve it.
// The constantly-firing Cursor hooks call this to persist the path per
// conversation, keyed like the other `/tmp/safeword-cursor-*` state files, so
// `/retro` can read the newest stash and mine THIS session's transcript
// (RTSK9C / #624).

import { writeFileSync } from 'node:fs';

import { getRunStorageKey, resolveRunIdentity } from './run-identity.js';

export const CURSOR_TRANSCRIPT_STASH_PREFIX = '/tmp/safeword-cursor-transcript-';

interface CursorTranscriptInput {
  transcript_path?: unknown;
  conversation_id?: unknown;
  generation_id?: unknown;
}

/** Compute the stash path for a Cursor hook payload (exported for tests). */
export function cursorTranscriptStashPath(input: CursorTranscriptInput): string {
  const identity = resolveRunIdentity(input, { runtime: 'cursor' });
  const key = getRunStorageKey(identity) ?? 'cursor-default';
  return `${CURSOR_TRANSCRIPT_STASH_PREFIX}${key}`;
}

/**
 * Persist `transcript_path` for this conversation if present. Best-effort: a
 * write failure must never break the gate the caller is running, so errors are
 * swallowed. No-op when the payload carries no transcript_path.
 */
export function stashCursorTranscript(input: CursorTranscriptInput): void {
  const path = typeof input.transcript_path === 'string' ? input.transcript_path.trim() : '';
  if (path.length === 0) return;

  try {
    writeFileSync(cursorTranscriptStashPath(input), path);
  } catch {
    // Best-effort stash — never block the hook.
  }
}
