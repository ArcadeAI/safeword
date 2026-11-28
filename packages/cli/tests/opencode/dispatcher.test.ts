import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { installOpenCodeProfile, openCodeProfilePaths } from '../../src/opencode/profile.js';
import { getTemplatesDirectory } from '../../src/utils/fs.js';
import { createTemporaryDirectory, removeTemporaryDirectory, runCli } from '../helpers.js';

const temporaryDirectories: string[] = [];
const dispatcherPath = nodePath.resolve(import.meta.dirname, '../../dist/opencode/dispatcher.js');

function markedProject(): string {
  const project = createTemporaryDirectory();
  temporaryDirectories.push(project);
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(project, '.safeword', 'SAFEWORD.md'), '# enrolled\n');
  cpSync(
    nodePath.join(getTemplatesDirectory(), 'hooks'),
    nodePath.join(project, '.safeword', 'hooks'),
    { recursive: true },
  );
  return project;
}

afterEach(() => {
  for (const directory of temporaryDirectories) removeTemporaryDirectory(directory);
  temporaryDirectories.length = 0;
});

describe('packaged OpenCode dispatcher', () => {
  it('runs after being copied without sibling build chunks or node_modules', () => {
    const project = markedProject();
    const isolated = createTemporaryDirectory();
    temporaryDirectories.push(isolated);
    const copiedDispatcher = nodePath.join(isolated, 'dispatcher.mjs');
    copyFileSync(dispatcherPath, copiedDispatcher);

    const result = spawnSync(process.execPath, [copiedDispatcher], {
      cwd: project,
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: project,
        SAFEWORD_AGENT_RUNTIME: 'opencode',
        SAFEWORD_CODEX_DENY_MODE: 'exit-code',
      },
      input: JSON.stringify({
        hook_event_name: 'PreToolUse',
        session_id: 'opencode-session',
        tool_name: 'Bash',
        tool_input: { command: 'printf safe' },
      }),
      encoding: 'utf8',
    });

    expect(result.status, result.stderr).toBe(0);
  });

  it.each([
    ['exit 0', 'printf safe', 0],
    ['exit 2', 'pkill node', 2],
  ] as const)(
    'TBU1.R2.S03 preserves the canonical guard %s contract',
    (_case, command, exitCode) => {
      const project = markedProject();
      const result = spawnSync(process.execPath, [dispatcherPath], {
        cwd: project,
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: project,
          SAFEWORD_AGENT_RUNTIME: 'opencode',
          SAFEWORD_CODEX_DENY_MODE: 'exit-code',
        },
        input: JSON.stringify({
          hook_event_name: 'PreToolUse',
          session_id: 'opencode-session',
          tool_name: 'Bash',
          tool_input: { command },
        }),
        encoding: 'utf8',
      });

      expect(result.status, result.stderr).toBe(exitCode);
    },
  );

  it('blocks the edit that closes a feature while its referenced Gherkin remains @wip', () => {
    const project = markedProject();
    const ticketDirectory = nodePath.join(project, '.project', 'tickets', 'T1-feature');
    mkdirSync(ticketDirectory, { recursive: true });
    mkdirSync(nodePath.join(project, 'features'), { recursive: true });
    writeFileSync(
      nodePath.join(ticketDirectory, 'ticket.md'),
      '---\ntype: feature\nphase: done\nstatus: in_progress\n---\n# Feature\n',
    );
    writeFileSync(
      nodePath.join(ticketDirectory, 'test-definitions.md'),
      'Feature source: `features/test.feature`.\n\n- [x] Scenario one\n',
    );
    writeFileSync(
      nodePath.join(ticketDirectory, 'verify.md'),
      '# Verify\n\n**PR Scope:** ✅ Diff matches ticket scope\n',
    );
    writeFileSync(
      nodePath.join(project, 'features', 'test.feature'),
      '@wip\nFeature: Test\n\n  Scenario: one\n    Given it works\n',
    );

    const result = spawnSync(process.execPath, [dispatcherPath], {
      cwd: project,
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: project,
        SAFEWORD_CLI: nodePath.resolve(import.meta.dirname, '../../src/cli.ts'),
        SAFEWORD_AGENT_RUNTIME: 'opencode',
        SAFEWORD_CODEX_DENY_MODE: 'exit-code',
      },
      input: JSON.stringify({
        hook_event_name: 'PreToolUse',
        session_id: 'opencode-session',
        tool_name: 'Edit',
        tool_input: {
          file_path: nodePath.join(ticketDirectory, 'ticket.md'),
          old_string: 'status: in_progress',
          new_string: 'status: done',
        },
      }),
      encoding: 'utf8',
    });

    expect(result.status).toBe(3);
    expect(result.stderr).toContain('features/test.feature');
    expect(result.stderr).toContain('@wip');
  });
});

