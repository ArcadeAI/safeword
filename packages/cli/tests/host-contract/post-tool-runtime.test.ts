import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { setupReconcileTest } from '../helpers.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
it.each(['legacy', 'native'] as const)(
  'characterizes installed %s post-tool advice and phase stamps',
  async delivery => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-post-tool-'));
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
      hooks: {
        PostToolUse: {
          matcher: string;
          hooks: { command: string; async?: boolean; asyncRewake?: boolean; if?: string }[];
        }[];
      };
    };
    const invoke = (owner: string, toolInput: Record<string, unknown>) => {
      const group = manifest.hooks.PostToolUse.find(row =>
        row.hooks.some(hook => hook.command.includes(`/${owner}`)),
      );
      const hook = group?.hooks.find(row => row.command.includes(`/${owner}`));
      assert.ok(hook);
      assert.ok(group);
      expect(group.matcher).toBe('Edit|Write|MultiEdit|NotebookEdit');
      expect([hook.async, hook.asyncRewake, hook.if]).toEqual([undefined, undefined, undefined]);
      const result = spawnSync('sh', ['-c', hook.command], {
        cwd: project,
        env,
        encoding: 'utf8',
        timeout: 30_000,
        input: JSON.stringify({
          cwd: project,
          session_id: 'synthetic-post-tool',
          hook_event_name: 'PostToolUse',
          tool_name: 'Edit',
          tool_input: toolInput,
        }),
      });
      assert.equal(result.error, undefined);
      expect(result.signal).toBeNull();
      expect(result.status, result.stderr).toBe(0);
      return result;
    };
    const file = nodePath.join(project, 'sample.ts');
    const warning = invoke('post-tool-bypass-warn.ts', {
      file_path: file,
      new_string: '// @ts-ignore\nconst x = 1;',
    });
    expect(warning.stdout).toContain('TypeScript bypass');
    expect(warning.stdout).toContain(file);
    const quiet = invoke('post-tool-bypass-warn.ts', {
      file_path: file,
      new_string: 'const x = 1;',
    });
    expect(quiet.stdout).toBe('');
    const ticket = nodePath.join(project, '.project/tickets/ABC123-synthetic/ticket.md');
    mkdirSync(nodePath.dirname(ticket), { recursive: true });
    writeFileSync(ticket, '---\nid: ABC123\nphase: implement\n---\n# Synthetic\n\n## Work Log\n');
    const stamped = invoke('post-tool-work-log.ts', {
      file_path: ticket,
      old_string: 'phase: plan-execution',
      new_string: 'phase: implement',
    });
    expect(stamped.stdout).toBe('');
    const content = readFileSync(ticket, 'utf8');
    expect(content).toMatch(/\d{4}-\d{2}-\d{2}T[\d:.]+Z Phase: plan-execution → implement/u);
    invoke('post-tool-work-log.ts', {
      file_path: file,
      old_string: 'const x = 1;',
      new_string: 'const x = 2;',
    });
    expect(readFileSync(ticket, 'utf8')).toBe(content);
  },
);
