import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CommandInvocation } from '../../src/cli-protocol/handler.js';
import { createResult } from '../../src/cli-protocol/result.js';
import type * as CodexOperations from '../../src/codex-plugin/operations.js';
import { installLifecycle } from '../../src/lifecycle/commands.js';
import {
  createTemporaryDirectory,
  initGitRepo,
  removeTemporaryDirectory,
  TIMEOUT_QUICK,
  writeTestFile,
} from '../helpers.js';

vi.mock('../../src/claude-plugin/profile.js', () => ({
  observeClaudeProfile: () => ({}),
  claudeInstallRequiresMutation: () => true,
}));

vi.mock('../../src/claude-plugin/status.js', () => ({
  observeClaudeStatus: () => createResult({ state: 'healthy' }),
}));

vi.mock('../../src/codex-plugin/operations.js', async importOriginal => ({
  ...(await importOriginal<typeof CodexOperations>()),
  observeCodexMigrationResult: () => ({ plugin: { installed: false } }),
  codexInstallRequiresMutation: () => true,
  observeCodexMigration: () => createResult({ state: 'action_required' }),
}));

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const CODEX_PLUGIN = nodePath.join(REPO_ROOT, 'packages/cli/codex-plugin');
const CLAUDE_PLUGIN = nodePath.join(REPO_ROOT, 'plugin');
const VERSION = JSON.parse(readFileSync(nodePath.join(CODEX_PLUGIN, 'package.json'), 'utf8')) as {
  version: string;
};
const temporaryDirectories: string[] = [];

type Host = 'Claude Code' | 'OpenAI Codex' | 'Cursor';

interface ClaudeHookOutput {
  hookSpecificOutput?: {
    permissionDecision?: string;
    permissionDecisionReason?: string;
  };
}

interface CursorHookOutput {
  permission?: string;
  user_message?: string;
}

function invocation(cwd: string, agent: 'claude' | 'codex' | 'cursor'): CommandInvocation {
  return {
    cwd,
    noInput: true,
    offline: false,
    operands: [],
    options: { agents: agent, modify: false, scope: 'project' },
  };
}

function createFixture(): { claudePluginRoot: string; codexHome: string; project: string } {
  const root = createTemporaryDirectory();
  temporaryDirectories.push(root);
  const project = nodePath.join(root, 'project');
  const codexHome = nodePath.join(root, 'codex-home');
  const claudePluginRoot = nodePath.join(root, 'claude-profile/plugins/safeword');
  mkdirSync(project);
  initGitRepo(project);
  return { claudePluginRoot, codexHome, project };
}

async function installHost(
  host: Host,
  project: string,
  codexHome: string,
  claudePluginRoot: string,
): Promise<void> {
  const agent = {
    'Claude Code': 'claude',
    'OpenAI Codex': 'codex',
    Cursor: 'cursor',
  }[host] as 'claude' | 'codex' | 'cursor';
  const pluginRoot = nodePath.join(codexHome, 'plugins/cache/safeword/safeword', VERSION.version);
  const adapters = {
    installClaude: () => {
      mkdirSync(nodePath.dirname(claudePluginRoot), { recursive: true });
      cpSync(CLAUDE_PLUGIN, claudePluginRoot, { recursive: true, force: true });
      return Promise.resolve(createResult({ state: 'changed' }));
    },
    installCodex: () => {
      mkdirSync(nodePath.dirname(pluginRoot), { recursive: true });
      cpSync(CODEX_PLUGIN, pluginRoot, { recursive: true, force: true });
      return Promise.resolve(createResult({ state: 'changed' }));
    },
  };

  const fresh = await installLifecycle(invocation(project, agent), adapters);
  expect(fresh.errors).toEqual([]);
}

