import { existsSync, readFileSync, rmSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CURSOR_TRANSCRIPT_STASH_PREFIX,
  cursorTranscriptStashPath,
  stashCursorTranscript,
} from '../../templates/hooks/lib/cursor-transcript-stash.js';

// Unique per test file so a real /tmp round-trip can't collide with a live session.
const CONVERSATION_ID = 'test-cursor-transcript-stash-conv';
const STASH_PATH = `${CURSOR_TRANSCRIPT_STASH_PREFIX}cursor-${CONVERSATION_ID}`;

afterEach(() => {
  rmSync(STASH_PATH, { force: true });
});

describe('cursor transcript stash (RTSK9C / #624)', () => {
  it('keys the stash path by the conversation id', () => {
    expect(cursorTranscriptStashPath({ conversation_id: CONVERSATION_ID })).toBe(STASH_PATH);
  });

  it('falls back to a default key when no conversation id is present', () => {
    expect(cursorTranscriptStashPath({ transcript_path: '/x.jsonl' })).toBe(
      `${CURSOR_TRANSCRIPT_STASH_PREFIX}cursor-default`,
    );
  });

  it('round-trips transcript_path so /retro can read it back', () => {
    const transcript = '/home/user/.cursor/transcripts/abc.jsonl';
    stashCursorTranscript({ conversation_id: CONVERSATION_ID, transcript_path: transcript });

    expect(readFileSync(STASH_PATH, 'utf8')).toBe(transcript);
  });

  it('is a no-op when the payload carries no transcript_path', () => {
    stashCursorTranscript({ conversation_id: CONVERSATION_ID });

    expect(existsSync(STASH_PATH)).toBe(false);
  });

  it('ignores a blank transcript_path', () => {
    stashCursorTranscript({ conversation_id: CONVERSATION_ID, transcript_path: ' '.repeat(3) });

    expect(existsSync(STASH_PATH)).toBe(false);
  });
});
