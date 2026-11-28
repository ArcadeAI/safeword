import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { setupReconcileTest } from '../helpers.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
it.each(['legacy', 'native'] as const)(
  'characterizes installed %s quality allow/deny through both actual matchers',
  async delivery => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-quality-route-'));
    roots.push(root);
    const project = nodePath.join(root, 'project'),
      plugin = nodePath.join(root, 'plugin');
    mkdirSync(project);
    const env = {
      PATH: process.env.PATH,
      HOME: nodePath.join(root, 'home'),
      XDG_CONFIG_HOME: nodePath.join(root, 'xdg'),
      CLAUDE_PROJECT_DIR: project,
      CLAUDE_PLUGIN_ROOT: plugin,
      CLAUDE_CONFIG_DIR: nodePath.join(root, 'config'),
      CLAUDE_PLUGIN_DATA: nodePath.join(root, 'data'),
      SAFEWORD_SKIP_INSTALL: '1',
      SAFEWORD_NO_AUTO_UPGRADE: '1',
    };
    let manifestPath: string;
    if (delivery === 'legacy') {
      const installed = await setupReconcileTest(project);
      expect(installed.result.applied).toBe(true);
      manifestPath = nodePath.join(project, '.claude/settings.json');
    } else {
      mkdirSync(nodePath.join(project, '.safeword'));
      cpSync(nodePath.resolve(import.meta.dirname, '../../../../plugin'), plugin, {
        recursive: true,
      });
      manifestPath = nodePath.join(plugin, 'hooks/hooks.json');
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      hooks: { PreToolUse: { matcher?: string; hooks: { command: string; if?: string }[] }[] };
    };
    const groups = manifest.hooks.PreToolUse.filter(group =>
      group.hooks.some(hook => hook.command.includes('/pre-tool-quality.ts')),
    );
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      const hook = group.hooks.find(row => row.command.includes('/pre-tool-quality.ts'));
      assert.ok(hook, 'QUALITY_FIXTURE_UNAVAILABLE: installed route missing');
      expect(hook.if).toBeUndefined();
      expect(['Bash', 'Edit|Write|MultiEdit|NotebookEdit']).toContain(group.matcher);
      const bash = group.matcher === 'Bash';
      const invoke = (denied: boolean) => {
        const result = spawnSync('sh', ['-c', hook.command], {
          cwd: project,
          env,
          encoding: 'utf8',
          timeout: 30_000,
          input: JSON.stringify({
            cwd: project,
            session_id: 'quality-route-control',
            hook_event_name: 'PreToolUse',
            tool_name: bash ? 'Bash' : 'Write',
            tool_input: bash
              ? { command: denied ? 'pkill bun' : 'echo synthetic-control' }
              : {
                  file_path: nodePath.join(
                    project,
                    '.project',
                    denied ? 'tickets/example/test-definitions.md' : 'notes.md',
                  ),
                },
          }),
        });
        assert.equal(
          result.error,
          undefined,
          `QUALITY_FIXTURE_UNAVAILABLE: ${result.error?.message}`,
        );
        expect(result.signal).toBeNull();
        return result;
      };
      const denied = invoke(true);
      const reason = bash
        ? 'Broad process kill blocked: `pkill bun`'
        : 'Cannot create test definitions without a ticket spec.';
      expect(denied.status, denied.stderr).toBe(0);
      expect(JSON.parse(denied.stdout)).toMatchObject({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: expect.stringContaining(reason),
        },
      });
      const allowed = invoke(false);
      expect(allowed.status, allowed.stderr).toBe(0);
      expect(allowed.stdout).toBe('');
    }
  },
);
