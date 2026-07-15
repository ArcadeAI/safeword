import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { info, success } from '../utils/output.js';

const MARKETPLACE_SOURCE = 'ArcadeAI/safeword';
const PLUGIN_ID = 'safeword@safeword';
const CODEX_CONFIG_PATH = '.codex/config.toml';
const LEGACY_CONFIG_BACKUP_SUFFIX = '.safeword.bak';
const TOML_END_MARKER = '\0';
const CODEX_HOOK_EVENT_BLOCK =
  /^\[\[hooks\.\w+\]\][\s\S]*?(?=^\[\[hooks\.\w+\]\]|^\[(?!\[hooks\.)|\0)/gmu;
const CODEX_NESTED_HOOK_BLOCK =
  /^\[\[hooks\.\w+\.\w+\]\][\s\S]*?(?=^\[\[hooks\.\w+\.\w+\]\]|(?![\s\S]))/gmu;

type CodexPluginList = {
  installed?: { enabled?: boolean; pluginId?: string }[];
};

function run(command: string, arguments_: string[]): string {
  const result = spawnSync(command, arguments_, { encoding: 'utf8' });
  if (result.error)
    throw new Error(`${command} is required. Install it, then re-run this command.`);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout).trim();
    throw new Error(detail || `${command} ${arguments_.join(' ')} failed.`);
  }
  return result.stdout;
}

function pluginIsEnabled(output: string): boolean {
  const parsed = JSON.parse(output) as CodexPluginList;
  return (
    parsed.installed?.some(plugin => plugin.pluginId === PLUGIN_ID && plugin.enabled === true) ??
    false
  );
}

function isSafewordHookBlock(block: string): boolean {
  return [
    'safeword hook codex',
    '.safeword/hooks/codex/',
    '.safeword/hooks/session-codex-start.ts',
    'session-safeword-context.ts" --agent=codex',
  ].some(marker => block.includes(marker));
}

function removeLegacyCodexHooks(content: string): string {
  const withEndMarker = `${content}${TOML_END_MARKER}`;
  return withEndMarker
    .replaceAll(CODEX_HOOK_EVENT_BLOCK, eventBlock => {
      const nestedBlocks = eventBlock.matchAll(CODEX_NESTED_HOOK_BLOCK).toArray();
      if (nestedBlocks.length === 0) return isSafewordHookBlock(eventBlock) ? '' : eventBlock;

      const legacyNestedBlocks = nestedBlocks.filter(([nestedBlock]) =>
        isSafewordHookBlock(nestedBlock),
      );
      if (legacyNestedBlocks.length === 0) return eventBlock;

      const firstNestedBlock = nestedBlocks[0];
      if (!firstNestedBlock) return eventBlock;
      const parentBlock = eventBlock.slice(0, firstNestedBlock.index);
      const retainedNestedBlocks = nestedBlocks
        .filter(([nestedBlock]) => !isSafewordHookBlock(nestedBlock))
        .map(([nestedBlock]) => nestedBlock);

      return retainedNestedBlocks.length === 0
        ? ''
        : `${parentBlock}${retainedNestedBlocks.join('')}`;
    })
    .slice(0, -TOML_END_MARKER.length);
}

function removeLegacyHooks(cwd: string): { removed: boolean; backupCreated: boolean } {
  const configPath = nodePath.join(cwd, CODEX_CONFIG_PATH);
  if (!existsSync(configPath)) return { removed: false, backupCreated: false };
  const original = readFileSync(configPath, 'utf8');
  const cleaned = removeLegacyCodexHooks(original);
  if (cleaned === original) return { removed: false, backupCreated: false };

  const backupPath = `${configPath}${LEGACY_CONFIG_BACKUP_SUFFIX}`;
  const backupCreated = !existsSync(backupPath);
  if (backupCreated) writeFileSync(backupPath, original);
  writeFileSync(configPath, cleaned);
  return { removed: true, backupCreated };
}

export function migrateCodexPlugin(cwd = process.cwd()): void {
  run('bun', ['--version']);
  run('codex', ['--version']);
  run('codex', [
    'plugin',
    'marketplace',
    'add',
    MARKETPLACE_SOURCE,
    '--sparse',
    '.agents/plugins',
    '--sparse',
    'packages/cli/codex-plugin',
    '--json',
  ]);
  run('codex', ['plugin', 'add', PLUGIN_ID, '--json']);

  let pluginList: string;
  try {
    pluginList = run('codex', ['plugin', 'list', '--json']);
  } catch (error) {
    throw new Error(`Could not verify the Safe Word Codex plugin: ${String(error)}`, {
      cause: error,
    });
  }
  if (!pluginIsEnabled(pluginList)) {
    throw new Error(
      'Codex did not report the Safe Word plugin as enabled. Enable safeword@safeword, then re-run this command; project hooks were left unchanged.',
    );
  }

  const cleanup = removeLegacyHooks(cwd);
  success('Safe Word Codex plugin is enabled for this profile.');
  if (cleanup.backupCreated) {
    info('Backed up the legacy Codex configuration to .codex/config.toml.safeword.bak.');
  }
  info(
    cleanup.removed
      ? 'Removed Safe Word legacy Codex hooks from this project.'
      : 'No Safe Word legacy Codex hooks were found in this project.',
  );
}
