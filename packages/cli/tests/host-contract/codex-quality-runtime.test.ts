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
it('characterizes actual packaged Codex native dispatch through shared Write/Bash allow and deny', () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'codex-quality-adoption-'));
  roots.push(root);
  const project = nodePath.join(root, 'project'),
    plugin = nodePath.join(root, 'plugin');
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), '# synthetic project\n');
  cpSync(nodePath.resolve(import.meta.dirname, '../../codex-plugin'), plugin, { recursive: true });
  const manifest = JSON.parse(readFileSync(nodePath.join(plugin, 'hooks.json'), 'utf8')) as {
    hooks: { PreToolUse: { matcher: string; hooks: { command: string }[] }[] };
  };
  expect(manifest.hooks.PreToolUse).toHaveLength(1);
  const group = manifest.hooks.PreToolUse[0];
  expect(group?.matcher).toBe('^(apply_patch|Bash|Edit|Write)$');
  const hook = group?.hooks[0];
  assert.ok(hook, 'CODEX_FIXTURE_UNAVAILABLE: native command missing');
  for (const tool of ['Write', 'Bash']) {
    const invoke = (denied: boolean) => {
      const result = spawnSync('sh', ['-c', hook.command], {
        cwd: plugin,
        encoding: 'utf8',
        timeout: 30_000,
        env: {
          PATH: process.env.PATH,
          HOME: nodePath.join(root, 'home'),
          XDG_CONFIG_HOME: nodePath.join(root, 'xdg'),
          CODEX_HOME: nodePath.join(root, 'profile'),
          PLUGIN_ROOT: plugin,
          SAFEWORD_NO_AUTO_UPGRADE: '1',
          SAFEWORD_SKIP_INSTALL: '1',
        },
        input: JSON.stringify({
          cwd: project,
          session_id: 'quality-adoption',
          tool_name: tool,
          tool_input:
            tool === 'Bash'
              ? { command: denied ? 'pkill node' : 'echo synthetic-control' }
              : {
                  file_path: nodePath.join(
                    project,
                    '.project',
                    denied ? 'tickets/example/test-definitions.md' : 'notes.md',
                  ),
                  content: 'synthetic',
                },
        }),
      });
      assert.equal(result.error, undefined, `CODEX_FIXTURE_UNAVAILABLE: ${result.error?.message}`);
      expect(result.status, result.stderr).toBe(0);
      return result.stdout;
    };
    expect(JSON.parse(invoke(true))).toMatchObject({
      hookSpecificOutput: {
        permissionDecision: 'deny',
        permissionDecisionReason: expect.stringContaining(
          tool === 'Bash'
            ? 'Broad process kill blocked'
            : 'Cannot create test definitions without a ticket spec.',
        ),
      },
    });
    expect(invoke(false)).toBe('');
  }
});
