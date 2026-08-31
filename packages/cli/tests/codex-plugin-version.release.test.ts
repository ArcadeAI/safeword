import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertBundledHookCommand,
  codexPluginHookCommands,
  type CodexPluginHookEntry,
} from '../src/codex-plugin/hooks.js';
import {
  assertPackedCodexPlugin,
  extractPackedCliPackage,
  packCliPackage,
} from './helpers/codex-plugin-package.js';

describe('Codex plugin release contract', () => {
  it('runs every hook through the bundled plugin CLI', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const version = JSON.parse(readFileSync(nodePath.join(root, 'package.json'), 'utf8'))
      .version as string;
    const manifest = JSON.parse(
      readFileSync(nodePath.join(root, 'codex-plugin/.codex-plugin/plugin.json'), 'utf8'),
    ) as { version: string };
    const runtimePackage = JSON.parse(
      readFileSync(nodePath.join(root, 'codex-plugin/package.json'), 'utf8'),
    ) as { version: string };
    const hooks = JSON.parse(
      readFileSync(nodePath.join(root, 'codex-plugin/hooks.json'), 'utf8'),
    ) as {
      hooks: Record<string, CodexPluginHookEntry[]>;
    };

    expect(manifest.version).toBe(version);
    expect(runtimePackage.version).toBe(version);
    const commands = codexPluginHookCommands(hooks.hooks);
    expect(commands).toEqual([
      'bun "${PLUGIN_ROOT}/runtime/cli.js" hook codex session-start --plugin-hook',
      'bun "${PLUGIN_ROOT}/runtime/cli.js" hook codex pre-tool-use --plugin-hook',
      'bun "${PLUGIN_ROOT}/runtime/cli.js" hook codex post-tool-use --plugin-hook',
      'bun "${PLUGIN_ROOT}/runtime/cli.js" hook codex user-prompt-submit --plugin-hook',
      'bun "${PLUGIN_ROOT}/runtime/cli.js" hook codex stop --plugin-hook',
    ]);
    for (const command of commands) {
      expect(() => {
        assertBundledHookCommand(command);
      }).not.toThrow();
    }
    expect(readFileSync(nodePath.join(root, 'codex-plugin/runtime/cli.js'), 'utf8')).toBe(
      readFileSync(nodePath.resolve(root, '../../plugin/runtime/cli.js'), 'utf8'),
    );
  });

  it('rejects unsafe plugin hook execution paths', () => {
    expect(() => {
      assertBundledHookCommand('npx safeword@0.68.0 hook codex session-start');
    }).toThrow('must not install packages');
    expect(() => {
      assertBundledHookCommand('bunx --bun safeword hook codex session-start');
    }).toThrow('must not install packages');
    expect(() => {
      assertBundledHookCommand(
        'bun "${PLUGIN_ROOT}/runtime/cli.js" hook codex session-start --dangerously-bypass-hook-trust',
      );
    }).toThrow('must not bypass');
  });

  it('executes the bundled CLI without project dependencies or a populated package cache', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-runtime-'));
    try {
      const result = spawnSync(
        'bun',
        [nodePath.join(root, 'codex-plugin/runtime/cli.js'), '--version'],
        {
          cwd: fixture,
          encoding: 'utf8',
          env: { ...process.env, BUN_INSTALL_CACHE_DIR: nodePath.join(fixture, 'empty-cache') },
        },
      );
      const version = (
        JSON.parse(readFileSync(nodePath.join(root, 'package.json'), 'utf8')) as {
          version: string;
        }
      ).version;

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout.trim()).toBe(version);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('executes from the cache path reported by a real Codex plugin install', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const repoRoot = nodePath.resolve(root, '../..');
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-install-'));
    const codexHome = nodePath.join(fixture, 'home');
    const marketplaceRoot = nodePath.join(fixture, 'marketplace');
    mkdirSync(codexHome, { recursive: true });
    mkdirSync(nodePath.join(marketplaceRoot, '.agents/plugins'), { recursive: true });
    mkdirSync(nodePath.join(marketplaceRoot, 'packages/cli'), { recursive: true });
    cpSync(
      nodePath.join(repoRoot, '.agents/plugins/marketplace.json'),
      nodePath.join(marketplaceRoot, '.agents/plugins/marketplace.json'),
    );
    cpSync(
      nodePath.join(root, 'codex-plugin'),
      nodePath.join(marketplaceRoot, 'packages/cli/codex-plugin'),
      {
        recursive: true,
      },
    );

    try {
      const environment = { ...process.env, CLAUDE_PROJECT_DIR: '', CODEX_HOME: codexHome };
      const marketplaceAddResult = spawnSync(
        'codex',
        ['plugin', 'marketplace', 'add', marketplaceRoot, '--json'],
        { encoding: 'utf8', env: environment },
      );
      expect(marketplaceAddResult.status, marketplaceAddResult.stderr).toBe(0);
      const install = spawnSync(
        'codex',
        ['plugin', 'add', 'safeword', '--marketplace', 'safeword', '--json'],
        { encoding: 'utf8', env: environment },
      );
      expect(install.status, install.stderr).toBe(0);

      const installed = JSON.parse(install.stdout) as { installedPath: string; version: string };
      expect(realpathSync(installed.installedPath)).toBe(
        realpathSync(
          nodePath.join(codexHome, 'plugins/cache/safeword/safeword', installed.version),
        ),
      );
      const runtime = spawnSync(
        'bun',
        [nodePath.join(installed.installedPath, 'runtime/cli.js'), '--version'],
        { encoding: 'utf8', env: environment },
      );
      expect(runtime.status, runtime.stderr).toBe(0);
      expect(runtime.stdout.trim()).toBe(installed.version);

      const unenrolledProject = nodePath.join(fixture, 'unenrolled-project');
      mkdirSync(unenrolledProject, { recursive: true });
      const sessionStart = spawnSync(
        'bun',
        [
          nodePath.join(installed.installedPath, 'runtime/cli.js'),
          'hook',
          'codex',
          'session-start',
          '--plugin-hook',
        ],
        {
          cwd: unenrolledProject,
          encoding: 'utf8',
          env: environment,
          input: JSON.stringify({ session_id: 'release-contract' }),
        },
      );
      expect(sessionStart.status, sessionStart.stderr).toBe(0);
      expect(JSON.parse(sessionStart.stdout)).toMatchObject({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: expect.stringContaining('Safeword session bootstrap'),
        },
      });
      const sessionProof = JSON.parse(
        readFileSync(nodePath.join(codexHome, 'safeword/hook-proof-v2/session-start.json'), 'utf8'),
      ) as Record<string, unknown>;
      const hookManifest = readFileSync(nodePath.join(installed.installedPath, 'hooks.json'));
      const sourceHookManifest = readFileSync(nodePath.join(root, 'codex-plugin/hooks.json'));
      expect(hookManifest).toEqual(sourceHookManifest);
      expect(sessionProof).toMatchObject({
        schema_version: 3,
        event: 'session-start',
        plugin_version: installed.version,
        manifest_sha256: createHash('sha256').update(sourceHookManifest).digest('hex'),
        project_directory: realpathSync(unenrolledProject),
        session_id: 'release-contract',
      });
      const status = spawnSync(
        'bun',
        [nodePath.join(installed.installedPath, 'runtime/cli.js'), 'codex', 'status', '--json'],
        { cwd: unenrolledProject, encoding: 'utf8', env: environment },
      );
      expect(status.status, status.stderr).toBe(2);
      expect(JSON.parse(status.stdout)).toMatchObject({
        data: {
          migration: { state: 'plugin_enabled_hook_unproven' },
          proof: {
            status: 'partial',
            plugin_version: installed.version,
            manifest_sha256: createHash('sha256').update(sourceHookManifest).digest('hex'),
            events: ['session-start'],
          },
        },
      });

      const projectDirectory = nodePath.join(fixture, 'project');
      mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
      cpSync(
        nodePath.join(root, 'templates/SAFEWORD.md'),
        nodePath.join(projectDirectory, '.safeword/SAFEWORD.md'),
      );
      const hook = spawnSync(
        'bun',
        [
          nodePath.join(installed.installedPath, 'runtime/cli.js'),
          'hook',
          'codex',
          'pre-tool-use',
          '--plugin-hook',
        ],
        {
          cwd: projectDirectory,
          encoding: 'utf8',
          env: { ...environment, CLAUDE_PROJECT_DIR: projectDirectory },
          input: JSON.stringify({
            session_id: 'release-contract',
            tool_name: 'Bash',
            tool_input: { command: "sed -n '1,20p' README.md" },
          }),
        },
      );
      expect(hook.status, hook.stderr).toBe(0);
      expect(hook.stdout).toBe('');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 15_000);

  it('includes the complete generated plugin in a Bun-packed archive', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-plugin-pack-'));
    try {
      const archive = packCliPackage(root, fixture);
      const packageDirectory = extractPackedCliPackage(archive, fixture);

      expect(() => {
        assertPackedCodexPlugin(root, packageDirectory);
      }).not.toThrow();
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 15_000);

  it('rejects a packed plugin with a missing generated asset', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-plugin-pack-'));
    try {
      const archive = packCliPackage(root, fixture);
      const packageDirectory = extractPackedCliPackage(archive, fixture);
      rmSync(nodePath.join(packageDirectory, 'codex-plugin/skills/bdd/references/DISCOVERY.md'));

      expect(() => {
        assertPackedCodexPlugin(root, packageDirectory);
      }).toThrow('missing expected asset');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 15_000);

  it('rejects a packed plugin with a missing packaged hook artifact', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-plugin-pack-'));
    try {
      const archive = packCliPackage(root, fixture);
      const packageDirectory = extractPackedCliPackage(archive, fixture);
      rmSync(nodePath.join(packageDirectory, 'codex-plugin/templates/SAFEWORD.md'));

      expect(() => {
        assertPackedCodexPlugin(root, packageDirectory);
      }).toThrow('generated tree does not match its source tree');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 15_000);

  it('uses only Codex-supported tool matchers for edit hooks', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const hooks = JSON.parse(
      readFileSync(nodePath.join(root, 'codex-plugin/hooks.json'), 'utf8'),
    ) as {
      hooks: Record<string, CodexPluginHookEntry[]>;
    };

    const preToolUseHooks = hooks.hooks.PreToolUse ?? [];
    const postToolUseHooks = hooks.hooks.PostToolUse ?? [];
    expect(preToolUseHooks).toHaveLength(1);
    expect(postToolUseHooks).toHaveLength(1);
    expect(preToolUseHooks[0]?.matcher).toBe('^(apply_patch|Bash|Edit|Write)$');
    expect(postToolUseHooks[0]?.matcher).toBe('^(apply_patch|Bash|Edit|Write)$');
  });
});
