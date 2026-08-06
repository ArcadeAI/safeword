/* eslint-disable unicorn/no-null -- null is the versioned absent-file image */

import { createHash, randomUUID } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
} from 'node:fs';
import nodePath from 'node:path';

import { applyEdits, modify, parse, visit } from 'jsonc-parser';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { writeDurableFile, writeDurableFileExclusive } from '../codex-plugin/durable-write.js';
import { assertSafeClaudeCleanupTarget, containedClaudeCleanupPath } from './cleanup-target.js';
import { CLAUDE_MIGRATION_SCHEMA } from './inventory.js';
import { type ClaudeLegacyObservation, observeClaudeLegacy } from './legacy-classifier.js';
import {
  advisoryStateDigest,
  claudeWatchedSettingsDigest,
  createClaudePluginMode,
  writeClaudeMigrationAttention,
  writeClaudePluginMode,
} from './migration-state.js';
import { canonicalClaudeProjectRoot } from './project-root.js';

interface CleanupEntry {
  readonly path: string;
  readonly before_sha256: string;
  readonly before_base64: string;
  readonly before_mode: number;
  readonly after_sha256: string | null;
  readonly after_base64: string | null;
  readonly after_mode: number | null;
}

interface CleanupTransaction {
  readonly schema_version: 1;
  readonly transaction_id: string;
  readonly disposition: 'complete-forward' | 'restore-backup';
  readonly entries: CleanupEntry[];
  readonly plugin_mode?: {
    readonly plugin_version: string;
    readonly hook_manifest_sha256: string;
    readonly catalogue_sha256: string;
    readonly unresolved_paths: readonly string[];
    readonly advisory?: string;
  };
}

export interface AutomaticClaudeMigrationOptions {
  readonly pluginVersion: string;
  readonly hookManifestSha256: string;
  readonly catalogueSha256: string;
  readonly deadline: number;
  readonly now?: () => number;
}

export interface AutomaticClaudeMigrationResult {
  readonly state: 'complete' | 'deferred' | 'attention';
  readonly advisory?: string;
  readonly unresolvedPaths: readonly string[];
}

