import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { parse } from 'smol-toml';

import { info, success } from '../utils/output.js';

const MARKETPLACE_SOURCE = 'ArcadeAI/safeword';
const PLUGIN_ID = 'safeword@safeword';
const CODEX_CONFIG_PATH = '.codex/config.toml';
const LEGACY_CONFIG_BACKUP_SUFFIX = '.safeword.bak';
const KNOWN_HOOK_EVENTS = new Set([
  'SessionStart',
  'SubagentStart',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'PreCompact',
  'PostCompact',
  'UserPromptSubmit',
  'SubagentStop',
  'Stop',
]);
const LEGACY_SAFEWORD_HOOK_EVENTS = new Set([
  'session-start',
  'user-prompt-submit',
  'pre-tool-use',
  'post-tool-use',
  'stop',
]);
const LEGACY_SAFEWORD_HOOK_SCRIPTS = new Set([
  'session-codex-start.ts',
  'session-safeword-context.ts',
  'prompt-timestamp.ts',
  'prompt-retro-nudge.ts',
  'codex/pre-tool-quality.ts',
  'codex/stop.ts',
  'codex/post-tool-skill-nudge.ts',
  'codex/post-tool-quality.ts',
]);
const LEGACY_SAFEWORD_HOOK_PREFIX = 'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/';

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

interface TextRange {
  start: number;
  end: number;
}

interface HookBlock {
  range: TextRange;
  safeWordOwned: boolean;
  safeWordAmbiguous: boolean;
}

function splitLines(content: string): string[] {
  if (content === '') return [];
  const lines = content.split('\n');
  return lines.map((line, index) => (index < lines.length - 1 ? `${line}\n` : line));
}

function uncommented(line: string): string {
  const comment = line.indexOf('#');
  return (comment === -1 ? line : line.slice(0, comment)).trim();
}

function eventHeader(line: string): string | undefined {
  const header = uncommented(line);
  if (!header.startsWith('[[hooks.') || !header.endsWith(']]')) return undefined;
  const event = header.slice('[[hooks.'.length, -2);
  return KNOWN_HOOK_EVENTS.has(event) ? event : undefined;
}

function startsNewTopLevelSection(line: string): boolean {
  const header = uncommented(line);
  return header.startsWith('[') && !header.endsWith('.hooks]]');
}

function assignmentValue(line: string, key: string): string | undefined {
  const equals = line.indexOf('=');
  if (equals === -1 || line.slice(0, equals).trim() !== key) return undefined;
  return line.slice(equals + 1).trim();
}

function quotedValue(value: string): string | undefined {
  const quote = value[0];
  if (quote !== '"' && quote !== "'") return undefined;

  for (let index = 1; index < value.length; index += 1) {
    const character = value[index];
    if (quote === '"' && character === '\\') {
      index += 1;
      continue;
    }
    if (character !== quote) continue;
    const trailing = value.slice(index + 1).trim();
    return trailing === '' || trailing.startsWith('#') ? value.slice(1, index) : undefined;
  }
  return undefined;
}

function bareCommandValue(line: string): string | undefined {
  const value = assignmentValue(line, 'command');
  return value === undefined ? undefined : quotedValue(value);
}

function commandParts(command: string): string[] {
  return command
    .trim()
    .split(' ')
    .filter(part => part !== '');
}

function isNpxSafeWordCommand(parts: string[]): boolean {
  return parts[0] === 'npx' && parts[1] === '--yes' && parts[2] === 'safeword';
}

function safeWordCommandOffset(parts: string[]): number | undefined {
  // Only project-local npx hooks were historically installed by Safe Word.
  // Bunx commands belong to the profile plugin, and bare `safeword` commands
  // may be user-authored, so neither can be retired automatically.
  if (isNpxSafeWordCommand(parts)) return 2;
  return undefined;
}

function isSafeWordHookCommand(parts: string[], offset: number): boolean {
  const hook = parts.slice(offset + 1);
  return (
    hook.length === 3 &&
    hook[0] === 'hook' &&
    hook[1] === 'codex' &&
    LEGACY_SAFEWORD_HOOK_EVENTS.has(hook[2] ?? '')
  );
}

function isLegacySafeWordHookAlias(parts: string[], offset: number): boolean {
  const hook = parts.slice(offset + 1);
  return (
    hook.length === 2 && hook[0] === 'codex-hook' && LEGACY_SAFEWORD_HOOK_EVENTS.has(hook[1] ?? '')
  );
}

function isPackagedSafeWordCommand(command: string): boolean {
  const parts = commandParts(command);
  const offset = safeWordCommandOffset(parts);
  return (
    offset !== undefined &&
    (isSafeWordHookCommand(parts, offset) || isLegacySafeWordHookAlias(parts, offset))
  );
}

