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
      expect(command).not.toContain('npx');
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
