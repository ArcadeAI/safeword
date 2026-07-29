import { lstatSync, readFileSync, type Stats } from 'node:fs';
import nodePath from 'node:path';

import { parse } from 'smol-toml';

import { CODEX_MIGRATION_SCHEMA } from './inventory.js';
import { legacyCommandIdentity } from './legacy-command.js';

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
  const safeWordCommand = commands.some(command => legacyCommandIdentity(command) !== undefined);
  const safeWordAmbiguous =
    safeWordCommand && (commands.length !== 1 || !containsOnlyAllowedHookLines(lines, range));
  return {
    range,
    safeWordOwned:
      commands.length === 1 &&
      legacyCommandIdentity(commands[0] ?? '') !== undefined &&
      !safeWordAmbiguous,
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

function prepareLegacyCodexHookBlocks(content: string): {
  cleaned: string;
  removedBlocks: string[];
} {
  try {
    parse(content);
  } catch (error) {
    throw new Error('Codex configuration is invalid TOML; no legacy hooks were removed.', {
      cause: error,
    });
  }

  const lines = splitLines(content);
  const ranges = removalRanges(lines);
  const removedBlocks = ranges.map(range => lines.slice(range.start, range.end).join(''));
  const reverseOrderedRanges = ranges.toSorted((left, right) => right.start - left.start);
  for (const range of reverseOrderedRanges) {
    lines.splice(range.start, range.end - range.start);
  }
  return { cleaned: lines.join(''), removedBlocks };
}

type CodexConfigMetadata = { kind: 'missing' } | { kind: 'regular'; metadata: Stats };

export function regularCodexConfigMetadata(configPath: string): CodexConfigMetadata {
  let metadata;
  try {
    metadata = lstatSync(configPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return { kind: 'missing' };
    throw error;
  }

  if (!metadata.isFile()) {
    const kind = metadata.isSymbolicLink() ? 'a symbolic link' : 'not a regular file';
    throw new Error(`Codex configuration is ${kind}; no legacy hooks were removed.`);
  }
  return { kind: 'regular', metadata };
}

export interface PreparedLegacyHookRemoval {
  configPath: string;
  original: string;
  cleaned: string;
  removedBlocks: string[];
}

export function prepareLegacyHookRemoval(cwd: string): PreparedLegacyHookRemoval | undefined {
  const configPath = nodePath.join(cwd, CODEX_MIGRATION_SCHEMA.paths.config);
  if (regularCodexConfigMetadata(configPath).kind === 'missing') return;
  const original = readFileSync(configPath, 'utf8');
  const { cleaned, removedBlocks } = prepareLegacyCodexHookBlocks(original);
  if (cleaned === original) return undefined;
  return { configPath, original, cleaned, removedBlocks };
}

function pathExistsIncludingDanglingSymlink(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return false;
    throw error;
  }
}

export function observeLegacyEvents(cwd: string): string[] {
  const configPath = nodePath.join(cwd, CODEX_MIGRATION_SCHEMA.paths.config);
  if (!pathExistsIncludingDanglingSymlink(configPath)) return [];
  const lines = splitLines(readFileSync(configPath, 'utf8'));
  const events = new Set<string>();
  let cursor = 0;
  while (cursor < lines.length) {
    const event = eventHeader(lines[cursor] ?? '');
    if (event === undefined) {
      cursor += 1;
      continue;
    }
    const end = sectionEnd(lines, cursor);
    const commands = nestedHookStarts(lines, cursor, end, event).flatMap((start, index, starts) =>
      blockCommandValues(lines, { start, end: starts[index + 1] ?? end }),
    );
    if (commands.some(command => legacyCommandIdentity(command) !== undefined)) events.add(event);
    cursor = end;
  }
  return [...events].toSorted((left, right) => left.localeCompare(right));
}