function writeUnfinishedTicket(project: string, host: Host): void {
  writeTestFile(
    project,
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
  const stateFile = {
    'Claude Code': 'quality-state-install-proof.json',
    'OpenAI Codex': 'quality-state-codex-install-proof.json',
    Cursor: 'quality-state-cursor-install-proof.json',
  }[host];
  writeTestFile(
    project,
    nodePath.join('.project', stateFile),
    JSON.stringify({ activeTicket: 'PY73VN' }),
  );
  const commit = spawnSync('git', ['add', '.'], { cwd: project });
  expect(commit.status, commit.stderr.toString()).toBe(0);
  const committed = spawnSync('git', ['commit', '--no-verify', '-m', 'fixture'], { cwd: project });
  expect(committed.status, committed.stderr.toString()).toBe(0);
}

function runInstalledReadyHook(
  host: Host,
  project: string,
  codexHome: string,
  claudePluginRoot: string,
): ClaudeHookOutput | CursorHookOutput {
  const environment = {
    ...process.env,
    CLAUDE_PROJECT_DIR: project,
    CLAUDE_PLUGIN_ROOT: claudePluginRoot,
    CODEX_HOME: codexHome,
    // Codex's plugin-hook protocol renders denials as JSON for the host adapter.
    SAFEWORD_CODEX_DENY_MODE: 'json',
  };
  let command: string[];
  let input: object;

  if (host === 'OpenAI Codex') {
    const pluginRoot = nodePath.join(codexHome, 'plugins/cache/safeword/safeword', VERSION.version);
    const manifest = JSON.parse(readFileSync(nodePath.join(pluginRoot, 'hooks.json'), 'utf8')) as {
      hooks: { PreToolUse: { hooks: { command: string }[] }[] };
    };
    expect(manifest.hooks.PreToolUse[0]?.hooks[0]?.command).toContain(
      'runtime/cli.js" hook codex pre-tool-use --plugin-hook',
    );
    command = [
      nodePath.join(pluginRoot, 'runtime/cli.js'),
      'hook',
      'codex',
      'pre-tool-use',
      '--plugin-hook',
    ];
    input = {
      session_id: 'install-proof',
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'gh pr ready' },
    };
  } else if (host === 'Cursor') {
    const hooks = JSON.parse(
      readFileSync(nodePath.join(project, '.cursor/hooks.json'), 'utf8'),
    ) as {
      hooks: { beforeShellExecution: { command: string }[] };
    };
    expect(hooks.hooks.beforeShellExecution[0]?.command).toContain(
      '.safeword/hooks/cursor/before-shell-execution.ts',
    );
    command = [nodePath.join(project, '.safeword/hooks/cursor/before-shell-execution.ts')];
    input = {
      conversation_id: 'install-proof',
      workspace_roots: [project],
      command: 'gh pr ready',
    };
  } else {
    const hooks = JSON.parse(
      readFileSync(nodePath.join(claudePluginRoot, 'hooks/hooks.json'), 'utf8'),
    ) as {
      hooks: { PreToolUse: { matcher: string; hooks: { command: string }[] }[] };
    };
    const bashGate = hooks.hooks.PreToolUse.find(
      entry =>
        entry.matcher === 'Bash' &&
        entry.hooks.some(hook => hook.command.includes('pre-tool-quality.ts')),
    );
    expect(bashGate?.matcher).toBe('Bash');
    command = [nodePath.join(claudePluginRoot, 'runtime/hooks/pre-tool-quality.ts')];
    input = {
      session_id: 'install-proof',
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'gh pr ready' },
    };
  }

  const result = spawnSync('bun', command, {
    cwd: project,
    env: environment,
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe('');
  return result.stdout.trim() === ''
    ? {}
    : (JSON.parse(result.stdout) as ClaudeHookOutput | CursorHookOutput);
}

beforeEach(() => vi.stubEnv('SAFEWORD_SKIP_INSTALL', '1'));

afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of temporaryDirectories.splice(0)) removeTemporaryDirectory(directory);
});

describe('installed pull-request readiness gate', () => {
  const installCases = (['Claude Code', 'OpenAI Codex', 'Cursor'] as const).flatMap(host =>
    (['fresh', 'update'] as const).map(phase => ({ host, phase })),
  );

  it.each(installCases)(
    '$phase install denies Ready promotion on $host',
    async ({ host, phase }) => {
      const { claudePluginRoot, codexHome, project } = createFixture();
      await installHost(host, project, codexHome, claudePluginRoot);
      if (phase === 'update') {
        await installHost(host, project, codexHome, claudePluginRoot);
      }
      writeUnfinishedTicket(project, host);

      const output = runInstalledReadyHook(host, project, codexHome, claudePluginRoot);

      if (host === 'Cursor') {
        expect((output as CursorHookOutput).permission).toBe('deny');
        expect((output as CursorHookOutput).user_message).toContain('PY73VN');
        expect((output as CursorHookOutput).user_message).toContain(
          'complete the current scenario',
        );
      } else {
        expect((output as ClaudeHookOutput).hookSpecificOutput?.permissionDecision).toBe('deny');
        expect((output as ClaudeHookOutput).hookSpecificOutput?.permissionDecisionReason).toContain(
          'PY73VN',
        );
        expect((output as ClaudeHookOutput).hookSpecificOutput?.permissionDecisionReason).toContain(
          'complete the current scenario',
        );
      }
    },
  );
});
