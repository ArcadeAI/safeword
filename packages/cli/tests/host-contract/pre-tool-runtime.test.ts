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
  'characterizes installed %s pre-tool denial, approval and best-effort housekeeping',
  async delivery => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-pre-tool-'));
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
    const invoke = (
      owner: string,
      matcher: string,
      condition: string | undefined,
      toolInput: Record<string, unknown>,
    ) => {
      const group = manifest.hooks.PreToolUse.find(
        (row: { matcher: string; hooks: { command: string; if?: string }[] }) =>
          row.matcher === matcher &&
          row.hooks.some(hook => hook.command.includes(`/${owner}`) && hook.if === condition),
      );
      assert.ok(group);
      const hook = group.hooks.find(
        (row: { command: string; if?: string }) =>
          row.command.includes(`/${owner}`) && row.if === condition,
      );
      assert.ok(hook);
      expect([hook.async, hook.asyncRewake]).toEqual([undefined, undefined]);
      const result = spawnSync('sh', ['-c', hook.command], {
        cwd: project,
        env,
        encoding: 'utf8',
        timeout: 30_000,
        input: JSON.stringify({
          cwd: project,
          session_id: 'synthetic-pre-tool',
          hook_event_name: 'PreToolUse',
          tool_name: matcher === 'Bash' ? 'Bash' : 'Edit',
          tool_input: toolInput,
        }),
      });
      assert.equal(result.error, undefined);
      expect(result.signal).toBeNull();
      expect(result.status, result.stderr).toBe(0);
      return result.stdout;
    };
    writeFileSync(
      nodePath.join(project, 'package.json'),
      JSON.stringify({
        name: 'synthetic',
        packageManager: 'bun@1.3.12',
        scripts: { test: 'vitest' },
      }),
    );
    writeFileSync(nodePath.join(project, 'bun.lock'), '# synthetic lock');
    const denied = JSON.parse(
      invoke('pre-tool-dependency-readiness.ts', 'Bash', undefined, { command: 'bun run test' }),
    ).hookSpecificOutput;
    expect(denied).toMatchObject({ hookEventName: 'PreToolUse', permissionDecision: 'deny' });
    expect(denied.permissionDecisionReason).toContain('bun ci');
    expect(denied.additionalContext).toBe('Blocked command:\nbun run test');
    expect(
      invoke('pre-tool-dependency-readiness.ts', 'Bash', undefined, { command: 'echo synthetic' }),
    ).toBe('');
    // Ask is intentionally not relabeled as deny; no unconditional rejection guarantee.
    const protectedFile = nodePath.join(project, 'eslint.config.ts');
    const approval = JSON.parse(
      invoke('pre-tool-config-guard.ts', 'Edit|Write|MultiEdit|NotebookEdit', undefined, {
        file_path: protectedFile,
      }),
    ).hookSpecificOutput;
    expect(approval).toEqual({
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: `⚠️ The agent wants to change a settings file that controls your safety checks (ESLint config). Approving this could weaken those checks.\n\nFile: ${protectedFile}\n\nPrefer fixing the code over loosening the settings. If this change is genuinely needed, the agent should explain why.`,
    });
    expect(
      invoke('pre-tool-config-guard.ts', 'Edit|Write|MultiEdit|NotebookEdit', undefined, {
        file_path: nodePath.join(project, 'sample.ts'),
      }),
    ).toBe('');
    // No repository is an honest quiet best-effort outcome, not successful staging/warning proof.
    expect(
      invoke('pre-tool-architecture-stage.ts', 'Bash', 'Bash(git commit*)', {
        command: 'git commit -m synthetic',
      }),
    ).toBe('');
    for (const operation of ['checkout', 'switch'])
      expect(
        invoke('pre-tool-stale-main.ts', 'Bash', `Bash(git ${operation}*)`, {
          command: `git ${operation} main`,
        }),
      ).toBe('');
  },
);
