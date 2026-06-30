/**
 * Retro recall — pre-sliced delta window (ticket ZFGWS1).
 *
 * `windowFor` slices the transcript a fire should digest: the whole transcript on
 * the first fire (windowStart 0), or the delta since the previous fire's offset
 * (minus a small overlap) on a re-fire. `buildDigest`'s cap then applies to that
 * WINDOW, not the chronological head — so a finding only in the back half is read.
 *
 * Feature: packages/cli/features/retro-recall-delta-rearm.feature
 */

import { describe, expect, it } from 'vitest';

import { OVERLAP_BYTES, windowFor } from '../../templates/hooks/lib/retro-extract.js';

describe('windowFor (SM1.AC1 — delta window slice)', () => {
  const transcript = 'abcdefghijklmnopqrstuvwxyz'.repeat(500); // 13_000 chars

  it('the first fire (windowStart 0) returns the whole transcript so far', () => {
    expect(windowFor(transcript, 0)).toBe(transcript);
  });

  it('a later fire begins at the previous offset minus the overlap', () => {
    const windowStart = 8000;
    expect(windowFor(transcript, windowStart)).toBe(transcript.slice(windowStart - OVERLAP_BYTES));
  });

  it('the overlap is clamped at the start when it would underflow', () => {
    const windowStart = Math.floor(OVERLAP_BYTES / 2); // smaller than the overlap
    expect(windowFor(transcript, windowStart)).toBe(transcript);
  });
});
