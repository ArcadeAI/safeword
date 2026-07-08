import { describe, expect, it } from 'vitest';

import {
  type ClaudeGateResult,
  decideFromGate,
  GATE_UNAVAILABLE_REASON,
  requiresFailClosedShellGate,
} from '../templates/hooks/cursor/gate-adapter';

const unavailableGate: ClaudeGateResult = {
  failed: true,
  stdout: '',
  timedOut: false,
};

function cleanGateWithOutput(stdout: string): ClaudeGateResult {
  return {
    failed: false,
    stdout,
    timedOut: false,
  };
}

// The shipped decision path lives in before-shell-execution.ts: it first asks
// `requiresFailClosedShellGate` whether the command must be gated, and only spawns
// the delegated gate (then maps its result via `decideFromGate`) when it must.
// These tests pin both halves of that contract.
describe('Cursor beforeShellExecution gate', () => {
  it.each(['git status --short', 'git diff --stat', 'git log -1 --oneline', 'bun run lint'])(
    'does not fail-close %s (allowed without spawning the delegated gate)',
    command => {
      expect(requiresFailClosedShellGate({ command })).toBe(false);
    },
  );

  it.each([
    'git commit -m "save"',
    'git commit --amend',
    'git -c user.name=bot commit -m "save"',
    'git --no-pager commit -m "save"',
    'command git commit -m "save"',
    'env GIT_AUTHOR_NAME=bot git commit -m "save"',
    '/usr/bin/env git commit -m "save"',
    // git itself matched by basename — an absolute path is a real commit (HRDN42).
    '/usr/bin/git commit -m "save"',
    // `command -p git commit` runs git with the default PATH — a real commit.
    'command -p git commit -m "save"',
    // Bare leading env-assignments must not slip the gate (the env(1) wrapper is
    // optional in real shells): `VAR=val git commit …` is still a commit.
    'GIT_AUTHOR_NAME=bot git commit -m "save"',
    'GIT_EDITOR=true git commit',
    'GIT_AUTHOR_NAME=bot GIT_AUTHOR_EMAIL=bot@x command git commit -m "save"',
  ])('keeps %s fail-closed, so the delegated gate runs', command => {
    expect(requiresFailClosedShellGate({ command })).toBe(true);
    // When that gate is then unavailable, the action is denied (fail-closed).
    expect(decideFromGate(unavailableGate)).toEqual({
      permission: 'deny',
      user_message: GATE_UNAVAILABLE_REASON,
      agent_message: GATE_UNAVAILABLE_REASON,
    });
  });

  it('does not mistake other git commit-prefixed commands for git commit', () => {
    expect(requiresFailClosedShellGate({ command: 'git commit-graph write' })).toBe(false);
    expect(requiresFailClosedShellGate({ command: 'git commit-tree HEAD^{tree}' })).toBe(false);
    expect(requiresFailClosedShellGate({ command: 'echo "git commit -m save"' })).toBe(false);
    // The env-assignment skip must not over-trigger on non-commit git subcommands.
    expect(requiresFailClosedShellGate({ command: 'GIT_PAGER=cat git status' })).toBe(false);
    // `command -v git` DESCRIBES git (a lookup), it does not run a commit — the
    // `-p`-only skip must leave `-v` in place so this stays fail-open (HRDN42).
    expect(requiresFailClosedShellGate({ command: 'command -v git' })).toBe(false);
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

    expect(decideFromGate(deniedGate)).toEqual({
      permission: 'deny',
      user_message: denialReason,
      agent_message: denialReason,
    });
  });
});
