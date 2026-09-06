import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach } from 'vitest';

type ClaudeStateVariable = 'CLAUDE_CONFIG_DIR' | 'CLAUDE_PLUGIN_DATA' | 'CLAUDE_PROJECT_DIR';

/**
 * Points the native Claude plugin's state at a throwaway config directory.
 *
 * Plugin state lives under `${CLAUDE_PLUGIN_DATA}` rather than in the working
 * tree (issue #3787), so a suite that does not redirect it writes into the
 * developer's real `~/.claude`. `CLAUDE_PROJECT_DIR` is cleared for the same
 * reason: when Safeword's own tests run inside a Claude Code session the host
 * exports it, which would collapse every temporary project root onto one digest
 * and let unrelated cases see each other's state.
 */
export function useIsolatedClaudePluginState(): void {
  let previousConfig: string | undefined;
  let previousProject: string | undefined;
  let previousData: string | undefined;
  let directory: string | undefined;

  beforeEach(() => {
    previousConfig = process.env.CLAUDE_CONFIG_DIR;
    previousProject = process.env.CLAUDE_PROJECT_DIR;
    previousData = process.env.CLAUDE_PLUGIN_DATA;
    directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-config-'));
    process.env.CLAUDE_CONFIG_DIR = directory;
    clear('CLAUDE_PROJECT_DIR');
    clear('CLAUDE_PLUGIN_DATA');
  });

  afterEach(() => {
    restore('CLAUDE_CONFIG_DIR', previousConfig);
    restore('CLAUDE_PROJECT_DIR', previousProject);
    restore('CLAUDE_PLUGIN_DATA', previousData);
    if (directory !== undefined) rmSync(directory, { recursive: true, force: true });
    directory = undefined;
  });
}

function restore(name: ClaudeStateVariable, value: string | undefined): void {
  if (value === undefined) clear(name);
  else process.env[name] = value;
}

function clear(name: ClaudeStateVariable): void {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- the key is one of three literals
  delete process.env[name];
}
