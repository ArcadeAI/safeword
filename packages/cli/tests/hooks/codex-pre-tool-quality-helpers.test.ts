import { describe, expect, it } from 'vitest';

import {
  denialReasonFromHookOutput,
  translateCodexInputToClaudeInputs,
} from '../../templates/hooks/codex/pre-tool-quality-helpers.js';

describe('Codex pre-tool quality helpers (W0E292)', () => {
  it('translates apply_patch targets into Claude-shaped edit inputs', () => {
    const translated = translateCodexInputToClaudeInputs({
      session_id: 'session-123',
      tool_name: 'apply_patch',
      tool_input: {
        command: [
          '*** Begin Patch',
          '*** Add File: notes.md',
          '+# Notes',
          '+Body',
          '*** Update File: existing.md',
          '@@',
          '-old',
          '+new',
          '*** End Patch',
        ].join('\n'),
      },
    });

    expect(translated).toEqual([
      {
        session_id: 'session-123',
        hook_event_name: 'PreToolUse',
        tool_name: 'Write',
        tool_input: {
          file_path: 'notes.md',
          content: '# Notes\nBody',
        },
      },
      {
        session_id: 'session-123',
        hook_event_name: 'PreToolUse',
        tool_name: 'Edit',
        tool_input: {
          file_path: 'existing.md',
        },
      },
    ]);
  });

  it('forwards direct Codex tools without changing the tool input', () => {
    const translated = translateCodexInputToClaudeInputs({
      session_id: 'session-abc',
      tool_name: 'MultiEdit',
      tool_input: {
        file_path: 'src/example.ts',
        edits: [{ old_string: 'old', new_string: 'new' }],
      },
    });

    expect(translated).toEqual([
      {
        session_id: 'session-abc',
        hook_event_name: 'PreToolUse',
        tool_name: 'MultiEdit',
        tool_input: {
          file_path: 'src/example.ts',
          edits: [{ old_string: 'old', new_string: 'new' }],
        },
      },
    ]);
  });

  it('ignores unsupported Codex tool inputs', () => {
    expect(
      translateCodexInputToClaudeInputs({
        tool_name: 'web_search',
        tool_input: { command: 'query' },
      }),
    ).toEqual([]);
  });

  it('extracts deny reasons from Claude hook JSON output', () => {
    const reason = denialReasonFromHookOutput(
      JSON.stringify({
        hookSpecificOutput: {
          permissionDecision: 'deny',
          permissionDecisionReason: 'Write test definitions first.',
        },
      }),
    );

    expect(reason).toBe('Write test definitions first.');
  });

  it('uses a stable fallback when deny output omits a string reason', () => {
    const reason = denialReasonFromHookOutput(
      JSON.stringify({
        hookSpecificOutput: {
          permissionDecision: 'deny',
          permissionDecisionReason: 42,
        },
      }),
    );

    expect(reason).toBe('Safeword denied this action.');
  });

  it('ignores non-deny and malformed hook output', () => {
    expect(
      denialReasonFromHookOutput(
        JSON.stringify({
          hookSpecificOutput: {
            permissionDecision: 'allow',
          },
        }),
      ),
    ).toBeUndefined();
    expect(denialReasonFromHookOutput('not json')).toBeUndefined();
    expect(denialReasonFromHookOutput('')).toBeUndefined();
  });
});
