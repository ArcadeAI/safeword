/** Integration proof for the local Ready boundary (ticket PY73VN). */

import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';
import process from 'node:process';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  initGitRepo,
  removeTemporaryDirectory,
  TIMEOUT_QUICK,
  writeTestFile,
} from '../helpers.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const PRE_TOOL_QUALITY = nodePath.join(
  REPO_ROOT,
  'packages/cli/templates/hooks/pre-tool-quality.ts',
);
const CODEX_PRE_TOOL_QUALITY = nodePath.join(
  REPO_ROOT,
  'packages/cli/templates/hooks/codex/pre-tool-quality.ts',
);
const CURSOR_BEFORE_SHELL = nodePath.join(
  REPO_ROOT,
  'packages/cli/templates/hooks/cursor/before-shell-execution.ts',
);
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) removeTemporaryDirectory(directory);
});

function unfinishedProject(): string {
  const directory = createTemporaryDirectory();
  temporaryDirectories.push(directory);
  initGitRepo(directory);
  writeTestFile(directory, '.safeword/version', '0.83.1\n');
  writeTestFile(
    directory,
    '.project/tickets/PY73VN-finish-delivery-before-pr-readiness/ticket.md',
    [
      '---',
      'id: PY73VN',
      'slug: finish-delivery-before-pr-readiness',
      'type: feature',
      'phase: implement',
      'status: in_progress',
      '---',
      '',
      '# Finish accepted changes before asking for PR review',
    ].join('\n'),
  );
  writeTestFile(
    directory,
    '.project/quality-state-claude-test.json',
    JSON.stringify({ activeTicket: 'PY73VN' }),
  );
  writeTestFile(
    directory,
    '.project/quality-state-codex-codex-test.json',
    JSON.stringify({ activeTicket: 'PY73VN' }),
  );
  writeTestFile(
    directory,
    '.project/quality-state-cursor-cursor-test.json',
    JSON.stringify({ activeTicket: 'PY73VN' }),
  );
  return directory;
}

interface ClaudeHookOutput {
  hookSpecificOutput?: {
    hookEventName?: string;
    permissionDecision?: string;
    permissionDecisionReason?: string;
  };
}

interface CursorHookOutput {
  permission?: string;
  user_message?: string;
}

type Host = 'Claude Code' | 'OpenAI Codex' | 'Cursor';
const HOST_HOOKS: Record<Host, string> = {
  'Claude Code': PRE_TOOL_QUALITY,
  'OpenAI Codex': CODEX_PRE_TOOL_QUALITY,
  Cursor: CURSOR_BEFORE_SHELL,
};

function runHostShellHook(
  host: Host,
  directory: string,
  command: string,
): ClaudeHookOutput | CursorHookOutput {
  const hook = HOST_HOOKS[host];
  const input =
    host === 'Cursor'
      ? {
          conversation_id: 'cursor-test',
          workspace_roots: [directory],
          command,
        }
      : {
          session_id: host === 'Claude Code' ? 'claude-test' : 'codex-test',
          hook_event_name: 'PreToolUse',
          tool_name: 'Bash',
          tool_input: { command },
        };
  const result = spawnSync('bun', [hook], {
    cwd: directory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  return result.stdout.trim() === ''
    ? {}
    : (JSON.parse(result.stdout) as ClaudeHookOutput | CursorHookOutput);
}

describe('pull-request readiness delivery gate', () => {
  it.each<Host>(['Claude Code', 'OpenAI Codex', 'Cursor'])(
    'denies ready-by-default creation before verified done on %s',
    host => {
      const output = runHostShellHook(host, unfinishedProject(), 'gh pr create --fill');
      if (host === 'Cursor') {
        const decision = output as CursorHookOutput;
        expect(decision.permission).toBe('deny');
        expect(decision.user_message).toContain('not finished');
        expect(decision.user_message).toContain('PY73VN');
        expect(decision.user_message).toContain('implementation');
        expect(decision.user_message).toContain('complete the current scenario');
        return;
      }

      const decision = (output as ClaudeHookOutput).hookSpecificOutput;
      expect(decision?.hookEventName).toBe('PreToolUse');
      expect(decision?.permissionDecision).toBe('deny');
      expect(decision?.permissionDecisionReason).toContain('not finished');
      expect(decision?.permissionDecisionReason).toContain('PY73VN');
      expect(decision?.permissionDecisionReason).toContain('implementation');
      expect(decision?.permissionDecisionReason).toContain('complete the current scenario');
    },
  );

  it.each<Host>(['Claude Code', 'OpenAI Codex', 'Cursor'])(
    'allows Draft creation for evidence on %s',
    host => {
      const output = runHostShellHook(host, unfinishedProject(), 'gh pr create --draft --fill');
      if (host === 'Cursor') {
        expect((output as CursorHookOutput).permission).toBe('allow');
      } else {
        expect((output as ClaudeHookOutput).hookSpecificOutput?.permissionDecision).not.toBe(
          'deny',
        );
      }
    },
  );
});
