import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { timeoutMsForTestCommand } from '../../../../.safeword/hooks/lib/test-runner';

const root = nodePath.resolve(import.meta.dirname, '../../../..');

it.each([
  ['Codex Stop', 'packages/cli/codex-plugin/hooks.json', 'Stop', true],
  ['Claude plugin Stop', 'plugin/hooks/hooks.json', 'Stop', true],
  ['Claude project Stop', '.claude/settings.json', 'Stop', true],
  ['Cursor completion edit', '.cursor/hooks.json', 'preToolUse', false],
] as const)(
  '%s allows the complete acceptance run before host cancellation',
  (_label, path, event, nested) => {
    const manifest = JSON.parse(readFileSync(nodePath.join(root, path), 'utf8')) as {
      hooks: Record<string, { timeout?: number; hooks?: { timeout?: number }[] }[]>;
    };
    const entry = manifest.hooks[event]?.[0];
    const timeout = nested ? entry?.hooks?.[0]?.timeout : entry?.timeout;

    expect(timeout).toBe(40 * 60);
    expect(Number(timeout) * 1000).toBeGreaterThan(timeoutMsForTestCommand('bdd'));
  },
);
