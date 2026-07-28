/* eslint-disable unicorn/no-null -- schema-1 migration JSON uses explicit null */

import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, type Stats } from 'node:fs';
import nodePath from 'node:path';

import { parse } from 'smol-toml';

import {
  applyCodexFinalization,
  codexFinalizationIsComplete,
  type CodexFinalizationMutation,
  codexRecoveryIsRequired,
  recoverCodexFinalization,
  resolveCodexFinalizationConfirmation,
  validateCodexFinalizationPaths,
} from '../codex-plugin/finalization.js';
import { legacyCodexEventIsViable } from '../codex-plugin/legacy-authority.js';
import {
  codexMigrationExitCode,
  type CodexMigrationResultV1,
  type CodexPluginObservation,
  deriveCodexMigrationResult,
  renderCodexMigrationHuman,
} from '../codex-plugin/migration.js';
import {
  codexRestartIsPending,
  observeCodexHookProof,
  writeCodexRestartMarker,
} from '../codex-plugin/profile-proof.js';
import { SAFEWORD_SCHEMA } from '../schema.js';
import { info, success } from '../utils/output.js';

const MARKETPLACE_SOURCE = 'ArcadeAI/safeword';
const PLUGIN_ID = 'safeword@safeword';
const CODEX_CONFIG_PATH = '.codex/config.toml';
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
const LEGACY_SAFEWORD_HOOK_EVENTS = new Set(SAFEWORD_SCHEMA.codexMigration.hookEvents);
const LEGACY_SAFEWORD_HOOK_SCRIPTS = new Set(SAFEWORD_SCHEMA.codexMigration.hookScripts);
const LEGACY_SAFEWORD_HOOK_PREFIX = SAFEWORD_SCHEMA.codexMigration.hookScriptPrefix;

