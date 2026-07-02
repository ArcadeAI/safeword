/**
 * Retro recall — delta re-arm offset state + additive cadence (ticket ZFGWS1).
 *
 * The once-per-session boolean sentinel is replaced by per-session offset state
 * `{ offset, toolUses, fires }`, and `decideRetroRun` becomes delta-aware: the
 * first fire keeps the substance gate and digests from offset 0; re-fires are
 * gated by additive growth (`REARM_GROWTH`) with a high `MAX_FIRES` backstop, and
 * each returns the `windowStart` (the previous fire's offset) so the CLI digests
 * only the new delta. State is persisted temp-write + rename (atomic), and every
 * "can't proceed" branch fails open.
 *
 * Feature: packages/cli/features/retro-recall-delta-rearm.feature
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  decideRetroRun,
  MAX_FIRES,
  type OffsetState,
  offsetStatePath,
  readOffsetState,
  REARM_GROWTH,
  SUBSTANCE_THRESHOLD,
  writeOffsetState,
} from '../../templates/hooks/lib/retro-trigger.js';

// A Claude JSONL transcript with `n` assistant tool_use content items.
function transcriptWithToolUses(n: number): string {
  const lines: string[] = [
    JSON.stringify({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: 'hi' }] },
    }),
  ];
  for (let i = 0; i < n; i++) {
    lines.push(
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: `step ${i}` },
            { type: 'tool_use', id: `tool_${i}`, name: 'Bash', input: {} },
          ],
        },
      }),
    );
  }
  return lines.join('\n');
}

describe('offset-state persistence (SM2.AC3)', () => {
  let baseDirectory: string;
  beforeEach(() => {
    baseDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-offset-'));
  });
  afterEach(() => {
    rmSync(baseDirectory, { recursive: true, force: true });
  });

  it('round-trips offset state keyed by session id', () => {
    const state: OffsetState = { offset: 1234, toolUses: 7, fires: 2 };
    writeOffsetState('sess-1', state, baseDirectory);
    expect(readOffsetState('sess-1', baseDirectory)).toEqual(state);
    // keyed by session id — a different id is independent
    expect(readOffsetState('sess-2', baseDirectory)).toBeUndefined();
  });

  it('writes atomically: temp-file then rename, never in place', () => {
    const writeFileSyncSpy = vi.fn();
    const renameSyncSpy = vi.fn();
    writeOffsetState('sess-1', { offset: 10, toolUses: 1, fires: 1 }, baseDirectory, {
      writeFileSync: writeFileSyncSpy,
      renameSync: renameSyncSpy,
    });
    const finalPath = offsetStatePath('sess-1', baseDirectory);
    // the body is written to a temp path, NOT the final path
    expect(writeFileSyncSpy).toHaveBeenCalledTimes(1);
    const writtenPath = writeFileSyncSpy.mock.calls[0]?.[0] as string;
    expect(writtenPath).not.toBe(finalPath);
    expect(writtenPath.startsWith(finalPath)).toBe(true);
    // then renamed over the final path (atomic publish)
    expect(renameSyncSpy).toHaveBeenCalledWith(writtenPath, finalPath);
  });

  it('a torn / partial state file reads as undefined, never throws (fail open)', () => {
    writeFileSync(offsetStatePath('sess-1', baseDirectory), '{"offset":123,"toolUse'); // truncated
    expect(readOffsetState('sess-1', baseDirectory)).toBeUndefined();
  });
});

describe('decideRetroRun — delta re-arm cadence (ZFGWS1)', () => {
  let baseDirectory: string;
  beforeEach(() => {
    baseDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-rearm-'));
  });
  afterEach(() => {
    rmSync(baseDirectory, { recursive: true, force: true });
  });

  const dependencies = (over: Record<string, unknown> = {}) => ({
    env: {} as Record<string, string | undefined>,
    baseDirectory,
    ...over,
  });

  it('TB1.AC2: a first Stop below the substance threshold does not fire and writes no state', () => {
    const out = decideRetroRun(
      { session_id: 'sess-1', transcript_path: '/t/s.jsonl' },
      dependencies({ readFile: () => transcriptWithToolUses(SUBSTANCE_THRESHOLD - 1) }),
    );
    expect(out).toBeUndefined();
    expect(readOffsetState('sess-1', baseDirectory)).toBeUndefined();
  });

  it('SM1.AC1: the first fire digests from offset 0 and records state (fires=1)', () => {
    const transcript = transcriptWithToolUses(SUBSTANCE_THRESHOLD + 1);
    const out = decideRetroRun(
      { session_id: 'sess-1', transcript_path: '/t/s.jsonl' },
      dependencies({ readFile: () => transcript }),
    );
    expect(out).toEqual({ transcriptPath: '/t/s.jsonl', windowStart: 0, sessionId: 'sess-1' });
    const state = readOffsetState('sess-1', baseDirectory);
    expect(state).toMatchObject({ offset: transcript.length, fires: 1 });
  });

  it('TB1.AC2: growth below the re-arm threshold holds the fire and leaves state unchanged', () => {
    const prior: OffsetState = { offset: 50, toolUses: 10, fires: 1 };
    writeOffsetState('sess-1', prior, baseDirectory);
    const out = decideRetroRun(
      { session_id: 'sess-1', transcript_path: '/t/s.jsonl' },
      dependencies({ readFile: () => transcriptWithToolUses(10 + REARM_GROWTH - 1) }),
    );
    expect(out).toBeUndefined();
    expect(readOffsetState('sess-1', baseDirectory)).toEqual(prior);
  });

  it('SM1.AC1 + TB1.AC2: growth at the re-arm threshold re-fires from the prior offset', () => {
    const prior: OffsetState = { offset: 50, toolUses: 10, fires: 1 };
    writeOffsetState('sess-1', prior, baseDirectory);
    const transcript = transcriptWithToolUses(10 + REARM_GROWTH);
    const out = decideRetroRun(
      { session_id: 'sess-1', transcript_path: '/t/s.jsonl' },
      dependencies({ readFile: () => transcript }),
    );
    expect(out).toEqual({ transcriptPath: '/t/s.jsonl', windowStart: 50, sessionId: 'sess-1' });
    expect(readOffsetState('sess-1', baseDirectory)).toMatchObject({
      offset: transcript.length,
      fires: 2,
    });
  });

  it('SM2.AC3: a later fire strictly advances the recorded offset', () => {
    const prior: OffsetState = { offset: 50, toolUses: 10, fires: 1 };
    writeOffsetState('sess-1', prior, baseDirectory);
    decideRetroRun(
      { session_id: 'sess-1', transcript_path: '/t/s.jsonl' },
      dependencies({ readFile: () => transcriptWithToolUses(10 + REARM_GROWTH) }),
    );
    const after = readOffsetState('sess-1', baseDirectory);
    expect(after?.offset).toBeGreaterThan(prior.offset);
  });

  it('TB1.AC2: the backstop holds further fires once MAX_FIRES is reached', () => {
    writeOffsetState('sess-1', { offset: 50, toolUses: 10, fires: MAX_FIRES }, baseDirectory);
    const out = decideRetroRun(
      { session_id: 'sess-1', transcript_path: '/t/s.jsonl' },
      dependencies({ readFile: () => transcriptWithToolUses(10 + REARM_GROWTH * 5) }),
    );
    expect(out).toBeUndefined();
  });

  it('TB1.AC2: a retro child never re-fires even with an armed re-fire (guard first)', () => {
    writeOffsetState('sess-1', { offset: 50, toolUses: 10, fires: 1 }, baseDirectory);
    const out = decideRetroRun(
      { session_id: 'sess-1', transcript_path: '/t/s.jsonl' },
      dependencies({
        env: { SAFEWORD_RETRO_CHILD: '1' },
        readFile: () => transcriptWithToolUses(10 + REARM_GROWTH),
      }),
    );
    expect(out).toBeUndefined();
  });

  it('TB1.AC2: a state-write failure still fires (fail open) and leaves the offset unchanged', () => {
    const prior: OffsetState = { offset: 50, toolUses: 10, fires: 1 };
    writeOffsetState('sess-1', prior, baseDirectory);
    let out: unknown;
    expect(() => {
      out = decideRetroRun(
        { session_id: 'sess-1', transcript_path: '/t/s.jsonl' },
        dependencies({
          readFile: () => transcriptWithToolUses(10 + REARM_GROWTH),
          writeOffsetState: () => {
            throw new Error('disk full');
          },
        }),
      );
    }).not.toThrow();
    expect(out).toEqual({ transcriptPath: '/t/s.jsonl', windowStart: 50, sessionId: 'sess-1' });
    // the write threw, so the persisted offset is left at its prior value
    expect(readOffsetState('sess-1', baseDirectory)).toEqual(prior);
  });

  it('SM2.AC2: no resolvable session id → no fire (nothing filed under "unknown")', () => {
    const out = decideRetroRun(
      { transcript_path: '/t/s.jsonl' },
      dependencies({ env: {}, readFile: () => transcriptWithToolUses(SUBSTANCE_THRESHOLD + 1) }),
    );
    expect(out).toBeUndefined();
  });

  it('fails open on a missing path or an unreadable transcript', () => {
    expect(decideRetroRun({ session_id: 'sess-1' }, dependencies())).toBeUndefined();
    expect(
      decideRetroRun(
        { session_id: 'sess-1', transcript_path: '/t/missing.jsonl' },
        dependencies({
          readFile: () => {
            throw new Error('ENOENT');
          },
        }),
      ),
    ).toBeUndefined();
  });
});