function isLegacySafeWordHookScript(command: string): boolean {
  if (!command.startsWith(LEGACY_SAFEWORD_HOOK_PREFIX)) return false;
  const scriptAndArguments = command.slice(LEGACY_SAFEWORD_HOOK_PREFIX.length);
  const scriptEnd = scriptAndArguments.indexOf('"');
  if (scriptEnd === -1) return false;

  const script = scriptAndArguments.slice(0, scriptEnd);
  const arguments_ = scriptAndArguments.slice(scriptEnd + 1);
  return (
    LEGACY_SAFEWORD_HOOK_SCRIPTS.has(script) &&
    (arguments_ === '' ||
      (script === 'session-safeword-context.ts' && arguments_ === ' --agent=codex'))
  );
}

function isSafeWordCommand(command: string): boolean {
  return isPackagedSafeWordCommand(command) || isLegacySafeWordHookScript(command);
}

function blockCommandValues(lines: string[], range: TextRange): string[] {
  const commands: string[] = [];
  for (let index = range.start + 1; index < range.end; index += 1) {
    const command = bareCommandValue(lines[index] ?? '');
    if (command !== undefined) commands.push(command);
  }
  return commands;
}

function allowedHookLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('#')) return true;
  const type = quotedValue(assignmentValue(line, 'type') ?? '');
  if (type === 'command') return true;
  if (bareCommandValue(line) !== undefined) return true;
  if (quotedValue(assignmentValue(line, 'statusMessage') ?? '') !== undefined) return true;
  const timeout = assignmentValue(line, 'timeout');
  return timeout !== undefined && Number.isSafeInteger(Number(timeout));
}

function containsOnlyAllowedHookLines(lines: string[], range: TextRange): boolean {
  for (let index = range.start + 1; index < range.end; index += 1) {
    if (!allowedHookLine(lines[index] ?? '')) return false;
  }
  return true;
}

function classifyHookBlock(lines: string[], range: TextRange): HookBlock {
  const commands = blockCommandValues(lines, range);
  const safeWordCommand = commands.some(command => isSafeWordCommand(command));
  const safeWordAmbiguous =
    safeWordCommand && (commands.length !== 1 || !containsOnlyAllowedHookLines(lines, range));
  return {
    range,
    safeWordOwned:
      commands.length === 1 && isSafeWordCommand(commands[0] ?? '') && !safeWordAmbiguous,
    safeWordAmbiguous,
  };
}

function isKnownParentScaffold(lines: string[], range: TextRange): boolean {
  for (let index = range.start + 1; index < range.end; index += 1) {
    const trimmed = (lines[index] ?? '').trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    if (quotedValue(assignmentValue(lines[index] ?? '', 'matcher') ?? '') === undefined)
      return false;
  }
  return true;
}

function sectionEnd(lines: string[], start: number): number {
  let end = start + 1;
  while (end < lines.length && !startsNewTopLevelSection(lines[end] ?? '')) end += 1;
  return end;
}

function nestedHookStarts(lines: string[], start: number, end: number, event: string): number[] {
  const starts: number[] = [];
  for (let index = start + 1; index < end; index += 1) {
    if (uncommented(lines[index] ?? '') === `[[hooks.${event}.hooks]]`) starts.push(index);
  }
  return starts;
}

function eventRemovalRanges(
  lines: string[],
  start: number,
  end: number,
  event: string,
): TextRange[] {
  const nestedStarts = nestedHookStarts(lines, start, end, event);
  if (nestedStarts.length === 0) return [];
  const blocks = nestedStarts.map((nestedStart, index) =>
    classifyHookBlock(lines, { start: nestedStart, end: nestedStarts[index + 1] ?? end }),
  );
  if (blocks.some(block => block.safeWordAmbiguous)) {
    throw new Error(
      'Legacy Safe Word hook cleanup found an ambiguous hook block; no changes were made.',
    );
  }
  const ownedBlocks = blocks.filter(block => block.safeWordOwned);
  if (ownedBlocks.length === 0) return [];
  const parentRange = { start, end: nestedStarts[0] ?? end };
  return ownedBlocks.length === blocks.length && isKnownParentScaffold(lines, parentRange)
    ? [{ start, end }]
    : ownedBlocks.map(block => block.range);
}

function removalRanges(lines: string[]): TextRange[] {
  const removals: TextRange[] = [];
  let cursor = 0;
  while (cursor < lines.length) {
    const event = eventHeader(lines[cursor] ?? '');
    if (event === undefined) {
      cursor += 1;
      continue;
    }
    const end = sectionEnd(lines, cursor);
    removals.push(...eventRemovalRanges(lines, cursor, end, event));
    cursor = end;
  }
  return removals;
}

