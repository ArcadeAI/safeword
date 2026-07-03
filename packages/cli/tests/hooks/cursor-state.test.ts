import { existsSync, readFileSync, rmSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import {
  cursorEditedMarkerPath,
  cursorStateKey,
  cursorTranscriptStashPath,
  stashCursorTranscript,
} from '../../templates/hooks/lib/cursor-state.js';

// Unique per test file so a real /tmp round-trip can't collide with a live session.
const CONVERSATION_ID = 'test-cursor-state-conv';
const STASH_PATH = cursorTranscriptStashPath({ conversation_id: CONVERSATION_ID });

afterEach(() => {
  rmSync(STASH_PATH, { force: true });
});

describe('cursor /tmp state keying (RTSK9C / #624)', () => {
  it('keys every state file off one shared per-conversation key', () => {
    const input = { conversation_id: CONVERSATION_ID };
    const key = cursorStateKey(input);

    // The edited marker and transcript stash must share the key so a writer and
    // reader of the same file can never drift.
    expect(cursorEditedMarkerPath(input)).toBe(`/tmp/safeword-cursor-edited-${key}`);
    expect(cursorTranscriptStashPath(input)).toBe(`/tmp/safeword-cursor-transcript-${key}`);
    expect(key).toBe(`cursor-${CONVERSATION_ID}`);
  });

  it('falls back to a stable default key when no conversation id is present', () => {
    expect(cursorStateKey({ transcript_path: '/x.jsonl' })).toBe('cursor-default');
  });
});

describe('stashCursorTranscript (RTSK9C / #624)', () => {
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
