import { describe, expect, it } from 'vitest';

import {
  type ClaudeGateResult,
  decideFromShellGate,
  GATE_UNAVAILABLE_REASON,
  requiresFailClosedShellGate,
} from '../templates/hooks/cursor/gate-adapter';

const unavailableGate: ClaudeGateResult = {
  failed: true,
  stdout: '',
};

function cleanGateWithOutput(stdout: string): ClaudeGateResult {
  return {
    failed: false,
    stdout,
  };
}

describe('Cursor beforeShellExecution gate', () => {
  it.each(['git status --short', 'git diff --stat', 'git log -1 --oneline', 'bun run lint'])(
    'allows %s when the delegated gate is unavailable',
    command => {
      expect(decideFromShellGate({ command, result: unavailableGate })).toEqual({
        permission: 'allow',
      });
    },
  );

  it.each(['git commit -m "save"', 'git commit --amend'])(
    'keeps %s fail-closed when the delegated gate is unavailable',
    command => {
      expect(requiresFailClosedShellGate(command)).toBe(true);
      expect(decideFromShellGate({ command, result: unavailableGate })).toEqual({
        permission: 'deny',
        user_message: GATE_UNAVAILABLE_REASON,
        agent_message: GATE_UNAVAILABLE_REASON,
      });
    },
  );

  it('does not mistake other git commit-prefixed commands for git commit', () => {
    expect(requiresFailClosedShellGate('git commit-graph write')).toBe(false);
    expect(requiresFailClosedShellGate('git commit-tree HEAD^{tree}')).toBe(false);
  });

  it('preserves a real denial from the delegated gate', () => {
    const denialReason = 'Shell command denied by delegated gate.';
    const deniedGate = cleanGateWithOutput(
      JSON.stringify({
        hookSpecificOutput: {
          permissionDecision: 'deny',
          permissionDecisionReason: denialReason,
        },
      }),
    );

    expect(decideFromShellGate({ command: 'git status --short', result: deniedGate })).toEqual({
      permission: 'deny',
      user_message: denialReason,
      agent_message: denialReason,
    });
  });
});
