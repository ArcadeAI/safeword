/**
 * Cursor retro-trigger units (ticket KHYXY4).
 *
 * Cursor reuses the shared core wholesale — the Claude countToolUses (its
 * transcript is Claude-shaped) plus the sentinel and decideRetroAvailableNudge. The only
 * Cursor-specific unit is the session-id resolver (conversation_id). The adapter
 * wiring (coexistence with quality-review, followup_message) is an integration test.
 */

import { describe, expect, it } from 'vitest';

import { countToolUses, resolveCursorSessionId } from '../../templates/hooks/lib/retro-trigger.js';

describe('resolveCursorSessionId (session-stable: conversation_id)', () => {
  it('resolves the session id from conversation_id', () => {
    expect(resolveCursorSessionId({ conversation_id: 'conv-1' }, {})).toBe('conv-1');
  });

  it('returns undefined when conversation_id is absent', () => {
    expect(resolveCursorSessionId({}, {})).toBeUndefined();
  });

  it('returns undefined when conversation_id is empty', () => {
    expect(resolveCursorSessionId({ conversation_id: '' }, {})).toBeUndefined();
  });
});

describe('countToolUses on a Cursor (Claude-shaped) transcript', () => {
  // Cursor's transcript is documented as Claude-shaped: message.content[].tool_use.
  // Characterization test pinning the reuse — no Cursor-specific counter needed.
  it('counts tool_use content blocks in a Cursor transcript', () => {
    const transcript = [
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      }),
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'working' },
            { type: 'tool_use', id: 't1', name: 'edit', input: {} },
            { type: 'tool_use', id: 't2', name: 'run', input: {} },
          ],
        },
      }),
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 't3', name: 'read', input: {} }],
        },
      }),
    ].join('\n');
    expect(countToolUses(transcript)).toBe(3);
  });
});
