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

const TOML_HOOK_KEYS = ['hooks', '"hooks"', "'hooks'"] as const;
type ParsedHookHeader = { event: string; kind: 'parent' | 'nested' };

function hookHeaderEntries(event: string): [string, ParsedHookHeader][] {
  const eventKeys = [event, `"${event}"`, `'${event}'`];
  return TOML_HOOK_KEYS.flatMap(hookKey =>
    eventKeys.flatMap(eventKey => [
      [`[[${hookKey}.${eventKey}]]`, { event, kind: 'parent' }],
      ...TOML_HOOK_KEYS.map(
        nestedHookKey =>
          [`[[${hookKey}.${eventKey}.${nestedHookKey}]]`, { event, kind: 'nested' }] as [
            string,
            ParsedHookHeader,
          ],
      ),
    ]),
  ) as [string, ParsedHookHeader][];
}

const HOOK_HEADER_LOOKUP = new Map(
  [...KNOWN_HOOK_EVENTS].flatMap(event => hookHeaderEntries(event)),
);

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

function hookHeader(line: string): ParsedHookHeader | undefined {
  return HOOK_HEADER_LOOKUP.get(uncommented(line).replaceAll(/\s+/gu, ''));
}

function eventHeader(line: string): string | undefined {
  const header = hookHeader(line);
  return header?.kind === 'parent' ? header.event : undefined;
}

function isNestedHookHeader(line: string, event: string): boolean {
  const header = hookHeader(line);
  return header?.kind === 'nested' && header.event === event;
}

function startsNewTopLevelSection(line: string, event: string): boolean {
  const header = uncommented(line);
  return header.startsWith('[') && !isNestedHookHeader(line, event);
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

function sectionEnd(lines: string[], start: number, event: string): number {
  let end = start + 1;
  while (end < lines.length && !startsNewTopLevelSection(lines[end] ?? '', event)) end += 1;
  return end;
}

function nestedHookStarts(lines: string[], start: number, end: number, event: string): number[] {
  const starts: number[] = [];
  for (let index = start + 1; index < end; index += 1) {
    if (isNestedHookHeader(lines[index] ?? '', event)) starts.push(index);
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
  // Unknown parent metadata is user-owned. Preserve that now-inert scaffold
  // and remove only the recognized Safe Word child block.
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
    const end = sectionEnd(lines, cursor, event);
    removals.push(...eventRemovalRanges(lines, cursor, end, event));
    cursor = end;
  }
  return removals;
}

function tomlObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function semanticNestedHookCount(value: unknown): number {
  const command = tomlObject(value)?.command;
  return typeof command === 'string' && legacyCommandIdentity(command) !== undefined ? 1 : 0;
}

function semanticParentHookCount(value: unknown): number {
  const nestedHooks = tomlObject(value)?.hooks;
  return Array.isArray(nestedHooks)
    ? nestedHooks.reduce<number>((count, hook) => count + semanticNestedHookCount(hook), 0)
    : 0;
}

function semanticEventHookCount(value: unknown): number {
  return Array.isArray(value)
    ? value.reduce<number>((count, parent) => count + semanticParentHookCount(parent), 0)
    : 0;
}

function semanticLegacyCommandCounts(document: unknown): Map<string, number> {
  const counts = new Map<string, number>();
  const hooks = tomlObject(tomlObject(document)?.hooks);
  if (hooks === undefined) return counts;
  for (const event of KNOWN_HOOK_EVENTS) {
    const count = semanticEventHookCount(hooks[event]);
    if (count > 0) counts.set(event, count);
  }
  return counts;
}

function sourceLegacyCommandCounts(lines: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  let cursor = 0;
  while (cursor < lines.length) {
    const event = eventHeader(lines[cursor] ?? '');
    if (event === undefined) {
      cursor += 1;
      continue;
    }
    const end = sectionEnd(lines, cursor, event);
    const count = nestedHookStarts(lines, cursor, end, event)
      .flatMap((start, index, starts) =>
        blockCommandValues(lines, { start, end: starts[index + 1] ?? end }),
      )
      .filter(command => legacyCommandIdentity(command) !== undefined).length;
    if (count > 0) counts.set(event, (counts.get(event) ?? 0) + count);
    cursor = end;
  }
  return counts;
}

function countsMatch(left: Map<string, number>, right: Map<string, number>): boolean {
  for (const event of KNOWN_HOOK_EVENTS) {
    if ((left.get(event) ?? 0) !== (right.get(event) ?? 0)) return false;
  }
  return true;
}

function prepareLegacyCodexHookBlocks(content: string): {
  cleaned: string;
  removedBlocks: string[];
} {
  let document: unknown;
  try {
    document = parse(content);
  } catch (error) {
    throw new Error('Codex configuration is invalid TOML; no legacy hooks were removed.', {
      cause: error,
    });
  }

  const lines = splitLines(content);
  if (!countsMatch(semanticLegacyCommandCounts(document), sourceLegacyCommandCounts(lines))) {
    throw new Error(
      'Codex configuration uses unsupported Safe Word hook formatting; no legacy hooks were removed.',
    );
  }
  const ranges = removalRanges(lines);
  const removedBlocks = ranges.map(range => lines.slice(range.start, range.end).join(''));
  const reverseOrderedRanges = ranges.toSorted((left, right) => right.start - left.start);
  for (const range of reverseOrderedRanges) {
    lines.splice(range.start, range.end - range.start);
  }
  return { cleaned: lines.join(''), removedBlocks };
}

type CodexConfigMetadata = { kind: 'missing' } | { kind: 'regular'; metadata: Stats };

export class CodexConfigObservationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CodexConfigObservationError';
  }
}

