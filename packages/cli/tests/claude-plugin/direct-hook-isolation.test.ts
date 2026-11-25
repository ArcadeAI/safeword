import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-direct-hook-'));
  roots.push(root);
  const project = nodePath.join(root, 'project'),
    plugin = nodePath.join(root, 'plugin');
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  cpSync(nodePath.resolve(import.meta.dirname, '../../../../plugin'), plugin, { recursive: true });
  const manifest = JSON.parse(readFileSync(nodePath.join(plugin, 'hooks/hooks.json'), 'utf8')) as {
    hooks: { PreToolUse: { matcher?: string; hooks: { command: string }[] }[] };
  };
  const command = (owner: string) => {
    const matches = manifest.hooks.PreToolUse.filter(group => group.matcher === 'Bash')
      .flatMap(group => group.hooks)
      .filter(hook => hook.command.includes(`/${owner}`));
    assert.equal(
      matches.length,
      1,
      'HOST_CONTRACT_PROOF_UNAVAILABLE: installed route must be unique',
    );
    const match = matches[0];
    assert.ok(match, 'HOST_CONTRACT_PROOF_UNAVAILABLE: installed route missing');
    return match.command;
  };
  const invoke = (owner: string, cwd = project) =>
    spawnSync('sh', ['-c', command(owner)], {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        PATH: process.env.PATH,
        HOME: nodePath.join(root, 'home'),
        CLAUDE_PROJECT_DIR: project,
        CLAUDE_PLUGIN_ROOT: plugin,
        CLAUDE_PLUGIN_DATA: nodePath.join(root, 'data'),
        CLAUDE_CONFIG_DIR: nodePath.join(root, 'config'),
        SAFEWORD_SKIP_INSTALL: '1',
        SAFEWORD_NO_AUTO_UPGRADE: '1',
      },
      // This is an input to the actual guard; no process-kill command is executed.
      input: JSON.stringify({
        cwd,
        hook_event_name: 'PreToolUse',
        session_id: 'direct-hook-control',
        tool_name: 'Bash',
        tool_input: { command: 'pkill bun' },
      }),
    });
  return { root, project, invoke };
}
function expectActualDenial(result: ReturnType<ReturnType<typeof fixture>['invoke']>) {
  expect(result.status, `ACTUAL_NATIVE_GUARD_DENIAL_MISSING: ${result.stderr}`).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: expect.stringContaining('Broad process kill blocked: `pkill bun`'),
    },
  });
}
it('retains the real installed Bun gate denial despite a throwing project preload', () => {
  const { project, invoke } = fixture();
  expectActualDenial(invoke('pre-tool-quality.ts')); // Real baseline, not a stub policy.
  writeFileSync(nodePath.join(project, 'bunfig.toml'), 'preload = ["./preload.ts"]\n');
  writeFileSync(
    nodePath.join(project, 'preload.ts'),
    'throw new Error("PROJECT_PRELOAD_EXECUTED");\n',
  );
  expectActualDenial(invoke('pre-tool-quality.ts'));
});
it('keeps the installed Bun gate effective when hook cwd is missing but the launch project exists', () => {
  const { root, invoke } = fixture();
  expectActualDenial(invoke('pre-tool-quality.ts', nodePath.join(root, 'missing')));
});
it('reports missing observer shell cwd without blocking or claiming successful execution', () => {
  const { root, invoke } = fixture();
  const result = invoke('pre-tool-git-bare-fix.sh', nodePath.join(root, 'missing'));
  expect(result.status, 'OBSERVER_SHELL_CWD_FAILURE_MUST_NOT_BLOCK').toBe(1);
  expect(result.stderr).toContain('Safeword hook command could not start:');
  expect(result.stderr).toContain('ENOENT');
  expect(result.stdout).toBe('');
});
it('preserves the existing degraded ask response when the canonical launch project is gone', () => {
  const { root, project, invoke } = fixture();
  rmSync(project, { recursive: true });
  const result = invoke('pre-tool-quality.ts', nodePath.join(root, 'missing'));
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: expect.stringContaining(
        'Claude project root is missing, not a directory, or cannot be resolved:',
      ),
    },
  });
});
