import { existsSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import {
  cursorConversationStashPath,
  cursorEditedMarkerPath,
  cursorProjectStashPath,
  cursorStateKey,
  cursorTranscriptStashPath,
  stashCursorTranscript,
} from '../../templates/hooks/lib/cursor-state.js';

// Unique per test file so a real /tmp round-trip can't collide with a live session.
const CONVERSATION_ID = 'test-cursor-state-conv';
const STASH_PATH = cursorTranscriptStashPath({ conversation_id: CONVERSATION_ID });
const IDENTITY_PATH = cursorConversationStashPath({ conversation_id: CONVERSATION_ID });
const PROJECT_PATH = cursorProjectStashPath({ conversation_id: CONVERSATION_ID });
const SYMLINK_TARGET = `/tmp/safeword-cursor-state-target-${process.pid}`;

afterEach(() => {
  rmSync(STASH_PATH, { force: true });
  rmSync(IDENTITY_PATH, { force: true });
  rmSync(PROJECT_PATH, { force: true });
  rmSync(SYMLINK_TARGET, { force: true });
});

describe('cursor /tmp state keying (RTSK9C / #624)', () => {
  it('keys every state file off one shared per-conversation key', () => {
    const input = { conversation_id: CONVERSATION_ID };
    const key = cursorStateKey(input);

    // The edited marker and transcript stash must share the key so a writer and
    // reader of the same file can never drift.
    expect(cursorEditedMarkerPath(input)).toBe(`/tmp/safeword-cursor-edited-${key}`);
    expect(cursorTranscriptStashPath(input)).toBe(`/tmp/safeword-cursor-transcript-${key}`);
    expect(cursorConversationStashPath(input)).toBe(`/tmp/safeword-cursor-conversation-${key}`);
    expect(cursorProjectStashPath(input)).toBe(`/tmp/safeword-cursor-project-${key}`);
    expect(key).toBe(`cursor-${CONVERSATION_ID}`);
  });

  it('falls back to a stable default key when no conversation id is present', () => {
    expect(cursorStateKey({ transcript_path: '/x.jsonl' })).toBe('cursor-default');
  });
});

describe('stashCursorTranscript (RTSK9C / #624)', () => {
  it('round-trips transcript_path so /retro can read it back', () => {
    const transcript = '/home/user/.cursor/transcripts/abc.jsonl';
    stashCursorTranscript(
      { conversation_id: CONVERSATION_ID, transcript_path: transcript },
      '/home/user/project',
    );

    expect(readFileSync(STASH_PATH, 'utf8')).toBe(transcript);
    expect(readFileSync(IDENTITY_PATH, 'utf8')).toBe(CONVERSATION_ID);
    expect(readFileSync(PROJECT_PATH, 'utf8')).toBe('/home/user/project');
  });

  it('is a no-op when the payload carries no transcript_path', () => {
    stashCursorTranscript({ conversation_id: CONVERSATION_ID });

    expect(existsSync(STASH_PATH)).toBe(false);
  });

  it('ignores a blank transcript_path', () => {
    stashCursorTranscript({ conversation_id: CONVERSATION_ID, transcript_path: ' '.repeat(3) });

    expect(existsSync(STASH_PATH)).toBe(false);
  });

  it('does not follow a pre-created state symlink', () => {
    writeFileSync(SYMLINK_TARGET, 'do-not-overwrite');
    symlinkSync(SYMLINK_TARGET, STASH_PATH);

    stashCursorTranscript({
      conversation_id: CONVERSATION_ID,
      transcript_path: '/private/transcript.jsonl',
    });

    expect(readFileSync(SYMLINK_TARGET, 'utf8')).toBe('do-not-overwrite');
    expect(existsSync(IDENTITY_PATH)).toBe(false);
  });
});
