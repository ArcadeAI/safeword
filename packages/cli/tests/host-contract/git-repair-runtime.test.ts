import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { setupReconcileTest } from '../helpers.js';

const repo = nodePath.resolve(import.meta.dirname, '../../../..');
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
it.each(['legacy', 'native'] as const)(
  'characterizes installed %s Git repair as observe-only and config-local',
  async delivery => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-git-repair-'));
    roots.push(root);
    const project = nodePath.join(root, 'project');
    mkdirSync(project);
    const environment = {
      PATH: process.env.PATH,
      HOME: nodePath.join(root, 'home'),
      XDG_CONFIG_HOME: nodePath.join(root, 'xdg'),
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: nodePath.join(root, 'global-config'),
      CLAUDE_PROJECT_DIR: project,
      CLAUDE_CONFIG_DIR: nodePath.join(root, 'config'),
      CLAUDE_PLUGIN_ROOT: nodePath.join(root, 'plugin'),
      CLAUDE_PLUGIN_DATA: nodePath.join(root, 'data'),
      SAFEWORD_SKIP_INSTALL: '1',
      SAFEWORD_NO_AUTO_UPGRADE: '1',
    };
    const globalConfig = '[safeword]\nfixture = untouched\n';
    writeFileSync(environment.GIT_CONFIG_GLOBAL, globalConfig);
    type Manifest = {
      hooks: { PreToolUse: { matcher?: string; hooks: { command: string; if?: string }[] }[] };
    };
    let manifest: Manifest;
    if (delivery === 'legacy') {
      const installed = await setupReconcileTest(project);
      expect(installed.result.applied).toBe(true);
      manifest = JSON.parse(
        readFileSync(nodePath.join(project, '.claude/settings.json'), 'utf8'),
      ) as Manifest;
    } else {
      cpSync(nodePath.join(repo, 'plugin'), environment.CLAUDE_PLUGIN_ROOT, { recursive: true });
      manifest = JSON.parse(
        readFileSync(nodePath.join(environment.CLAUDE_PLUGIN_ROOT, 'hooks/hooks.json'), 'utf8'),
      ) as Manifest;
    }
    const groups = manifest.hooks.PreToolUse.filter(group =>
      group.hooks.some(hook => hook.command.includes('/pre-tool-git-bare-fix.sh')),
    );
    expect(groups).toHaveLength(1);
    const group = groups[0],
      hook = group?.hooks.find(row => row.command.includes('/pre-tool-git-bare-fix.sh'));
    assert.ok(hook, 'HOST_CONTRACT_PROOF_UNAVAILABLE: installed Git repair route missing');
    expect(group?.matcher).toBe('Bash');
    expect(hook.if).toBe('Bash(git *)');
    let workingDirectory = project;
    const git = (...args: string[]) => {
      const result = spawnSync('git', args, {
        cwd: workingDirectory,
        env: environment,
        encoding: 'utf8',
        timeout: 10_000,
      });
      assert.equal(result.status, 0, `PRIVATE_GIT_FIXTURE_UNAVAILABLE: ${result.stderr}`);
      return result.stdout;
    };
    const invoke = () => {
      const result = spawnSync('sh', ['-c', hook.command], {
        cwd: workingDirectory,
        env: environment,
        encoding: 'utf8',
        timeout: 30_000,
        input: JSON.stringify({
          cwd: workingDirectory,
          hook_event_name: 'PreToolUse',
          session_id: 'git-repair-control',
          tool_name: 'Bash',
          tool_input: { command: 'git status --short' },
        }),
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toBe(''); // Observe-only: no deny or continuation decision.
      expect(readFileSync(environment.GIT_CONFIG_GLOBAL, 'utf8')).toBe(globalConfig);
    };
    invoke(); // No repository: no-op, with the same installed boundary.
    git('init', '--quiet', '--template=');
    git('config', '--local', 'safeword.fixture', 'retained');
    git('config', '--local', 'core.bare', 'true');
    invoke();
    expect(
      git('config', '--local', '--get', 'core.bare').trim(),
      'ACTUAL_GIT_REPAIR_OWNER_NOT_EXECUTED',
    ).toBe('false');
    expect(git('config', '--local', '--get', 'safeword.fixture').trim()).toBe('retained');
    const config = nodePath.join(project, '.git/config'),
      bytes = readFileSync(config, 'utf8');
    const past = new Date('2000-01-01T00:00:00Z');
    utimesSync(config, past, past);
    const mtime = statSync(config).mtimeMs;
    invoke(); // Already healthy: no redundant config write.
    expect(readFileSync(config, 'utf8')).toBe(bytes);
    expect(statSync(config).mtimeMs).toBe(mtime);
    // The native hook cwd can move while CLAUDE_PROJECT_DIR stays at the initial project.
    git('config', '--local', 'core.bare', 'true');
    workingDirectory = nodePath.join(root, 'session-cwd');
    mkdirSync(workingDirectory);
    git('init', '--quiet', '--template=');
    git('config', '--local', 'core.bare', 'true');
    invoke();
    expect(git('config', '--local', '--get', 'core.bare').trim(), 'NATIVE_HOOK_CWD_IGNORED').toBe(
      'false',
    );
    workingDirectory = project;
    expect(git('config', '--local', '--get', 'core.bare').trim()).toBe('true');
  },
  90_000,
);