it('binds a saved intake ticket through the installed OpenCode profile before enforcing direct edits', async () => {
  const project = markedProject();
  const profile = createTemporaryDirectory();
  temporaryDirectories.push(profile);
  expect(installOpenCodeProfile(profile).ok).toBe(true);
  const installed = (await import(pathToFileURL(openCodeProfilePaths(profile).plugin).href)) as {
    Safeword(input: { directory: string }): Promise<{
      'tool.execute.before'(
        input: { tool: string; sessionID: string; callID: string },
        output: { args: Record<string, string> },
      ): Promise<void>;
      'tool.execute.after'(
        input: { tool: string; sessionID: string; callID: string; args: Record<string, string> },
        output: { output: string },
      ): Promise<void>;
    }>;
  };
  const hooks = await installed.Safeword({ directory: project });
  const authorSession = 'author/feature';
  function before(tool: string, args: Record<string, string>, sessionID = authorSession) {
    return hooks['tool.execute.before']({ tool, sessionID, callID: 'check' }, { args });
  }
  const dir = nodePath.join(project, '.project/tickets/OPEN12-dispatch');
  mkdirSync(dir, { recursive: true });
  const filePath = nodePath.join(dir, 'ticket.md');
  const content = '---\nid: OPEN12\ntype: feature\nphase: intake\nstatus: in_progress\n---\n';
  writeFileSync(filePath, content);
  const output = { output: 'Saved' };
  await hooks['tool.execute.after'](
    { tool: 'write', sessionID: authorSession, callID: 'save', args: { filePath, content } },
    output,
  );
  async function switchWork(action: 'pause' | 'resume') {
    const commands = output.output.matchAll(
      /safeword ticket (pause|resume) <ticket-id> ([\w.-]+)/gu,
    );
    const session = commands.find(match => match[1] === action)?.[2];
    if (!session) throw new Error(`Missing ${action} command in ${output.output}`);
    const result = await runCli(['ticket', action, 'OPEN12', session, '--json'], { cwd: project });
    expect(result.exitCode, result.stdout || result.stderr).toBe(0);
  }
  await expect(before('edit', { filePath: 'delivery.py' })).rejects.toThrow('advance-intake');
  await expect(before('write', { filePath: 'deployment.toml' })).rejects.toThrow('advance-intake');
  await expect(
    before('write', { filePath: 'deployment.toml' }, 'unbound'),
  ).resolves.toBeUndefined();
  await expect(before('bash', { command: 'cat delivery.py' })).resolves.toBeUndefined();
  await expect(
    before('apply_patch', {
      patchText:
        '*** Begin Patch\n*** Update File: .project/notes\n*** Move to: delivery.py\n@@\n-a\n+b\n*** End Patch',
    }),
  ).rejects.toThrow('advance-intake');
  await switchWork('pause');
  await expect(before('write', { filePath: 'help.txt' })).resolves.toBeUndefined();
  await hooks['tool.execute.after'](
    { tool: 'write', sessionID: authorSession, callID: 'patch', args: { filePath: 'help.txt' } },
    { output: 'Saved' },
  );
  await switchWork('resume');
  await expect(before('write', { filePath: 'delivery.py' })).rejects.toThrow('advance-intake');
});
