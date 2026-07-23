/**
 * Unit tests for the write-review-stamp run-identity bridge (#630) —
 * command recognition and the per-runtime stash/read round-trip.
 *
 * The recognizer must accept BOTH documented command forms: the
 * `$PROJECT_DIR`-absolute form (self-review's fallback) and the bare-relative
 * form (`bun .safeword/hooks/write-review-stamp.ts …`, used by the skip valve
 * and the Tier-2 phase stamp) — the record-skill-invocation matcher's
 * slash-anchored suffix alone would miss the latter.
 */

import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  commandInvokesWriteReviewStamp,
  parseRecordSkillInvocationCommand,
  readFreshCodexReviewStampIdentity,
  readFreshCursorReviewStampIdentity,
  rememberCodexReviewStampIdentity,
  rememberCursorReviewStampIdentity,
} from '../../templates/hooks/lib/cursor-run-identity.js';

const SELF_REVIEW_FALLBACK = [
  'PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}"',
  'CLAUDE_PROJECT_DIR="$PROJECT_DIR" bun "$PROJECT_DIR/.safeword/hooks/write-review-stamp.ts" spec',
].join('\n');

describe('commandInvokesWriteReviewStamp (#630)', () => {
  it('recognizes the bare-relative skip-valve form', () => {
    expect(
      commandInvokesWriteReviewStamp(
        'bun .safeword/hooks/write-review-stamp.ts spec "trivial boilerplate"',
      ),
    ).toBe(true);
  });

  it('recognizes the bare-relative Tier-2 phase form', () => {
    expect(
      commandInvokesWriteReviewStamp('bun .safeword/hooks/write-review-stamp.ts --phase implement'),
    ).toBe(true);
  });

  it('recognizes the $PROJECT_DIR-absolute self-review fallback (env assignments, quotes, newline)', () => {
    expect(commandInvokesWriteReviewStamp(SELF_REVIEW_FALLBACK)).toBe(true);
  });

  it('recognizes an expanded absolute path', () => {
    expect(
      commandInvokesWriteReviewStamp(
        'bun "/repo/checkout/.safeword/hooks/write-review-stamp.ts" spec',
      ),
    ).toBe(true);
  });

  it('recognizes execution-prefixed invocations via the shared tokenizer (EDDABK follow-up)', () => {
    // The old private tokenizer skipped only VAR=val words, so `command`/`env`
    // prefixes resolved the executable to the prefix and the stamp proof was
    // never recorded — the fail-closed stamp gate then denied a legitimate write.
    expect(
      commandInvokesWriteReviewStamp('command bun .safeword/hooks/write-review-stamp.ts spec'),
    ).toBe(true);
    expect(
      commandInvokesWriteReviewStamp(
        'env bun .safeword/hooks/write-review-stamp.ts --phase implement',
      ),
    ).toBe(true);
  });

  it('recognizes the helper in a chained command alongside the proof helper', () => {
    const chained =
      'bun ".safeword/hooks/record-skill-invocation.ts" "/repo" self-review && bun .safeword/hooks/write-review-stamp.ts spec';
    expect(commandInvokesWriteReviewStamp(chained)).toBe(true);
  });

  it('does not match a command that only mentions the helper in a string', () => {
    expect(
      commandInvokesWriteReviewStamp('echo "bun .safeword/hooks/write-review-stamp.ts spec"'),
    ).toBe(false);
  });

  it('does not match a helper-looking path that is not the helper', () => {
    expect(
      commandInvokesWriteReviewStamp('bun foo.safeword/hooks/write-review-stamp.ts spec'),
    ).toBe(false);
    expect(
      commandInvokesWriteReviewStamp('bun .safeword/hooks/write-review-stamp.ts.bak spec'),
    ).toBe(false);
  });

  it('does not match other executables', () => {
    expect(commandInvokesWriteReviewStamp('node .safeword/hooks/write-review-stamp.ts spec')).toBe(
      false,
    );
  });
});

