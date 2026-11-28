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
  countCompletedToolUsesCodex,
  countToolUsesCodex,
  hasCompletedToolUseInCurrentCodexTurn,
  isSubstantial,
  resolveCodexSessionId,
  SUBSTANCE_THRESHOLD,
} from '../../templates/hooks/lib/retro-trigger.js';

/** A Codex rollout JSONL with the given top-level event types, one per line. */
function codexRollout(types: string[]): string {
  return types.map(type => JSON.stringify({ type, payload: {} })).join('\n');
}

// Deidentified pinned 0.160 response_item shape: ids differ, call_id joins
// the pair, and the turn tag is nested metadata, with no user_message.
function customEvent(type: string, call = 'current-call', turn = 'current'): string {
  return JSON.stringify({
    type: 'response_item',
    payload: {
      type,
      call_id: call,
      id: `${type}-${call}`,
      internal_chat_message_metadata_passthrough: { turn_id: turn },
    },
  });
}

describe('native Codex custom tool pairs', () => {
  it('recognizes completed current work without a user-message boundary', () => {
    const rollout = [customEvent('custom_tool_call'), customEvent('custom_tool_call_output')].join(
      '\n',
    );
    expect(countToolUsesCodex(rollout)).toBe(1);
    expect(countCompletedToolUsesCodex(rollout)).toBe(1);
    expect(hasCompletedToolUseInCurrentCodexTurn(rollout, 'current')).toBe(true);
    expect(hasCompletedToolUseInCurrentCodexTurn(rollout)).toBe(false);
  });

  it.each([
    ['incomplete', [customEvent('custom_tool_call')]],
    ['orphan result', [customEvent('custom_tool_call_output')]],
    [
      'mismatched call',
      [customEvent('custom_tool_call'), customEvent('custom_tool_call_output', 'other')],
    ],
    ['cross-kind', [customEvent('custom_tool_call'), customEvent('function_call_output')]],
    [
      'cross-turn',
      [
        customEvent('custom_tool_call', 'current-call', 'old'),
        customEvent('custom_tool_call_output'),
      ],
    ],
    [
      'stale completed pair',
      [
        customEvent('custom_tool_call', 'old-call', 'old'),
        customEvent('custom_tool_call_output', 'old-call', 'old'),
      ],
    ],
    [
      'old pair plus incomplete current',
      [
        customEvent('custom_tool_call', 'old-call', 'old'),
        customEvent('custom_tool_call_output', 'old-call', 'old'),
        customEvent('custom_tool_call'),
      ],
    ],
  ])('does not borrow %s as current completed work', (_name, events) => {
    expect(hasCompletedToolUseInCurrentCodexTurn(events.join('\n'), 'current')).toBe(false);
  });

  it('preserves the latest user boundary over the tag fallback', () => {
    const rollout = [
      customEvent('custom_tool_call'),
      customEvent('custom_tool_call_output'),
      JSON.stringify({ payload: { type: 'user_message' } }),
    ].join('\n');
    expect(hasCompletedToolUseInCurrentCodexTurn(rollout, 'current')).toBe(false);
  });

  it('recognizes native metadata tags on existing function pairs too', () => {
    const rollout = [customEvent('function_call'), customEvent('function_call_output')].join('\n');
    expect(countCompletedToolUsesCodex(rollout)).toBe(1);
    expect(hasCompletedToolUseInCurrentCodexTurn(rollout, 'current')).toBe(true);
  });

  it('preserves an explicit turn tag over conflicting fallback metadata', () => {
    const rollout = ['function_call', 'function_call_output']
      .map(type => {
        const entry = JSON.parse(customEvent(type));
        entry.payload.turn_id = 'explicit';
        return JSON.stringify(entry);
      })
      .join('\n');
    expect(hasCompletedToolUseInCurrentCodexTurn(rollout, 'explicit')).toBe(true);
    expect(hasCompletedToolUseInCurrentCodexTurn(rollout, 'current')).toBe(false);
  });

  it('requires matching tool kinds even when identities match', () => {
    expect(
      countCompletedToolUsesCodex(
        [customEvent('function_call'), customEvent('custom_tool_call_output')].join('\n'),
      ),
    ).toBe(0);
    expect(
      countCompletedToolUsesCodex(
        [customEvent('custom_tool_call'), customEvent('function_call_output')].join('\n'),
      ),
    ).toBe(0);
  });

  it('uses custom work in the existing substance threshold without changing it', () => {
    const rollout = Array.from({ length: SUBSTANCE_THRESHOLD }, (_, index) =>
      customEvent('custom_tool_call', String(index)),
    ).join('\n');
    expect(isSubstantial(rollout, SUBSTANCE_THRESHOLD, countToolUsesCodex)).toBe(true);
    expect(isSubstantial(rollout, SUBSTANCE_THRESHOLD + 1, countToolUsesCodex)).toBe(false);
  });
});

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

describe('countCompletedToolUsesCodex', () => {
  it('counts matched invocation and terminal-result pairs, not raw invocations', () => {
    const events = [
      ...Array.from({ length: 4 }, (_, index) => ({
        type: 'response_item',
        payload: { type: 'function_call', call_id: `call_${index}` },
      })),
      ...Array.from({ length: 3 }, (_, index) => ({
        type: 'response_item',
        payload: { type: 'function_call_output', call_id: `call_${index}` },
      })),
    ];

    expect(countCompletedToolUsesCodex(events.map(event => JSON.stringify(event)).join('\n'))).toBe(
      3,
    );
  });
});

describe('hasCompletedToolUseInCurrentCodexTurn', () => {
  it('uses only completed tool pairs after the latest user-message boundary', () => {
    const events = [
      { payload: { type: 'function_call', call_id: 'old' } },
      { payload: { type: 'function_call_output', call_id: 'old' } },
      { payload: { type: 'user_message' } },
      { payload: { type: 'function_call', call_id: 'current' } },
      { payload: { type: 'function_call_output', call_id: 'current' } },
    ];
    expect(
      hasCompletedToolUseInCurrentCodexTurn(events.map(event => JSON.stringify(event)).join('\n')),
    ).toBe(true);
    expect(
      hasCompletedToolUseInCurrentCodexTurn(
        events
          .slice(0, 3)
          .map(event => JSON.stringify(event))
          .join('\n'),
      ),
    ).toBe(false);
  });

  it('falls back to exact turn tags without borrowing another turn', () => {
    const events = ['old', 'current'].flatMap(turn_id => [
      { type: 'function_call', call_id: turn_id, turn_id },
      { type: 'function_call_output', call_id: turn_id, turn_id },
    ]);
    const rollout = events.map(event => JSON.stringify(event)).join('\n');
    expect(hasCompletedToolUseInCurrentCodexTurn(rollout, 'current')).toBe(true);
    expect(hasCompletedToolUseInCurrentCodexTurn(rollout, 'missing')).toBe(false);
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