type CodexPluginList = {
  installed?: { enabled?: boolean; pluginId?: string; version?: string }[];
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

function observeCodexPlugin(): CodexPluginObservation {
  const parsed = JSON.parse(run('codex', ['plugin', 'list', '--json'])) as CodexPluginList;
  const plugin = parsed.installed?.find(candidate => candidate.pluginId === PLUGIN_ID);
  return {
    installed: plugin !== undefined,
    enabled: plugin?.enabled ?? (plugin === undefined ? false : null),
    version: plugin?.version ?? null,
    observation: 'observed',
  };
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
  return (
    parts[0] === SAFEWORD_SCHEMA.codexMigration.packageRunner &&
    parts[1] === '--yes' &&
    parts[2] === 'safeword'
  );
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

function regularCodexConfigMetadata(configPath: string): CodexConfigMetadata {
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

interface PreparedLegacyHookRemoval {
  configPath: string;
  original: string;
  cleaned: string;
  removedBlocks: string[];
}

function prepareLegacyHookRemoval(cwd: string): PreparedLegacyHookRemoval | undefined {
  const configPath = nodePath.join(cwd, CODEX_CONFIG_PATH);
  if (regularCodexConfigMetadata(configPath).kind === 'missing') return;
  const original = readFileSync(configPath, 'utf8');
  const { cleaned, removedBlocks } = prepareLegacyCodexHookBlocks(original);
  if (cleaned === original) return undefined;

  return { configPath, original, cleaned, removedBlocks };
}

function addCodexPluginToProfile(marketplaceSource: string | undefined): void {
  run('codex', [
    'plugin',
    'marketplace',
    'add',
    marketplaceSource ?? MARKETPLACE_SOURCE,
    '--sparse',
    '.agents/plugins',
    '--sparse',
    'packages/cli/codex-plugin',
    '--json',
  ]);
  run('codex', ['plugin', 'add', PLUGIN_ID, '--json']);
}

function verifyCodexPluginIsEnabled(options: { installationCompleted?: boolean } = {}): void {
  let pluginList: string;
  try {
    pluginList = run('codex', ['plugin', 'list', '--json']);
  } catch (error) {
    const prefix =
      options.installationCompleted === true
        ? 'Plugin installation succeeded, but enablement is unknown'
        : 'Could not verify the Safe Word Codex plugin';
    throw new Error(`${prefix}: ${String(error)}`, { cause: error });
  }
  if (!pluginIsEnabled(pluginList)) {
    throw new Error(
      'Codex did not report the Safe Word plugin as enabled. Enable safeword@safeword, then re-run this command; project hooks were left unchanged.',
    );
  }
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

function observeLegacyAssets(cwd: string): string[] {
  return SAFEWORD_SCHEMA.codexMigration.legacyFiles.filter(path =>
    pathExistsIncludingDanglingSymlink(nodePath.join(cwd, path)),
  );
}

function observeLegacyEvents(cwd: string): string[] {
  const configPath = nodePath.join(cwd, CODEX_CONFIG_PATH);
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
    if (commands.some(command => isSafeWordCommand(command))) events.add(event);
    cursor = end;
  }
  return [...events].toSorted((left, right) => left.localeCompare(right));
}

function observeViableLegacyEvents(
  cwd: string,
  legacyEvents: string[],
  environment: NodeJS.ProcessEnv,
): string[] {
  const eventIdsByName = new Map(
    Object.entries(SAFEWORD_SCHEMA.codexMigration.hookEventNames).map(([event, name]) => [
      name,
      event,
    ]),
  );
  return legacyEvents.filter(eventName => {
    const event = eventIdsByName.get(eventName);
    return event !== undefined && legacyCodexEventIsViable(cwd, event, environment);
  });
}

function observeCodexMigrationResult(
  cwd = process.cwd(),
  environment: NodeJS.ProcessEnv = process.env,
): CodexMigrationResultV1 {
  const legacyEvents = observeLegacyEvents(cwd);
  const recoveryRequired = codexRecoveryIsRequired(cwd);
  let plugin: CodexPluginObservation;
  let pluginObservationError: Error | undefined;
  if (recoveryRequired) {
    plugin = { installed: false, enabled: null, version: null, observation: 'unknown' };
  } else {
    try {
      plugin = observeCodexPlugin();
    } catch (error) {
      plugin = { installed: false, enabled: null, version: null, observation: 'unknown' };
      pluginObservationError = error instanceof Error ? error : new Error(String(error));
    }
  }
  const result = deriveCodexMigrationResult({
    plugin,
    proof: observeCodexHookProof(environment),
    legacyAssets: observeLegacyAssets(cwd),
    legacyEvents,
    viableLegacyEvents: observeViableLegacyEvents(cwd, legacyEvents, environment),
    finalized: codexFinalizationIsComplete(cwd),
    recoveryRequired,
    restartPending: codexRestartIsPending(environment),
  });
  if (pluginObservationError !== undefined) {
    result.errors.push({
      code: 'PLUGIN_OBSERVATION_FAILED',
      message: pluginObservationError.message,
      retryable: true,
    });
  }
  return result;
}

export function statusCodexMigration(
  cwd = process.cwd(),
  options: { json?: boolean; environment?: NodeJS.ProcessEnv } = {},
): void {
  const result = observeCodexMigrationResult(cwd, options.environment);

  process.stdout.write(
    options.json === true ? `${JSON.stringify(result)}\n` : renderCodexMigrationHuman(result),
  );
  process.exitCode = codexMigrationExitCode(result);
}

function reportCodexMigration(
  cwd: string,
  options: {
    json?: boolean;
    environment?: NodeJS.ProcessEnv;
    changed?: boolean;
    effects?: CodexMigrationResultV1['effects']['files'];
  },
): void {
  const result = observeCodexMigrationResult(cwd, options.environment);
  result.changed = options.changed === true;
  if (options.effects !== undefined) result.effects.files = options.effects;
  process.stdout.write(
    options.json === true ? `${JSON.stringify(result)}\n` : renderCodexMigrationHuman(result),
  );
  process.exitCode = codexMigrationExitCode(result);
}

export function reportCodexMigrationFailure(
  cwd: string,
  failure: unknown,
  options: {
    code: string;
    environment?: NodeJS.ProcessEnv;
  },
): void {
  const message = failure instanceof Error ? failure.message : String(failure);
  let result: CodexMigrationResultV1;
  try {
    result = observeCodexMigrationResult(cwd, options.environment);
  } catch {
    result = deriveCodexMigrationResult({
      plugin: { installed: false, enabled: null, version: null, observation: 'unknown' },
      proof: {
        status: 'malformed',
        plugin_version: null,
        manifest_sha256: null,
        recorded_at: null,
      },
      legacyAssets: [],
      legacyEvents: [],
      viableLegacyEvents: [],
      finalized: false,
      recoveryRequired: false,
      restartPending: false,
    });
  }
  result.ok = false;
  result.changed = false;
  result.errors.push({
    code: classifyCodexMigrationFailure(message, options.code),
    message,
    retryable: true,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = 1;
}

function classifyCodexMigrationFailure(message: string, fallback: string): string {
  const rules: [RegExp, string][] = [
    [/requires current plugin hook proof/iu, 'FINALIZATION_PROOF_REQUIRED'],
    [/requires confirmation/iu, 'FINALIZATION_CONFIRMATION_REQUIRED'],
    [/ambiguous|cannot safely identify/iu, 'AMBIGUOUS_LEGACY_CONFIG'],
    [/unsafe Codex migration path/iu, 'UNSAFE_MIGRATION_PATH'],
    [/backup already exists/iu, 'BACKUP_EXISTS'],
    [/rollback could not complete/iu, 'ROLLBACK_FAILED'],
    [/recovery conflict/iu, 'RECOVERY_CONFLICT'],
    [/(?:bun|codex) is required/iu, 'CODEX_UNAVAILABLE'],
  ];
  return rules.find(([pattern]) => pattern.test(message))?.[1] ?? fallback;
}

export function previewCodexFinalization(
  cwd = process.cwd(),
  options: { environment?: NodeJS.ProcessEnv } = {},
): void {
  const environment = options.environment ?? process.env;
  const result = observeCodexMigrationResult(cwd, environment);
  if (result.proof.status === 'current') {
    const preparedLegacyHookRemoval = prepareLegacyHookRemoval(cwd);
    result.effects.files = buildCodexFinalizationMutations(cwd, preparedLegacyHookRemoval).map(
      mutation => {
        let action: 'create' | 'update' | 'remove';
        if (mutation.content === null) action = 'remove';
        else if (pathExistsIncludingDanglingSymlink(nodePath.join(cwd, mutation.path))) {
          action = 'update';
        } else action = 'create';
        return { path: mutation.path, action };
      },
    );
  } else {
    result.errors.push({
      code: 'FINALIZATION_PROOF_REQUIRED',
      message:
        'Finalization requires current plugin hook proof. Start a new Codex session, review /hooks, then retry.',
      retryable: true,
    });
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = codexMigrationExitCode(result);
}

export function installCodexPlugin(
  // The CLI always uses MARKETPLACE_SOURCE. The source override lets the live
  // test validate a pushed release branch before its marketplace reaches main.
  options: {
    marketplaceSource?: string;
    reportMigrationState?: boolean;
    recordRestartPending?: boolean;
    json?: boolean;
    cwd?: string;
    environment?: NodeJS.ProcessEnv;
  } = {},
): void {
  const cwd = options.cwd ?? process.cwd();
  if (shouldReportExistingMigrationState(cwd, options)) {
    reportCodexMigration(cwd, { json: options.json, environment: options.environment });
    return;
  }
  run('bun', ['--version']);
  run('codex', ['--version']);
  addCodexPluginToProfile(options.marketplaceSource);
  verifyCodexPluginIsEnabled({ installationCompleted: true });
  if (options.recordRestartPending !== false) writeCodexRestartMarker(options.environment);

  if (options.json !== true) {
    success('Safe Word Codex plugin is enabled for this profile.');
    info(
      'Start a new Codex session to load the plugin skills and hooks. Then review the Safe Word plugin hooks in Codex with /hooks. If this project uses Safe Word legacy hooks, run `safeword codex migrate --remove-legacy-hooks` to remove only those hooks.',
    );
  }
  if (options.reportMigrationState === true) {
    reportCodexMigration(cwd, {
      json: options.json,
      environment: options.environment,
      changed: true,
    });
  }
}

function shouldReportExistingMigrationState(
  cwd: string,
  options: {
    reportMigrationState?: boolean;
    environment?: NodeJS.ProcessEnv;
  },
): boolean {
  if (codexRecoveryIsRequired(cwd)) return true;
  if (options.reportMigrationState !== true) return false;
  return observeCodexMigrationResult(cwd, options.environment).plugin.enabled === true;
}

function buildCodexFinalizationMutations(
  cwd: string,
  preparedLegacyHookRemoval: PreparedLegacyHookRemoval | undefined,
): CodexFinalizationMutation[] {
  const mutations: CodexFinalizationMutation[] = [];
  if (preparedLegacyHookRemoval !== undefined) {
    if (
      regularCodexConfigMetadata(preparedLegacyHookRemoval.configPath).kind === 'missing' ||
      readFileSync(preparedLegacyHookRemoval.configPath, 'utf8') !==
        preparedLegacyHookRemoval.original
    ) {
      throw new Error(
        'Codex configuration changed during plugin verification; no legacy hooks were removed.',
      );
    }
    mutations.push({ path: CODEX_CONFIG_PATH, content: preparedLegacyHookRemoval.cleaned });
  }
  for (const path of observeLegacyAssets(cwd)) mutations.push({ path, content: null });
  mutations.push(
    {
      path: '.safeword/codex-plugin.json',
      content: `${JSON.stringify({ schema_version: 1, mode: 'plugin' })}\n`,
    },
    {
      path: '.agents/skills/safeword-plugin-setup/SKILL.md',
      content:
        '---\nname: safeword-plugin-setup\ndescription: Restore the Safe Word Codex profile plugin for this project.\n---\n\nRun `safeword codex migrate` to install or re-enable the profile plugin. Restart Codex so the plugin loads, then review its hooks with `/hooks`. Run `safeword codex status` to verify this project is protected.\n',
    },
  );
  return mutations;
}

function finalizationEffects(
  cwd: string,
  mutations: CodexFinalizationMutation[],
): CodexMigrationResultV1['effects']['files'] {
  return mutations.map(mutation => {
    let action: 'create' | 'update' | 'remove';
    if (mutation.content === null) action = 'remove';
    else if (pathExistsIncludingDanglingSymlink(nodePath.join(cwd, mutation.path)))
      action = 'update';
    else action = 'create';
    return { path: mutation.path, action };
  });
}

function renderCodexFinalizationPlan(
  cwd: string,
  mutations: CodexFinalizationMutation[],
  preparedLegacyHookRemoval: PreparedLegacyHookRemoval | undefined,
): string {
  const lines = ['Finalization plan:'];
  for (const effect of finalizationEffects(cwd, mutations)) {
    lines.push(`- ${effect.action} ${effect.path}`);
    if (effect.path !== CODEX_CONFIG_PATH || preparedLegacyHookRemoval === undefined) continue;
    for (const block of preparedLegacyHookRemoval.removedBlocks) {
      lines.push(
        '  exact config block:',
        '  --- begin block ---',
        block.trimEnd(),
        '  --- end block ---',
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

type FinalizationInputSnapshot = {
  path: string;
  state: 'absent' | 'file';
  mode?: number;
  content?: string;
}[];

function snapshotCodexFinalizationInputs(
  cwd: string,
  mutations: CodexFinalizationMutation[],
): FinalizationInputSnapshot {
  validateCodexFinalizationPaths(cwd, mutations);
  return mutations.map(mutation => {
    const path = nodePath.join(cwd, mutation.path);
    let metadata: Stats;
    try {
      metadata = lstatSync(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { path: mutation.path, state: 'absent' };
      }
      throw error;
    }
    if (!metadata.isFile()) {
      throw new Error(`Unsafe Codex migration path is not a regular file: ${mutation.path}`);
    }
    return {
      path: mutation.path,
      state: 'file',
      mode: metadata.mode & 0o777,
      content: readFileSync(path).toString('base64'),
    };
  });
}

function assertCodexFinalizationPlanUnchanged(
  cwd: string,
  preparedLegacyHookRemoval: PreparedLegacyHookRemoval | undefined,
  mutations: CodexFinalizationMutation[],
  effects: CodexMigrationResultV1['effects']['files'],
  inputs: FinalizationInputSnapshot,
): void {
  const currentMutations = buildCodexFinalizationMutations(cwd, preparedLegacyHookRemoval);
  const currentEffects = finalizationEffects(cwd, currentMutations);
  if (
    JSON.stringify(currentMutations) !== JSON.stringify(mutations) ||
    JSON.stringify(currentEffects) !== JSON.stringify(effects) ||
    JSON.stringify(snapshotCodexFinalizationInputs(cwd, mutations)) !== JSON.stringify(inputs)
  ) {
    throw new Error(
      'Codex finalization plan changed after confirmation; no repository files were modified.',
    );
  }
}

function reportCompletedFinalization(
  cwd: string,
  options: { json?: boolean; environment?: NodeJS.ProcessEnv },
): void {
  if (options.json === true) reportCodexMigration(cwd, options);
  else success('Safe Word Codex migration is already finalized.');
}

function reportAppliedFinalization(
  cwd: string,
  input: {
    options: { json?: boolean; environment?: NodeJS.ProcessEnv };
    effects: CodexMigrationResultV1['effects']['files'];
    removedLegacyHooks: boolean;
  },
): void {
  if (input.options.json === true) {
    reportCodexMigration(cwd, {
      ...input.options,
      changed: true,
      effects: input.effects,
    });
    return;
  }
  info('Backed up the complete legacy Codex state for conflict-safe recovery.');
  info(
    input.removedLegacyHooks
      ? 'Removed Safe Word legacy Codex project protection after the verified plugin handoff.'
      : 'No Safe Word legacy Codex hooks were found in this project.',
  );
}

export async function removeLegacyCodexHooks(
  cwd = process.cwd(),
  options: {
    yes?: boolean;
    confirm?: (plan: string) => Promise<boolean>;
    environment?: NodeJS.ProcessEnv;
    json?: boolean;
  } = {},
): Promise<boolean> {
  if (observeCodexHookProof(options.environment).status !== 'current') {
    throw new Error(
      'Finalization requires current plugin hook proof. Start a new Codex session, review /hooks, then retry.',
    );
  }
  if (codexFinalizationIsComplete(cwd)) {
    reportCompletedFinalization(cwd, options);
    return true;
  }
  // Validate cleanup before verifying the profile. A malformed project config
  // leaves both it and the Codex profile unchanged.
  const preparedLegacyHookRemoval = prepareLegacyHookRemoval(cwd);
  const plannedMutations = buildCodexFinalizationMutations(cwd, preparedLegacyHookRemoval);
  const plannedEffects = finalizationEffects(cwd, plannedMutations);
  const plannedInputs = snapshotCodexFinalizationInputs(cwd, plannedMutations);
  const plan = renderCodexFinalizationPlan(cwd, plannedMutations, preparedLegacyHookRemoval);
  const confirm = options.confirm;
  const confirmed = await resolveCodexFinalizationConfirmation({
    assumeYes: options.yes === true,
    confirm: confirm === undefined ? undefined : () => confirm(plan),
  });
  if (!confirmed) {
    info('Codex migration finalization was declined; the project was left unchanged.');
    return false;
  }

  run('bun', ['--version']);
  run('codex', ['--version']);
  verifyCodexPluginIsEnabled();

  if (options.json !== true) success('Safe Word Codex plugin is enabled for this profile.');

  assertCodexFinalizationPlanUnchanged(
    cwd,
    preparedLegacyHookRemoval,
    plannedMutations,
    plannedEffects,
    plannedInputs,
  );
  applyCodexFinalization(cwd, plannedMutations);

  reportAppliedFinalization(cwd, {
    options,
    effects: plannedEffects,
    removedLegacyHooks: preparedLegacyHookRemoval !== undefined,
  });
  return true;
}

/**
 * Compatibility facade for the pre-`codex install` command shape. New users
 * should use `safeword codex install`; existing scripts retain their behavior.
 */
export async function migrateCodexPlugin(
  cwd = process.cwd(),
  options: {
    marketplaceSource?: string;
    removeLegacyHooks?: boolean;
    yes?: boolean;
    confirm?: (plan: string) => Promise<boolean>;
  } = {},
): Promise<void> {
  if (options.removeLegacyHooks) {
    await removeLegacyCodexHooks(cwd, { yes: options.yes, confirm: options.confirm });
    return;
  }
  installCodexPlugin({
    marketplaceSource: options.marketplaceSource,
    recordRestartPending: false,
  });
}

export function recoverCodexMigration(
  cwd = process.cwd(),
  options: { json?: boolean; environment?: NodeJS.ProcessEnv } = {},
): void {
  const changed = recoverCodexFinalization(cwd);
  if (options.json === true) {
    reportCodexMigration(cwd, { ...options, changed });
  } else {
    success(
      changed
        ? 'Restored the backed-up Safe Word legacy Codex project state.'
        : 'No Safe Word Codex migration recovery was needed.',
    );
  }
}