describe('parseRecordSkillInvocationCommand (shared tokenizer, EDDABK follow-up)', () => {
  const HELPER = '/repo/.safeword/hooks/record-skill-invocation.ts';

  it('parses the supported bare-relative form', () => {
    expect(
      parseRecordSkillInvocationCommand(
        'bun .safeword/hooks/record-skill-invocation.ts /repo verify',
      ),
    ).toEqual({ skillName: 'verify' });
  });

  it('parses the plain and quoted absolute forms', () => {
    expect(parseRecordSkillInvocationCommand(`bun ${HELPER} /repo verify`)).toEqual({
      skillName: 'verify',
    });
    expect(parseRecordSkillInvocationCommand(`bun "${HELPER}" "/repo" self-review`)).toEqual({
      skillName: 'self-review',
    });
  });

  it('parses execution-prefixed invocations the old tokenizer missed', () => {
    expect(parseRecordSkillInvocationCommand(`command bun ${HELPER} /repo verify`)).toEqual({
      skillName: 'verify',
    });
    expect(parseRecordSkillInvocationCommand(`env FOO=1 bun ${HELPER} /repo audit`)).toEqual({
      skillName: 'audit',
    });
  });

  it('parses an invocation on its own line of a multi-line command', () => {
    // The old tokenizer treated newline as plain whitespace, merging both lines
    // into one segment whose executable was `echo` — a missed proof.
    expect(parseRecordSkillInvocationCommand(`echo hi\nbun ${HELPER} /repo retro`)).toEqual({
      skillName: 'retro',
    });
  });

  it('does not match the helper mentioned in a quoted string', () => {
    expect(parseRecordSkillInvocationCommand(`echo "bun ${HELPER} /repo x"`)).toBeUndefined();
  });

  it('does not match a helper-looking relative path', () => {
    expect(
      parseRecordSkillInvocationCommand(
        'bun foo.safeword/hooks/record-skill-invocation.ts /repo verify',
      ),
    ).toBeUndefined();
    expect(
      parseRecordSkillInvocationCommand(
        'bun .safeword/hooks/record-skill-invocation.ts.bak /repo verify',
      ),
    ).toBeUndefined();
  });
});

describe('review-stamp identity caches (#630)', () => {
  function project(): string {
    const dir = mkdtempSync(nodePath.join(tmpdir(), 'stamp-bridge-'));
    mkdirSync(nodePath.join(dir, '.project'), { recursive: true });
    return dir;
  }

  it('round-trips a Codex session id and consumes it on read', () => {
    const projectDirectory = project();
    expect(rememberCodexReviewStampIdentity({ projectDirectory, id: 'codex-sess' })).toBe(true);

    expect(readFreshCodexReviewStampIdentity({ projectDirectory })).toBe('codex-sess');
    // Single-use: consumed by the first read.
    expect(readFreshCodexReviewStampIdentity({ projectDirectory })).toBeUndefined();
  });

  it('keeps Codex and Cursor caches separate', () => {
    const projectDirectory = project();
    rememberCodexReviewStampIdentity({ projectDirectory, id: 'codex-sess' });
    rememberCursorReviewStampIdentity({ projectDirectory, id: 'conv-1' });

    expect(readFreshCursorReviewStampIdentity({ projectDirectory })).toBe('conv-1');
    expect(readFreshCodexReviewStampIdentity({ projectDirectory })).toBe('codex-sess');
  });

  it('expires a stale stash', () => {
    const projectDirectory = project();
    const stashedAt = new Date('2026-07-03T00:00:00.000Z');
    rememberCodexReviewStampIdentity({ projectDirectory, id: 'codex-sess', now: stashedAt });

    const sixMinutesLater = new Date('2026-07-03T00:06:00.000Z');
    expect(
      readFreshCodexReviewStampIdentity({ projectDirectory, now: sixMinutesLater }),
    ).toBeUndefined();
  });
});