function removeLegacyCodexHooks(content: string): string {
  try {
    parse(content);
  } catch (error) {
    throw new Error('Codex configuration is invalid TOML; no legacy hooks were removed.', {
      cause: error,
    });
  }

  const lines = splitLines(content);
  const orderedRanges = removalRanges(lines).toSorted((left, right) => right.start - left.start);
  for (const range of orderedRanges) {
    lines.splice(range.start, range.end - range.start);
  }
  return lines.join('');
}

function durableTemporaryPath(directory: string, filename: string): string {
  return nodePath.join(directory, `.${filename}.safeword-${process.pid}-${randomUUID()}.tmp`);
}

function writeDurableFile(path: string, content: string, mode: number): void {
  const descriptor = openSync(path, 'wx', mode);
  try {
    writeFileSync(descriptor, content);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function backupAndReplace(configPath: string, original: string, cleaned: string): void {
  const directory = nodePath.dirname(configPath);
  const filename = nodePath.basename(configPath);
  const mode = statSync(configPath).mode & 0o777;
  const backupPath = `${configPath}${LEGACY_CONFIG_BACKUP_SUFFIX}`;
  if (existsSync(backupPath)) {
    throw new Error(`Legacy Codex backup already exists at ${backupPath}; no hooks were removed.`);
  }

  const backupTemporaryPath = durableTemporaryPath(directory, filename);
  try {
    writeDurableFile(backupTemporaryPath, original, mode);
    linkSync(backupTemporaryPath, backupPath);
  } finally {
    rmSync(backupTemporaryPath, { force: true });
  }

  const outputTemporaryPath = durableTemporaryPath(directory, filename);
  try {
    writeDurableFile(outputTemporaryPath, cleaned, mode);
    renameSync(outputTemporaryPath, configPath);
  } catch (error) {
    rmSync(outputTemporaryPath, { force: true });
    throw error;
  }
}

interface PreparedLegacyHookRemoval {
  configPath: string;
  original: string;
  cleaned: string;
}

function prepareLegacyHookRemoval(cwd: string): PreparedLegacyHookRemoval | undefined {
  const configPath = nodePath.join(cwd, CODEX_CONFIG_PATH);
  if (!existsSync(configPath)) return undefined;
  const original = readFileSync(configPath, 'utf8');
  const cleaned = removeLegacyCodexHooks(original);
  if (cleaned === original) return undefined;

  return { configPath, original, cleaned };
}

function removePreparedLegacyHooks(removal: PreparedLegacyHookRemoval): void {
  if (!existsSync(removal.configPath)) {
    throw new Error(
      'Codex configuration changed during plugin installation; no legacy hooks were removed.',
    );
  }
  if (readFileSync(removal.configPath, 'utf8') !== removal.original) {
    throw new Error(
      'Codex configuration changed during plugin installation; no legacy hooks were removed.',
    );
  }
  backupAndReplace(removal.configPath, removal.original, removal.cleaned);
}

export function migrateCodexPlugin(
  cwd = process.cwd(),
  // The CLI always uses MARKETPLACE_SOURCE. The source override lets the live
  // test validate a pushed release branch before its marketplace reaches main.
  options: { marketplaceSource?: string; removeLegacyHooks?: boolean } = {},
): void {
  // Validate the requested handoff before installing a profile plugin. A malformed
  // project config must leave both the project and the Codex profile unchanged.
  const preparedLegacyHookRemoval = options.removeLegacyHooks
    ? prepareLegacyHookRemoval(cwd)
    : undefined;

  run('bun', ['--version']);
  run('codex', ['--version']);
  run('codex', [
    'plugin',
    'marketplace',
    'add',
    options.marketplaceSource ?? MARKETPLACE_SOURCE,
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

  success('Safe Word Codex plugin is enabled for this profile.');
  if (!options.removeLegacyHooks) {
    info(
      'Legacy project hooks were left unchanged. Review the Safe Word plugin hooks in Codex with /hooks, then run `safeword migrate codex-plugin --remove-legacy-hooks` to complete the handoff.',
    );
    return;
  }

  const removedLegacyHooks = preparedLegacyHookRemoval !== undefined;
  if (removedLegacyHooks) {
    removePreparedLegacyHooks(preparedLegacyHookRemoval);
    info('Backed up the legacy Codex configuration to .codex/config.toml.safeword.bak.');
  }
  info(
    removedLegacyHooks
      ? 'Removed Safe Word legacy Codex hook configuration from this project. Legacy runtime files were preserved.'
      : 'No Safe Word legacy Codex hooks were found in this project.',
  );
}
