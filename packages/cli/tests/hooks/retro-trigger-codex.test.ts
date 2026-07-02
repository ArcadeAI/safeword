/**
 * Codex variant of the retro auto-trigger core (ticket 53DQJZ).
 *
 * The Codex rollout JSONL is `{type, payload}` events, NOT Claude's
 * `message.content[].tool_use` shape — so the substance counter is Codex-specific.
 * countToolUsesCodex counts Codex tool events; the shared sentinel / resolver /
 * orchestration are reused from FTCQGD via injection seams.
 */

import { describe, expect, it } from 'vitest';

import {
  countToolUsesCodex,
  isSubstantial,
  resolveCodexSessionId,
  SUBSTANCE_THRESHOLD,
} from '../../templates/hooks/lib/retro-trigger.js';

/** A Codex rollout JSONL with the given top-level event types, one per line. */
function codexRollout(types: string[]): string {
  return types.map(type => JSON.stringify({ type, payload: {} })).join('\n');
}

describe('countToolUsesCodex', () => {
  it('counts function_call, exec_command_begin, and mcp_tool_call_begin as tool events', () => {
    expect(countToolUsesCodex(codexRollout(['function_call']))).toBe(1);
    expect(countToolUsesCodex(codexRollout(['exec_command_begin']))).toBe(1);
    expect(countToolUsesCodex(codexRollout(['mcp_tool_call_begin']))).toBe(1);
  });

  it('does not count non-tool events (reasoning, token_count, event_msg)', () => {
    expect(countToolUsesCodex(codexRollout(['agent_reasoning', 'token_count', 'event_msg']))).toBe(
      0,
    );
  });

  it('counts a mixed rollout by its tool events only', () => {
    const text = codexRollout([
      'agent_reasoning',
      'function_call',
      'token_count',
      'exec_command_begin',
      'event_msg',
    ]);
    expect(countToolUsesCodex(text)).toBe(2);
  });

  it('skips malformed lines instead of throwing', () => {
    const text = `not json\n${codexRollout(['function_call'])}\n{ broken`;
    expect(countToolUsesCodex(text)).toBe(1);
  });

  it('counts a wrapped event whose tool type is on payload.type (nesting-tolerant)', () => {
    const text = JSON.stringify({ type: 'response_item', payload: { type: 'function_call' } });
    expect(countToolUsesCodex(text)).toBe(1);
  });

  it('counts no tool uses in an empty rollout', () => {
    expect(countToolUsesCodex('')).toBe(0);
  });
});

describe('resolveCodexSessionId (session-stable: session_id > CODEX_THREAD_ID)', () => {
  it('prefers the payload session_id', () => {
    expect(resolveCodexSessionId({ session_id: 'sess-1' }, { CODEX_THREAD_ID: 'thread-1' })).toBe(
      'sess-1',
    );
  });

  it('falls back to CODEX_THREAD_ID when the payload omits session_id', () => {
    expect(resolveCodexSessionId({}, { CODEX_THREAD_ID: 'thread-1' })).toBe('thread-1');
  });

  it('never keys on turn_id (per-turn, would break once-per-session idempotency)', () => {
    expect(resolveCodexSessionId({ turn_id: 'turn-9' }, {})).toBeUndefined();
  });

  it('returns undefined when no session-stable id is present', () => {
    expect(resolveCodexSessionId({}, {})).toBeUndefined();
  });
});

describe('isSubstantial with the Codex counter (inclusive >= boundary)', () => {
  const rollout = (n: number) => codexRollout(Array.from({ length: n }, () => 'function_call'));

  it('judges one below the threshold not substantial', () => {
    expect(
      isSubstantial(rollout(SUBSTANCE_THRESHOLD - 1), SUBSTANCE_THRESHOLD, countToolUsesCodex),
    ).toBe(false);
  });

  it('judges exactly at the threshold substantial (inclusive)', () => {
    expect(
      isSubstantial(rollout(SUBSTANCE_THRESHOLD), SUBSTANCE_THRESHOLD, countToolUsesCodex),
    ).toBe(true);
  });

  it('judges above the threshold substantial', () => {
    expect(
      isSubstantial(rollout(SUBSTANCE_THRESHOLD + 3), SUBSTANCE_THRESHOLD, countToolUsesCodex),
    ).toBe(true);
  });
});
