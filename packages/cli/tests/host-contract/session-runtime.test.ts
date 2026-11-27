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
  'characterizes installed %s session context and handbook selection',
  async delivery => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-session-'));
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
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const invoke = (owner: string) => {
      const hook = manifest.hooks.SessionStart.flatMap(
        (row: { hooks: { command: string }[] }) => row.hooks,
      ).find((row: { command: string }) =>
        delivery === 'native'
          ? row.command.endsWith('SessionStart --event-group')
          : row.command.includes(`/${owner}`),
      );
      assert.ok(hook);
      const result = spawnSync('sh', ['-c', hook.command], {
        cwd: project,
        env,
        encoding: 'utf8',
        timeout: 30_000,
        input: JSON.stringify({
          cwd: project,
          session_id: 'synthetic-session',
          source: 'startup',
          hook_event_name: 'SessionStart',
        }),
      });
      assert.equal(result.error, undefined);
      expect(result.signal).toBeNull();
      expect(result.status, result.stderr).toBe(0);
      return result.stdout;
    };
    // Native goes through the unchanged verified event-group dispatcher, not a fabricated direct route.
    const output = invoke('session-reply-format.ts');
    const context = JSON.parse(output).hookSpecificOutput;
    expect(context.hookEventName).toBe('SessionStart');
    expect(context.additionalContext).toContain('Choice:');
    expect(context.additionalContext).toContain('Recommendation:');
    const handbookContext =
      delivery === 'native'
        ? context
        : JSON.parse(invoke('session-safeword-context.ts')).hookSpecificOutput;
    const handbook =
      delivery === 'native'
        ? nodePath.join(plugin, 'resources/SAFEWORD.md')
        : nodePath.join(project, '.safeword/SAFEWORD.md');
    expect(handbookContext.additionalContext).toContain(`Read \`${handbook}\` in full`);
  },
);