function sha256(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

function containsJsonComments(content: string): boolean {
  let found = false;
  visit(content, { onComment: () => (found = true) });
  return found;
}

function settingsMutation(
  cwd: string,
  legacy: ClaudeLegacyObservation,
): { path: string; content: string | null } | undefined {
  const relative = '.claude/settings.json';
  const path = nodePath.join(cwd, relative);
  if (!existsSync(path) || legacy.recognizedHooks.length === 0) return undefined;
  const original = readFileSync(path, 'utf8');
  const parsed = parse(original) as Record<string, unknown>;
  const hooks = (parsed.hooks as Record<string, unknown[]> | undefined) ?? {};
  const allHookValuesAreArrays = Object.values(hooks).every(entries => Array.isArray(entries));
  const hookCount = Object.values(hooks).reduce(
    (count, entries) => count + (Array.isArray(entries) ? entries.length : 0),
    0,
  );
  const generatedHookOnlyFile =
    Object.keys(parsed).length === 1 &&
    allHookValuesAreArrays &&
    hookCount === legacy.recognizedHooks.length &&
    !containsJsonComments(original);
  if (generatedHookOnlyFile) return { path: relative, content: null };

  let content = original;
  const references = legacy.recognizedHooks.toSorted((left, right) => {
    const eventOrder = right.event.localeCompare(left.event);
    return eventOrder === 0 ? right.index - left.index : eventOrder;
  });
  for (const reference of references) {
    content = applyEdits(
      content,
      modify(content, ['hooks', reference.event, reference.index], undefined, {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      }),
    );
  }
  return {
    path: relative,
    content,
  };
}

export function claudeLegacyMutations(cwd: string): { path: string; content: string | null }[] {
  const legacy = observeClaudeLegacy(cwd);
  const files: { path: string; content: string | null }[] = legacy.recognizedFiles.map(path => ({
    path,
    content: null,
  }));
  const settings = settingsMutation(cwd, legacy);
  if (settings !== undefined) files.push(settings);
  return files;
}

export function claudeCleanupPreconditionDigest(
  cwd: string,
  mutations: readonly { path: string; content: string | null }[],
): string {
  return sha256(
    JSON.stringify(
      mutations.map(mutation => {
        const target = assertSafeClaudeCleanupTarget(cwd, mutation.path);
        return [mutation.path, sha256(readFileSync(target)), mutation.content];
      }),
    ),
  );
}

function transactionPath(cwd: string): string {
  return containedClaudeCleanupPath(cwd, CLAUDE_MIGRATION_SCHEMA.paths.transaction);
}

function writeTransaction(cwd: string, transaction: CleanupTransaction): void {
  const path = transactionPath(cwd);
  mkdirSync(nodePath.dirname(path), { recursive: true, mode: 0o700 });
  writeDurableFileExclusive(path, `${JSON.stringify(transaction, undefined, 2)}\n`, {
    mode: 0o600,
  });
}

function entryFor(cwd: string, mutation: { path: string; content: string | null }): CleanupEntry {
  const path = assertSafeClaudeCleanupTarget(cwd, mutation.path);
  const before = readFileSync(path);
  const after = mutation.content === null ? null : Buffer.from(mutation.content);
  return {
    path: mutation.path,
    before_sha256: sha256(before),
    before_base64: before.toString('base64'),
    before_mode: lstatSync(path).mode & 0o777,
    after_sha256: after === null ? null : sha256(after),
    after_base64: after === null ? null : after.toString('base64'),
    after_mode: after === null ? null : lstatSync(path).mode & 0o777,
  };
}

function observedSha(path: string): string | null {
  return existsSync(path) ? sha256(readFileSync(path)) : null;
}

/**
 * Removes the directories a contracted file leaves behind. Legacy Claude
 * delivery is nested (`.claude/skills/<skill>/SKILL.md`), so deleting the files
 * alone strands a husk tree the user then has to clean up by hand. Pruning
 * stops at the first non-empty ancestor and never leaves the project root, so
 * it can only ever remove directories Safeword just emptied.
 */
function pruneEmptyAncestors(root: string, path: string): void {
  const canonicalRoot = nodePath.resolve(root);
  let directory = nodePath.dirname(nodePath.resolve(path));
  while (directory.startsWith(`${canonicalRoot}${nodePath.sep}`)) {
    try {
      if (readdirSync(directory).length > 0) return;
      rmdirSync(directory);
    } catch {
      // A concurrent writer repopulated or removed the directory. The files
      // Safeword owns are already gone, so the prompt must not fail for a husk.
      return;
    }
    directory = nodePath.dirname(directory);
  }
}

function writeImage(root: string, path: string, content: string | null, mode: number | null): void {
  if (content === null) {
    rmSync(path, { force: true });
    pruneEmptyAncestors(root, path);
    return;
  }
  mkdirSync(nodePath.dirname(path), { recursive: true });
  writeDurableFile(path, Buffer.from(content, 'base64'), { mode: mode ?? 0o644 });
  chmodSync(path, mode ?? 0o644);
}

function applyEntries(
  cwd: string,
  entries: readonly CleanupEntry[],
  shouldDefer: () => boolean = () => false,
): boolean {
  for (const entry of entries) {
    if (shouldDefer()) return false;
    const path = assertSafeClaudeCleanupTarget(cwd, entry.path);
    if (observedSha(path) !== entry.before_sha256) {
      throw new Error(`Claude cleanup target changed after planning: ${entry.path}`);
    }
    writeImage(cwd, path, entry.after_base64, entry.after_mode);
  }
  return true;
}

function writePluginModeMarker(cwd: string, transactionId: string): void {
  const marker = containedClaudeCleanupPath(cwd, CLAUDE_MIGRATION_SCHEMA.paths.pluginMarker);
  mkdirSync(nodePath.dirname(marker), { recursive: true });
  writeDurableFile(
    marker,
    `${JSON.stringify({ schema_version: 1, mode: 'plugin', transaction_id: transactionId })}\n`,
    { mode: 0o600 },
  );
}

function unresolvedPaths(legacy: ClaudeLegacyObservation): string[] {
  return [
    ...legacy.conflictingFiles,
    ...legacy.conflictingHooks.map(
      hook => `.claude/settings.json#hooks.${hook.event}[${String(hook.index)}]`,
    ),
    ...(legacy.settingsError === undefined ? [] : ['.claude/settings.json']),
  ];
}

function automaticAdvisory(paths: readonly string[]): string | undefined {
  if (paths.length === 0) return undefined;
  return `Safeword removed the old Claude integration it could verify, but preserved unrecognized content at ${paths.join(', ')}. Review those paths; your prompt was not blocked.`;
}

function recordAutomaticAttention(
  cwd: string,
  options: AutomaticClaudeMigrationOptions,
  classification: string,
  advisory: string,
): void {
  writeClaudeMigrationAttention(cwd, {
    schema_version: 1,
    state_digest: advisoryStateDigest(advisory),
    plugin_version: options.pluginVersion,
    catalogue_sha256: options.catalogueSha256,
    watched_settings_sha256: claudeWatchedSettingsDigest(cwd),
    classification,
    advisory,
  });
}

function waitForPluginMode(cwd: string, deadline: number, now: () => number): boolean {
  const marker = containedClaudeCleanupPath(cwd, CLAUDE_MIGRATION_SCHEMA.paths.pluginMarkerV2);
  const pause = new Int32Array(new SharedArrayBuffer(4));
  const maximumChecks = 25;
  for (let checks = 0; checks < maximumChecks && now() < deadline; checks += 1) {
    if (existsSync(marker)) return true;
    const remaining = Math.max(1, deadline - now());
    Atomics.wait(pause, 0, 0, Math.min(20, remaining));
  }
  return existsSync(marker);
}

function writeAutomaticPluginMode(cwd: string, transaction: CleanupTransaction): void {
  const pluginMode = transaction.plugin_mode;
  if (pluginMode === undefined) {
    writePluginModeMarker(cwd, transaction.transaction_id);
    return;
  }
  writeClaudePluginMode(
    cwd,
    createClaudePluginMode({
      plugin_version: pluginMode.plugin_version,
      hook_manifest_sha256: pluginMode.hook_manifest_sha256,
      catalogue_sha256: pluginMode.catalogue_sha256,
      unresolved_paths: pluginMode.unresolved_paths,
      advisory: pluginMode.advisory,
      transaction_id: transaction.transaction_id,
    }),
  );
}

function cleanupFailure(error: unknown, classification = 'coexistence'): CliResult {
  return createResult({
    state: 'failed',
    errors: [{ code: 'CLAUDE_CLEANUP_FAILED', message: String(error), retryable: true }],
    nextActions: [{ command: 'safeword claude recover', mutates: true, requiresHuman: true }],
    data: { command: 'claude cleanup', classification },
  });
}

export function migrateClaudeLegacyAutomatically(
  cwd: string,
  options: AutomaticClaudeMigrationOptions,
): AutomaticClaudeMigrationResult {
  const now = options.now ?? Date.now;
  let projectRoot: string | undefined;
  try {
    projectRoot = canonicalClaudeProjectRoot(cwd);
    return performAutomaticMigration(projectRoot, options, now);
  } catch (error) {
    const advisory = `Safeword preserved the old Claude integration after cleanup could not finish: ${error instanceof Error ? error.message : String(error)} Your prompt was not blocked; run \`safeword claude recover\` to repair it.`;
    if (projectRoot !== undefined) {
      try {
        recordAutomaticAttention(projectRoot, options, 'migration-error', advisory);
      } catch {
        // The prompt must remain successful even when durable attention cannot be recorded.
      }
    }
    return {
      state: 'attention',
      advisory,
      unresolvedPaths: [],
    };
  }
}

function recoveredAutomaticResult(projectRoot: string): AutomaticClaudeMigrationResult {
  const recovered = recoverClaudeCleanup(projectRoot);
  if (recovered.state !== 'failed') return { state: 'complete', unresolvedPaths: [] };
  return {
    state: 'attention',
    advisory:
      recovered.errors?.[0]?.message ??
      'Safeword preserved a concurrent Claude migration edit. Run safeword claude recover.',
    unresolvedPaths: [],
  };
}

function writeObservedPluginMode(
  projectRoot: string,
  options: AutomaticClaudeMigrationOptions,
  unresolved: readonly string[],
  advisory: string | undefined,
): AutomaticClaudeMigrationResult {
  writeClaudePluginMode(
    projectRoot,
    createClaudePluginMode({
      plugin_version: options.pluginVersion,
      hook_manifest_sha256: options.hookManifestSha256,
      catalogue_sha256: options.catalogueSha256,
      unresolved_paths: unresolved,
      advisory,
    }),
  );
  return { state: 'complete', advisory, unresolvedPaths: unresolved };
}

function claimAutomaticTransaction(
  projectRoot: string,
  transaction: CleanupTransaction,
  options: AutomaticClaudeMigrationOptions,
  now: () => number,
  unresolved: readonly string[],
): AutomaticClaudeMigrationResult | undefined {
  try {
    writeTransaction(projectRoot, transaction);
    return undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if (waitForPluginMode(projectRoot, options.deadline, now)) {
      return { state: 'complete', unresolvedPaths: unresolved };
    }
    return {
      state: 'deferred',
      advisory:
        'Another Safeword process is retiring the old Claude integration. Your prompt was not blocked; the next prompt will verify that it finished.',
      unresolvedPaths: unresolved,
    };
  }
}

function performAutomaticMigration(
  projectRoot: string,
  options: AutomaticClaudeMigrationOptions,
  now: () => number,
): AutomaticClaudeMigrationResult {
  if (now() >= options.deadline) {
    return {
      state: 'deferred',
      advisory: 'Safeword deferred old Claude integration cleanup until the next prompt.',
      unresolvedPaths: [],
    };
  }
  if (existsSync(transactionPath(projectRoot))) {
    const concurrentDeadline = Math.min(options.deadline, now() + 500);
    if (waitForPluginMode(projectRoot, concurrentDeadline, now)) {
      return { state: 'complete', unresolvedPaths: [] };
    }
    if (now() >= options.deadline) {
      return {
        state: 'deferred',
        advisory:
          'Another Safeword process is retiring the old Claude integration. Your prompt was not blocked; the next prompt will verify that it finished.',
        unresolvedPaths: [],
      };
    }
    return recoveredAutomaticResult(projectRoot);
  }
  const legacy = observeClaudeLegacy(projectRoot);
  const unresolved = unresolvedPaths(legacy);
  const advisory = automaticAdvisory(unresolved);
  const mutations = claudeLegacyMutations(projectRoot);
  if (mutations.length === 0) {
    return writeObservedPluginMode(projectRoot, options, unresolved, advisory);
  }
  const transaction: CleanupTransaction = {
    schema_version: 1,
    transaction_id: randomUUID(),
    disposition: 'complete-forward',
    entries: mutations.map(mutation => entryFor(projectRoot, mutation)),
    plugin_mode: {
      plugin_version: options.pluginVersion,
      hook_manifest_sha256: options.hookManifestSha256,
      catalogue_sha256: options.catalogueSha256,
      unresolved_paths: unresolved,
      advisory,
    },
  };
  const contention = claimAutomaticTransaction(projectRoot, transaction, options, now, unresolved);
  if (contention !== undefined) return contention;
  if (!applyEntries(projectRoot, transaction.entries, () => now() >= options.deadline)) {
    return {
      state: 'deferred',
      advisory: 'Safeword will finish removing its old Claude integration on the next prompt.',
      unresolvedPaths: unresolved,
    };
  }
  writeAutomaticPluginMode(projectRoot, transaction);
  rmSync(transactionPath(projectRoot), { force: true });
  return { state: 'complete', advisory, unresolvedPaths: unresolved };
}

function parseTransaction(cwd: string): CleanupTransaction {
  const value = JSON.parse(readFileSync(transactionPath(cwd), 'utf8')) as CleanupTransaction;
  if (value.schema_version !== 1 || !Array.isArray(value.entries))
    throw new Error('Claude cleanup transaction is malformed.');
  return value;
}

function pendingRecoveryEntries(
  projectRoot: string,
  transaction: CleanupTransaction,
): CleanupEntry[] {
  const forward = transaction.disposition === 'complete-forward';
  const pending: CleanupEntry[] = [];
  for (const entry of transaction.entries) {
    const path = assertSafeClaudeCleanupTarget(projectRoot, entry.path);
    const current = observedSha(path);
    const source = forward ? entry.before_sha256 : entry.after_sha256;
    const destination = forward ? entry.after_sha256 : entry.before_sha256;
    if (current === destination) continue;
    if (current !== source) throw new Error(`Claude recovery conflict at ${entry.path}`);
    pending.push(entry);
  }
  return pending;
}

function applyRecoveryEntries(
  projectRoot: string,
  transaction: CleanupTransaction,
  pending: readonly CleanupEntry[],
): void {
  const forward = transaction.disposition === 'complete-forward';
  for (const entry of pending) {
    const path = containedClaudeCleanupPath(projectRoot, entry.path);
    writeImage(
      projectRoot,
      path,
      forward ? entry.after_base64 : entry.before_base64,
      forward ? entry.after_mode : entry.before_mode,
    );
  }
}

function completedRecoveryResult(projectRoot: string, transaction: CleanupTransaction): CliResult {
  if (transaction.disposition === 'complete-forward') {
    writeAutomaticPluginMode(projectRoot, transaction);
  }
  rmSync(transactionPath(projectRoot), { force: true });
  return createResult({
    state: 'changed',
    data: {
      command: 'claude recover',
      classification:
        transaction.disposition === 'complete-forward' ? 'plugin-mode' : 'cleanup-ready',
    },
  });
}

export function recoverClaudeCleanup(cwd: string): CliResult {
  let projectRoot: string;
  try {
    projectRoot = canonicalClaudeProjectRoot(cwd);
  } catch (error) {
    return cleanupFailure(error, 'recovery-required');
  }
  if (!existsSync(transactionPath(projectRoot))) {
    return createResult({
      state: 'healthy',
      data: { command: 'claude recover', classification: 'plugin-mode' },
    });
  }
  try {
    const transaction = parseTransaction(projectRoot);
    applyRecoveryEntries(
      projectRoot,
      transaction,
      pendingRecoveryEntries(projectRoot, transaction),
    );
    return completedRecoveryResult(projectRoot, transaction);
  } catch (error) {
    return createResult({
      state: 'failed',
      errors: [{ code: 'CLAUDE_RECOVERY_CONFLICT', message: String(error), retryable: true }],
      nextActions: [
        { command: 'resolve the reported recovery conflict', mutates: false, requiresHuman: true },
      ],
      data: { command: 'claude recover', classification: 'recovery-required' },
    });
  }
}
