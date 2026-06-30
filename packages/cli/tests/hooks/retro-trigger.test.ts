/**
 * Retro auto-trigger core (ticket FTCQGD).
 *
 * The shared substance-gate + session-id resolver + sentinel + nudge-assembly
 * that the Claude stop-retro hook (and later the Codex/Cursor adapters, 53DQJZ /
 * KHYXY4) wrap. Pure-logic units here; the hook wiring is an integration test.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildRetroNudge,
  countToolUses,
  decideRetroNudge,
  hasNudged,
  isSubstantial,
  markNudged,
  resolveSessionId,
  SUBSTANCE_THRESHOLD,
} from '../../templates/hooks/lib/retro-trigger.js';

// Shared injected-deps factory for the decideRetro* orchestration suites (the
// gates are identical; only the return shape differs between nudge and run).
const dependenciesFactory =
  (getBaseDirectory: () => string, transcript: string) =>
  (over: Record<string, unknown> = {}) => ({
    env: {},
    readFile: () => transcript,
    baseDirectory: getBaseDirectory(), // lazy: baseDirectory is set in beforeEach
    ...over,
  });

// A Claude JSONL transcript with `n` assistant tool_use content items, matching
// the shape stop-reentry.ts parses: one entry per line, `type` + message.content.
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

describe('countToolUses', () => {
  it('counts tool_use content items across assistant entries', () => {
    expect(countToolUses(transcriptWithToolUses(0))).toBe(0);
    expect(countToolUses(transcriptWithToolUses(4))).toBe(4);
  });

  it('ignores malformed JSONL lines instead of throwing', () => {
    const text = `not json\n${transcriptWithToolUses(2)}\n{ broken`;
    expect(countToolUses(text)).toBe(2);
  });

  it('counts no tool uses in an empty transcript', () => {
    expect(countToolUses('')).toBe(0);
  });
});

describe('isSubstantial (inclusive >= boundary)', () => {
  it('judges a transcript below the threshold not substantial', () => {
    expect(isSubstantial(transcriptWithToolUses(SUBSTANCE_THRESHOLD - 1))).toBe(false);
  });

  it('judges a transcript exactly at the threshold substantial (inclusive)', () => {
    expect(isSubstantial(transcriptWithToolUses(SUBSTANCE_THRESHOLD))).toBe(true);
  });

  it('judges a transcript above the threshold substantial', () => {
    expect(isSubstantial(transcriptWithToolUses(SUBSTANCE_THRESHOLD + 5))).toBe(true);
  });
});

describe('resolveSessionId (precedence: input > cloud > local)', () => {
  it('prefers the hook input session_id when all three are present', () => {
    expect(
      resolveSessionId(
        { session_id: 'sess-in' },
        { CLAUDE_CODE_REMOTE_SESSION_ID: 'sess-cl', CLAUDE_SESSION_ID: 'sess-lo' },
      ),
    ).toBe('sess-in');
  });

  it('falls back to the cloud session id when the input omits it', () => {
    expect(
      resolveSessionId(
        {},
        { CLAUDE_CODE_REMOTE_SESSION_ID: 'sess-cl', CLAUDE_SESSION_ID: 'sess-lo' },
      ),
    ).toBe('sess-cl');
  });

  it('falls back to the local session id when input and cloud are absent', () => {
    expect(resolveSessionId({}, { CLAUDE_SESSION_ID: 'sess-lo' })).toBe('sess-lo');
  });

  it('returns undefined when no session id can be resolved', () => {
    expect(resolveSessionId({}, {})).toBeUndefined();
  });
});

describe('once-per-session sentinel (keyed by session id)', () => {
  let baseDirectory: string;
  beforeEach(() => {
    baseDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-sentinel-'));
  });
  afterEach(() => {
    rmSync(baseDirectory, { recursive: true, force: true });
  });

  it('reports not-nudged before the sentinel is set', () => {
    expect(hasNudged('sess-1', baseDirectory)).toBe(false);
  });

  it('reports nudged after markNudged for the same session id', () => {
    markNudged('sess-1', baseDirectory);
    expect(hasNudged('sess-1', baseDirectory)).toBe(true);
  });

  it('keys the sentinel by session id — a different id is independent', () => {
    markNudged('sess-1', baseDirectory);
    expect(hasNudged('sess-2', baseDirectory)).toBe(false);
  });

  it('sanitizes a session id with path separators so it stays inside baseDirectory', () => {
    markNudged('../../etc/passwd', baseDirectory);
    // The marker must live in baseDirectory, not escape it; hasNudged round-trips the
    // same sanitization so the value is still observable.
    expect(hasNudged('../../etc/passwd', baseDirectory)).toBe(true);
  });
});

describe('decideRetroNudge (orchestration)', () => {
  let baseDirectory: string;
  const substantial = transcriptWithToolUses(SUBSTANCE_THRESHOLD + 2);
  const trivial = transcriptWithToolUses(SUBSTANCE_THRESHOLD - 1);

  beforeEach(() => {
    baseDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-decide-'));
  });
  afterEach(() => {
    rmSync(baseDirectory, { recursive: true, force: true });
  });

  const dependencies = dependenciesFactory(() => baseDirectory, substantial);

  it('SM1.AC1: a substantial unnudged session returns a nudge with path + guide and sets the sentinel', () => {
    const out = decideRetroNudge(
      { session_id: 'sess-1', transcript_path: '/t/sess-1.jsonl' },
      dependencies(),
    );
    expect(out).toBeDefined();
    expect(out).toContain('/t/sess-1.jsonl');
    expect(out?.toLowerCase()).toContain('guide');
    expect(hasNudged('sess-1', baseDirectory)).toBe(true);
  });

  it('SM1.AC2: a trivial session returns nothing and leaves the sentinel unset', () => {
    const out = decideRetroNudge(
      { session_id: 'sess-1', transcript_path: '/t/sess-1.jsonl' },
      dependencies({ readFile: () => trivial }),
    );
    expect(out).toBeUndefined();
    expect(hasNudged('sess-1', baseDirectory)).toBe(false);
  });

  it('SM1.AC3: a second call for an already-nudged session returns nothing', () => {
    markNudged('sess-1', baseDirectory);
    const out = decideRetroNudge(
      { session_id: 'sess-1', transcript_path: '/t/sess-1.jsonl' },
      dependencies(),
    );
    expect(out).toBeUndefined();
  });

  it('SM1.AC3: a different session id still nudges (sentinel is per-session)', () => {
    markNudged('sess-1', baseDirectory);
    const out = decideRetroNudge(
      { session_id: 'sess-2', transcript_path: '/t/sess-2.jsonl' },
      dependencies(),
    );
    expect(out).toBeDefined();
  });

  it('SM1.AC4: resolves the session id from the cloud env when input omits it', () => {
    decideRetroNudge(
      { transcript_path: '/t/x.jsonl' },
      dependencies({ env: { CLAUDE_CODE_REMOTE_SESSION_ID: 'cloud-9' } }),
    );
    expect(hasNudged('cloud-9', baseDirectory)).toBe(true);
  });

  it('TB1.AC2: no resolvable session id → no nudge', () => {
    const out = decideRetroNudge({ transcript_path: '/t/x.jsonl' }, dependencies({ env: {} }));
    expect(out).toBeUndefined();
  });

  it('TB1.AC2: missing transcript_path → no nudge, sentinel unset', () => {
    const out = decideRetroNudge({ session_id: 'sess-1' }, dependencies());
    expect(out).toBeUndefined();
    expect(hasNudged('sess-1', baseDirectory)).toBe(false);
  });

  it('TB1.AC2: an unreadable transcript → no nudge, sentinel unset (fail open)', () => {
    const out = decideRetroNudge(
      { session_id: 'sess-1', transcript_path: '/t/missing.jsonl' },
      dependencies({
        readFile: () => {
          throw new Error('ENOENT');
        },
      }),
    );
    expect(out).toBeUndefined();
    expect(hasNudged('sess-1', baseDirectory)).toBe(false);
  });
});

// decideRetroRun's invisible-trigger behavior moved to delta re-arm (ZFGWS1) and
// is covered in tests/hooks/retro-delta-rearm.test.ts (offset state + additive
// cadence). The fire-once sentinel assertions that lived here are superseded.

describe('buildRetroNudge', () => {
  it('contains the supplied transcript path and points at the retro guide', () => {
    const nudge = buildRetroNudge('/tmp/session-abc.jsonl');
    expect(nudge).toContain('/tmp/session-abc.jsonl');
    expect(nudge).toContain('retro');
    expect(nudge.toLowerCase()).toContain('guide');
  });

  it('contains no imperative command to the agent (fact-phrased, like self-report)', () => {
    const nudge = buildRetroNudge('/tmp/session-abc.jsonl');
    // Fact phrasing must not open with a bare imperative verb that prompt-injection
    // defenses would surface verbatim. Assert it reads as a statement, not a command.
    expect(/^\s*(?:run|file|please|you must|do |execute|invoke)\b/i.test(nudge)).toBe(false);
  });
});
