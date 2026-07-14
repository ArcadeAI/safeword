import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

type HookEntry = { hooks?: { command?: string }[] };

describe('Codex plugin release contract', () => {
  it('pins every hook to the published CLI version', () => {
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
    const hookEntryGroups = Object.values(hooks.hooks);
    for (const entries of hookEntryGroups) {
      for (const entry of entries) {
        const hookCommands = entry.hooks ?? [];
        for (const hook of hookCommands) {
          expect(hook.command).toContain(`bunx --bun safeword@${version} hook codex`);
        }
      }
    }
  });
});
