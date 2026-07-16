import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertPackedCodexPlugin,
  extractPackedCliPackage,
  packCliPackage,
} from './helpers/codex-plugin-package.js';

type HookEntry = { hooks?: { command?: string }[]; matcher?: string };

function pluginCommands(hooks: Record<string, HookEntry[]>): string[] {
  return Object.values(hooks).flatMap(entries =>
    entries.flatMap(entry =>
      (entry.hooks ?? []).flatMap(hook => (hook.command ? [hook.command] : [])),
    ),
  );
}

function assertPinnedBunxHookCommand(command: string, version: string): void {
  if (command.includes('--dangerously-bypass-hook-trust')) {
    throw new Error('Safe Word plugin hooks must not bypass Codex hook trust');
  }
  if (/\bnpx\b/u.test(command)) {
    throw new Error('Safe Word plugin hooks must use Bunx, never npx');
  }
  if (!command.startsWith('bunx --bun safeword')) {
    throw new Error('Safe Word plugin hooks must use pinned Bunx Safe Word commands');
  }
  if (!command.startsWith(`bunx --bun safeword@${version} `)) {
    throw new Error(`Safe Word plugin hooks must pin safeword@${version}`);
  }
  if (!/^bunx --bun safeword@\S+ hook codex [a-z-]+$/u.test(command)) {
    throw new Error('Safe Word plugin hooks must use the Safe Word Codex hook command form');
  }
}

describe('Codex plugin release contract', () => {
  it('pins every hook to the published CLI version through Bunx only', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const version = JSON.parse(readFileSync(nodePath.join(root, 'package.json'), 'utf8'))
      .version as string;
    const manifest = JSON.parse(
      readFileSync(nodePath.join(root, 'codex-plugin/.codex-plugin/plugin.json'), 'utf8'),
    ) as { version: string };
    const hooks = JSON.parse(
      readFileSync(nodePath.join(root, 'codex-plugin/hooks.json'), 'utf8'),
    ) as {
      hooks: Record<string, HookEntry[]>;
    };

    expect(manifest.version).toBe(version);
    const commands = pluginCommands(hooks.hooks);
    expect(commands).toEqual([
      `bunx --bun safeword@${version} hook codex session-start`,
      `bunx --bun safeword@${version} hook codex pre-tool-use`,
      `bunx --bun safeword@${version} hook codex post-tool-use`,
      `bunx --bun safeword@${version} hook codex user-prompt-submit`,
      `bunx --bun safeword@${version} hook codex stop`,
    ]);
    for (const command of commands) {
      expect(() => {
        assertPinnedBunxHookCommand(command, version);
      }).not.toThrow();
    }
  });

  it('rejects unsafe plugin hook execution paths', () => {
    const root = nodePath.resolve(import.meta.dirname, '..');
    const version = JSON.parse(readFileSync(nodePath.join(root, 'package.json'), 'utf8'))
      .version as string;

    expect(() => {
      assertPinnedBunxHookCommand('npx safeword@0.68.0 hook codex session-start', version);
    }).toThrow('Bunx');
    expect(() => {
      assertPinnedBunxHookCommand('bunx --bun safeword hook codex session-start', version);
    }).toThrow(`safeword@${version}`);
    expect(() => {
      assertPinnedBunxHookCommand(
        `bunx --bun safeword@${version} hook codex session-start --dangerously-bypass-hook-trust`,
        version,
      );
    }).toThrow('must not bypass');
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
      hooks: Record<string, HookEntry[]>;
    };

    const preToolUseHooks = hooks.hooks.PreToolUse ?? [];
    const postToolUseHooks = hooks.hooks.PostToolUse ?? [];
    expect(preToolUseHooks).toHaveLength(1);
    expect(postToolUseHooks).toHaveLength(1);
    expect(preToolUseHooks[0]?.matcher).toBe('^(apply_patch|Bash|Edit|Write)$');
    expect(postToolUseHooks[0]?.matcher).toBe('^(apply_patch|Bash|Edit|Write)$');
  });
});