function metadataOrMissing(path: string): Stats | undefined {
  try {
    return lstatSync(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return undefined;
    throw error;
  }
}

function unsafeConfigEntry(
  label: 'Codex configuration' | 'Codex configuration directory',
  metadata: Stats,
  operation: 'cleanup' | 'observe',
): never {
  let kind = 'not a regular file';
  if (metadata.isSymbolicLink()) kind = 'a symbolic link';
  else if (label === 'Codex configuration directory') kind = 'not an ordinary directory';
  if (operation === 'observe') {
    throw new CodexConfigObservationError(`${label} is ${kind} and cannot be observed safely.`);
  }
  throw new Error(`${label} is ${kind}; no legacy hooks were removed.`);
}

export function regularCodexConfigMetadata(
  configPath: string,
  operation: 'cleanup' | 'observe' = 'cleanup',
): CodexConfigMetadata {
  const directoryMetadata = metadataOrMissing(nodePath.dirname(configPath));
  if (directoryMetadata === undefined) return { kind: 'missing' };
  if (!directoryMetadata.isDirectory()) {
    unsafeConfigEntry('Codex configuration directory', directoryMetadata, operation);
  }

  const metadata = metadataOrMissing(configPath);
  if (metadata === undefined) return { kind: 'missing' };
  if (!metadata.isFile()) unsafeConfigEntry('Codex configuration', metadata, operation);
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

export function observeLegacyEvents(cwd: string): string[] {
  const configPath = nodePath.join(cwd, CODEX_MIGRATION_SCHEMA.paths.config);
  if (regularCodexConfigMetadata(configPath, 'observe').kind === 'missing') return [];
  try {
    return semanticLegacyCommandCounts(parse(readFileSync(configPath, 'utf8')))
      .keys()
      .toArray()
      .toSorted((left, right) => left.localeCompare(right));
  } catch (error) {
    if (error instanceof CodexConfigObservationError) throw error;
    throw new CodexConfigObservationError('Codex configuration cannot be read or parsed safely.', {
      cause: error,
    });
  }
}
