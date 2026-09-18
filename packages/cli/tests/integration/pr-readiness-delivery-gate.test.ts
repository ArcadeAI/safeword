/** Integration proof for the local Ready boundary (ticket PY73VN). */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
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
const POST_TOOL_QUALITY = nodePath.join(
  REPO_ROOT,
  'packages/cli/templates/hooks/post-tool-quality.ts',
);
const CODEX_POST_TOOL_QUALITY = nodePath.join(
  REPO_ROOT,
  'packages/cli/templates/hooks/codex/post-tool-quality.ts',
);
const CURSOR_POST_TOOL_QUALITY = nodePath.join(
  REPO_ROOT,
  'packages/cli/templates/hooks/cursor/post-tool-quality.ts',
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
  writeTestFile(directory, '.safeword/SAFEWORD.md', '# Safeword\n');
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
  execFileSync('git', ['add', '.'], { cwd: directory, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: directory, stdio: 'ignore' });
  return directory;
}

const TICKET_PATH = '.project/tickets/PY73VN-finish-delivery-before-pr-readiness/ticket.md';
const VERIFY_PATH = '.project/tickets/PY73VN-finish-delivery-before-pr-readiness/verify.md';
const OTHER_TICKET_PATH = '.project/tickets/OTHER-unrelated-ticket/ticket.md';
const OTHER_VERIFY_PATH = '.project/tickets/OTHER-unrelated-ticket/verify.md';

function writeTicket(directory: string, phase: string, status: string): void {
  writeTestFile(
    directory,
    TICKET_PATH,
    [
      '---',
      'id: PY73VN',
      'slug: finish-delivery-before-pr-readiness',
      'type: feature',
      `phase: ${phase}`,
      `status: ${status}`,
      '---',
      '',
      '# Finish accepted changes before asking for PR review',
    ].join('\n'),
  );
}

