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
