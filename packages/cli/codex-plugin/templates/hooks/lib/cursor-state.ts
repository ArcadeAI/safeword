// Safeword: per-conversation Cursor /tmp state paths + shared keying.
//
// Cursor hooks persist a little per-conversation state under /tmp so later-firing
// hooks — and the user-invoked `/retro` command, which receives no payload — can
// pick it up:
//   - the *edited* marker: after-file-edit writes it, stop reads it, to know the
//     session made edits;
//   - the *shell cwd* stash: beforeShellExecution writes the directory a shell
//     command runs in, postToolUse reads it, because Cursor's postToolUse payload
//     carries no cwd and the gates must root at the worktree the shell is in;
//   - the *transcript* stash: Cursor delivers transcript_path only in hook
//     payloads (never env), so the constantly-firing hooks stash it for `/retro`
//     to resolve THIS session's transcript (RTSK9C / #624).
//
// Every file shares one key (the run-storage key, with a stable fallback) so the
// writer and reader of a given file can never drift.

import { closeSync, constants, fchmodSync, openSync, readFileSync, writeFileSync } from 'node:fs';

import { getRunStorageKey, resolveRunIdentity } from './run-identity.js';

const CURSOR_STATE_FALLBACK_KEY = 'cursor-default';
const CURSOR_EDITED_MARKER_PREFIX = '/tmp/safeword-cursor-edited-';
const CURSOR_IDENTITY_STASH_PREFIX = '/tmp/safeword-cursor-conversation-';
const CURSOR_PROJECT_STASH_PREFIX = '/tmp/safeword-cursor-project-';
const CURSOR_TRANSCRIPT_STASH_PREFIX = '/tmp/safeword-cursor-transcript-';
const CURSOR_SHELL_CWD_STASH_PREFIX = '/tmp/safeword-cursor-shell-cwd-';

interface CursorStateInput {
  transcript_path?: unknown;
  conversation_id?: unknown;
  generation_id?: unknown;
}

/** The per-conversation key shared by every Cursor /tmp state file. */
export function cursorStateKey(input: CursorStateInput): string {
  const identity = resolveRunIdentity(input, { runtime: 'cursor' });
  return getRunStorageKey(identity) ?? CURSOR_STATE_FALLBACK_KEY;
}

/** Path of the marker after-file-edit writes and stop reads to detect edits. */
export function cursorEditedMarkerPath(input: CursorStateInput): string {
  return `${CURSOR_EDITED_MARKER_PREFIX}${cursorStateKey(input)}`;
}

/** Path of the transcript stash `/retro` reads to resolve the session transcript. */
export function cursorTranscriptStashPath(input: CursorStateInput): string {
  return `${CURSOR_TRANSCRIPT_STASH_PREFIX}${cursorStateKey(input)}`;
}

/** Path of the conversation-id stash paired with the transcript stash. */
export function cursorConversationStashPath(input: CursorStateInput): string {
  return `${CURSOR_IDENTITY_STASH_PREFIX}${cursorStateKey(input)}`;
}

/** Path of the project-directory stash paired with the transcript stash. */
export function cursorProjectStashPath(input: CursorStateInput): string {
  return `${CURSOR_PROJECT_STASH_PREFIX}${cursorStateKey(input)}`;
}

/** Path of the stash holding the directory this conversation's last shell ran in. */
export function cursorShellCwdStashPath(input: CursorStateInput): string {
  return `${CURSOR_SHELL_CWD_STASH_PREFIX}${cursorStateKey(input)}`;
}

/** Remember where this conversation's shell command runs. Best-effort, like every stash. */
export function stashCursorShellCwd(input: CursorStateInput & { cwd?: unknown }): void {
  const cwd = typeof input.cwd === 'string' ? input.cwd.trim() : '';
  if (cwd.length === 0) return;
  try {
    writePrivateState(cursorShellCwdStashPath(input), cwd);
  } catch {
    // Best-effort stash — never block the hook.
  }
}

/** The directory this conversation's last shell command ran in, if one was stashed. */
export function readCursorShellCwd(input: CursorStateInput): string | undefined {
  try {
    const cwd = readFileSync(cursorShellCwdStashPath(input), 'utf8').trim();
    return cwd.length > 0 ? cwd : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Persist `transcript_path` for this conversation if present. Best-effort: a
 * write failure must never break the gate the caller is running, so errors are
 * swallowed. No-op when the payload carries no transcript_path.
 */
export function stashCursorTranscript(
  input: CursorStateInput,
  projectDirectory = process.cwd(),
): void {
  const path = typeof input.transcript_path === 'string' ? input.transcript_path.trim() : '';
  if (path.length === 0) return;
  const conversationId =
    typeof input.conversation_id === 'string' ? input.conversation_id.trim() : '';

  try {
    writePrivateState(cursorTranscriptStashPath(input), path);
    if (conversationId !== '') {
      writePrivateState(cursorConversationStashPath(input), conversationId);
      writePrivateState(cursorProjectStashPath(input), projectDirectory);
    }
  } catch {
    // Best-effort stash — never block the hook.
  }
}

function writePrivateState(path: string, value: string): void {
  const descriptor = openSync(
    path,
    constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    fchmodSync(descriptor, 0o600);
    writeFileSync(descriptor, value);
  } finally {
    closeSync(descriptor);
  }
}