function commitAll(directory: string, message: string): void {
  execFileSync('git', ['add', '.'], { cwd: directory, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', message], { cwd: directory, stdio: 'ignore' });
}

function clearSessionBindings(directory: string): void {
  for (const state of [
    'quality-state-claude-test.json',
    'quality-state-codex-codex-test.json',
    'quality-state-cursor-cursor-test.json',
  ]) {
    rmSync(nodePath.join(directory, '.project', state), { force: true });
  }
}

interface ClaudeHookOutput {
  systemMessage?: string;
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
const HOST_POST_HOOKS: Record<Host, string> = {
  'Claude Code': POST_TOOL_QUALITY,
  'OpenAI Codex': CODEX_POST_TOOL_QUALITY,
  Cursor: CURSOR_POST_TOOL_QUALITY,
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
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_PROJECT_DIR: directory,
    SAFEWORD_CODEX_DENY_MODE: 'json',
  };
  delete environment.SAFEWORD_PLUGIN_CLI;
  const result = spawnSync('bun', [hook], {
    cwd: directory,
    env: environment,
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

function runHostPostTool(
  host: Host,
  directory: string,
  editedPath = TICKET_PATH,
): {
  activeTicket?: string | null;
  recentCompletedTicket?: string;
  readinessReceiptPending?: boolean;
} {
  const filePath = nodePath.join(directory, editedPath);
  const hook = HOST_POST_HOOKS[host];
  const input =
    host === 'Cursor'
      ? {
          conversation_id: 'cursor-test',
          workspace_roots: [directory],
          tool_name: 'Write',
          tool_input: { file_path: filePath },
        }
      : {
          session_id: host === 'Claude Code' ? 'claude-test' : 'codex-test',
          tool_name: 'Edit',
          tool_input: { file_path: filePath },
        };
  const result = spawnSync('bun', [hook], {
    cwd: directory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
  expect(result.status, result.stderr).toBe(0);
  const stateFile = {
    'Claude Code': 'quality-state-claude-test.json',
    'OpenAI Codex': 'quality-state-codex-codex-test.json',
    Cursor: 'quality-state-cursor-cursor-test.json',
  }[host];
  return JSON.parse(readFileSync(nodePath.join(directory, '.project', stateFile), 'utf8')) as {
    activeTicket?: string | null;
    recentCompletedTicket?: string;
    readinessReceiptPending?: boolean;
  };
}

function denialReason(host: Host, output: ClaudeHookOutput | CursorHookOutput): string {
  return host === 'Cursor'
    ? ((output as CursorHookOutput).user_message ?? '')
    : ((output as ClaudeHookOutput).hookSpecificOutput?.permissionDecisionReason ?? '');
}

function userVisibleDenial(host: Host, output: ClaudeHookOutput | CursorHookOutput): string {
  return host === 'Cursor'
    ? ((output as CursorHookOutput).user_message ?? '')
    : ((output as ClaudeHookOutput).systemMessage ?? '');
}

function expectDenied(host: Host, output: ClaudeHookOutput | CursorHookOutput): void {
  if (host === 'Cursor') {
    expect((output as CursorHookOutput).permission).toBe('deny');
    return;
  }
  expect((output as ClaudeHookOutput).hookSpecificOutput?.permissionDecision).toBe('deny');
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
    'denies Ready promotion chained after Draft creation on %s',
    host => {
      const output = runHostShellHook(
        host,
        unfinishedProject(),
        'gh pr create --draft --fill && gh pr ready',
      );

      expectDenied(host, output);
      expect(denialReason(host, output)).toContain('implementation');
      expect(denialReason(host, output)).toContain('complete the current scenario');
    },
  );

  it.each<Host>(['Claude Code', 'OpenAI Codex', 'Cursor'])(
    'denies direct Ready promotion during implementation on %s',
    host => {
      const output = runHostShellHook(host, unfinishedProject(), 'gh pr ready');

      expectDenied(host, output);
      expect(denialReason(host, output)).toContain('implementation');
      expect(denialReason(host, output)).toContain('complete the current scenario');
    },
  );

  it.each<Host>(['Claude Code', 'OpenAI Codex', 'Cursor'])(
    'gives a non-technical builder a plain visible recovery action on %s',
    host => {
      const output = runHostShellHook(host, unfinishedProject(), 'gh pr ready');

      expectDenied(host, output);
      const message = userVisibleDenial(host, output);
      expect(message).toContain('This change is not finished');
      expect(message).toContain('complete the current scenario');
      expect(message).not.toMatch(/\b(?:RED|GREEN|refactor|reconciliation|audit)\b/iu);
      expect(message).not.toContain('repair the ticket state');
    },
  );

  it.each<Host>(['Claude Code', 'OpenAI Codex', 'Cursor'])(
    'denies Ready promotion while verified closure remains open on %s',
    host => {
      const directory = unfinishedProject();
      writeTicket(directory, 'done', 'in_progress');

      const output = runHostShellHook(host, directory, 'gh pr ready');

      expectDenied(host, output);
      expect(denialReason(host, output)).toContain('ticket closure');
      expect(denialReason(host, output)).toContain('close the verified ticket');
    },
  );

  it.each<Host>(['Claude Code', 'OpenAI Codex', 'Cursor'])(
    'denies a done ticket without verification after the real auto-clear on %s',
    host => {
      const directory = unfinishedProject();
      writeTicket(directory, 'done', 'done');
      const state = runHostPostTool(host, directory);
      expect(state.activeTicket).toBeNull();

      const output = runHostShellHook(host, directory, 'gh pr ready');

      expectDenied(host, output);
      expect(denialReason(host, output)).toContain('verification evidence');
      expect(denialReason(host, output)).toContain('run verification');
    },
  );

  it.each<Host>(['Claude Code', 'OpenAI Codex', 'Cursor'])(
    'denies a done ticket when verification records failed PR scope on %s',
    host => {
      const directory = unfinishedProject();
      writeTicket(directory, 'done', 'done');
      writeTestFile(directory, VERIFY_PATH, '**PR Scope:** ❌ Piggybacked changes remain\n');
      runHostPostTool(host, directory);
      commitAll(directory, 'close ticket with failed scope');
      runHostPostTool(host, directory);

      const output = runHostShellHook(host, directory, 'gh pr ready');

      expectDenied(host, output);
      expect(denialReason(host, output)).toContain('invalid verification evidence');
      expect(denialReason(host, output)).toContain('run verification again');
    },
  );

  it.each<Host>(['Claude Code', 'OpenAI Codex', 'Cursor'])(
    'fails closed when verification evidence cannot be read on %s',
    host => {
      const directory = unfinishedProject();
      writeTicket(directory, 'done', 'done');
      writeTestFile(directory, VERIFY_PATH, '**PR Scope:** ✅ Diff matches ticket scope\n');
      runHostPostTool(host, directory);
      commitAll(directory, 'close ticket');
      runHostPostTool(host, directory);
      rmSync(nodePath.join(directory, VERIFY_PATH));
      mkdirSync(nodePath.join(directory, VERIFY_PATH));

      const output = runHostShellHook(host, directory, 'gh pr ready');

      expectDenied(host, output);
      expect(denialReason(host, output)).toContain('verification evidence cannot be read');
      expect(denialReason(host, output)).toContain('restore');
    },
  );

  it.each<Host>(['Claude Code', 'OpenAI Codex', 'Cursor'])(
    'allows Ready promotion from a fresh session at the verified done HEAD on %s',
    host => {
      const directory = unfinishedProject();
      writeTicket(directory, 'done', 'done');
      writeTestFile(directory, VERIFY_PATH, '**PR Scope:** ✅ Diff matches ticket scope\n');
      runHostPostTool(host, directory);
      commitAll(directory, 'close ticket');
      runHostPostTool(host, directory);
      clearSessionBindings(directory);

      const output = runHostShellHook(host, directory, 'gh pr ready');

      if (host === 'Cursor') {
        expect((output as CursorHookOutput).permission).toBe('allow');
      } else {
        expect(output).toEqual({});
      }
    },
  );

  it.each<Host>(['Claude Code', 'OpenAI Codex', 'Cursor'])(
    'records verified closure when the closing edit starts a fresh session on %s',
    host => {
      const directory = unfinishedProject();
      clearSessionBindings(directory);
      writeTicket(directory, 'done', 'done');
      writeTestFile(directory, VERIFY_PATH, '**PR Scope:** ✅ Diff matches ticket scope\n');
      runHostPostTool(host, directory);
      commitAll(directory, 'close ticket');
      runHostPostTool(host, directory);
      clearSessionBindings(directory);

      const output = runHostShellHook(host, directory, 'gh pr ready');

      if (host === 'Cursor') {
        expect((output as CursorHookOutput).permission).toBe('allow');
      } else {
        expect(output).toEqual({});
      }
    },
  );

  it.each<Host>(['Claude Code', 'OpenAI Codex', 'Cursor'])(
    'revokes completed-ticket readiness state when the ticket reopens on %s',
    host => {
      const directory = unfinishedProject();
      writeTicket(directory, 'done', 'done');
      writeTestFile(directory, VERIFY_PATH, '**PR Scope:** ✅ Diff matches ticket scope\n');
      const completed = runHostPostTool(host, directory);
      expect(completed.recentCompletedTicket).toBe('PY73VN');
      expect(completed.readinessReceiptPending).toBe(true);

      writeTicket(directory, 'implement', 'in_progress');
      const reopened = runHostPostTool(host, directory);

      expect(reopened.activeTicket).toBe('PY73VN');
      expect(reopened.recentCompletedTicket).toBeUndefined();
      expect(reopened.readinessReceiptPending).toBe(false);
      commitAll(directory, 'reopen ticket');
      runHostPostTool(host, directory);
      clearSessionBindings(directory);

      const output = runHostShellHook(host, directory, 'gh pr ready');
      expectDenied(host, output);
      expect(denialReason(host, output)).toContain('not finished');
    },
  );

  it.each<Host>(['Claude Code', 'OpenAI Codex', 'Cursor'])(
    'denies Ready promotion after HEAD advances beyond verified closure on %s',
    host => {
      const directory = unfinishedProject();
      writeTicket(directory, 'done', 'done');
      writeTestFile(directory, VERIFY_PATH, '**PR Scope:** ✅ Diff matches ticket scope\n');
      runHostPostTool(host, directory);
      commitAll(directory, 'close ticket');
      runHostPostTool(host, directory);
      writeTestFile(directory, 'after-verification.md', 'new bytes\n');
      commitAll(directory, 'advance head');
      runHostPostTool(host, directory, 'after-verification.md');
      clearSessionBindings(directory);

      const output = runHostShellHook(host, directory, 'gh pr ready');

      expectDenied(host, output);
      expect(denialReason(host, output)).toContain('current commit');
      expect(denialReason(host, output)).toContain('run verification again');
    },
  );

  it.each<Host>(['Claude Code', 'OpenAI Codex', 'Cursor'])(
    'allows Ready after verification refreshes the advanced HEAD without another commit on %s',
    host => {
      const directory = unfinishedProject();
      writeTicket(directory, 'done', 'done');
      writeTestFile(directory, VERIFY_PATH, '**PR Scope:** ✅ Diff matches ticket scope\n');
      runHostPostTool(host, directory);
      commitAll(directory, 'close ticket');
      runHostPostTool(host, directory);
      writeTestFile(directory, 'after-verification.md', 'new bytes\n');
      commitAll(directory, 'advance head');

      const stale = runHostShellHook(host, directory, 'gh pr ready');
      expectDenied(host, stale);

      runHostPostTool(host, directory, VERIFY_PATH);
      clearSessionBindings(directory);
      const refreshed = runHostShellHook(host, directory, 'gh pr ready');

      if (host === 'Cursor') {
        expect((refreshed as CursorHookOutput).permission).toBe('allow');
      } else {
        expect(refreshed).toEqual({});
      }
    },
  );

  it.each<Host>(['Claude Code', 'OpenAI Codex', 'Cursor'])(
    'does not refresh Ready evidence from another ticket verify artifact on %s',
    host => {
      const directory = unfinishedProject();
      writeTicket(directory, 'done', 'done');
      writeTestFile(directory, VERIFY_PATH, '**PR Scope:** ✅ Diff matches ticket scope\n');
      runHostPostTool(host, directory);
      commitAll(directory, 'close ticket');
      runHostPostTool(host, directory);
      writeTestFile(
        directory,
        OTHER_TICKET_PATH,
        ['---', 'id: OTHER', 'type: task', 'phase: done', 'status: done', '---'].join('\n'),
      );
      writeTestFile(directory, OTHER_VERIFY_PATH, '**PR Scope:** ✅ Diff matches ticket scope\n');
      commitAll(directory, 'advance head with unrelated ticket');

      runHostPostTool(host, directory, OTHER_VERIFY_PATH);
      clearSessionBindings(directory);
      const output = runHostShellHook(host, directory, 'gh pr ready');

      expectDenied(host, output);
      expect(denialReason(host, output)).toContain('current commit');
      expect(denialReason(host, output)).toContain('run verification again');
    },
  );

  it.each<Host>(['Claude Code', 'OpenAI Codex', 'Cursor'])(
    'does not refresh an older completed ticket while another ticket is active on %s',
    host => {
      const directory = unfinishedProject();
      writeTicket(directory, 'done', 'done');
      writeTestFile(directory, VERIFY_PATH, '**PR Scope:** ✅ Diff matches ticket scope\n');
      runHostPostTool(host, directory);
      commitAll(directory, 'close ticket');
      runHostPostTool(host, directory);
      const receiptPath = nodePath.join(directory, '.project/readiness-ticket.json');
      const completedReceipt = readFileSync(receiptPath, 'utf8');

      writeTestFile(
        directory,
        OTHER_TICKET_PATH,
        ['---', 'id: OTHER', 'type: task', 'phase: implement', 'status: in_progress', '---'].join(
          '\n',
        ),
      );
      commitAll(directory, 'start another ticket');
      const active = runHostPostTool(host, directory, OTHER_TICKET_PATH);
      expect(active.activeTicket).toBe('OTHER');

      runHostPostTool(host, directory, VERIFY_PATH);

      expect(readFileSync(receiptPath, 'utf8')).toBe(completedReceipt);
    },
  );

  it.each<Host>(['Claude Code', 'OpenAI Codex', 'Cursor'])(
    'asks for ticket-state repair when the active ticket cannot be parsed on %s',
    host => {
      const directory = unfinishedProject();
      writeTestFile(directory, TICKET_PATH, 'not valid ticket frontmatter\n');

      const output = runHostShellHook(host, directory, 'gh pr ready');

      expectDenied(host, output);
      expect(denialReason(host, output)).toContain('repair the ticket state');
    },
  );

  it.each<Host>(['Claude Code', 'OpenAI Codex', 'Cursor'])(
    'asks for a delivery ticket when no active or completed ticket can be resolved on %s',
    host => {
      const directory = unfinishedProject();
      clearSessionBindings(directory);

      const output = runHostShellHook(host, directory, 'gh pr ready');

      expectDenied(host, output);
      expect(denialReason(host, output)).toContain('Open or resume the delivery ticket');
    },
  );

  it.each<Host>(['Claude Code', 'OpenAI Codex', 'Cursor'])(
    'allows Draft creation for evidence on %s',
    host => {
      const output = runHostShellHook(host, unfinishedProject(), 'gh pr create --draft --fill');
      if (host === 'Cursor') {
        expect((output as CursorHookOutput).permission).toBe('allow');
      } else {
        expect(output).toEqual({});
      }
    },
  );

  it.each<Host>(['Claude Code', 'OpenAI Codex', 'Cursor'])(
    'allows a chain containing only Draft-producing pull-request commands on %s',
    host => {
      const output = runHostShellHook(
        host,
        unfinishedProject(),
        'gh pr ready --undo && gh pr create --draft --fill',
      );
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
