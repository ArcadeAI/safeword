import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
