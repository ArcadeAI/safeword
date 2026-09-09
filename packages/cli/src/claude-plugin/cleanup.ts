/* eslint-disable unicorn/no-null -- null is the versioned absent-file image */

import { createHash, randomUUID } from 'node:crypto';
import type { Stats } from 'node:fs';
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  fchmodSync,
  fstatSync,
  fsyncSync,
  ftruncateSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  rmdirSync,
  writeSync,
} from 'node:fs';
import nodePath from 'node:path';

import { applyEdits, modify, parse, visit } from 'jsonc-parser';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { writeDurableFile, writeDurableFileExclusive } from '../codex-plugin/durable-write.js';
import { assertSafeClaudeCleanupTarget, containedClaudeCleanupPath } from './cleanup-target.js';
import {
  cataloguedClaudeLegacyPaths,
  isAcceptedHistoricalFile,
  isAcceptedHistoricalHook,
} from './historical-ownership.js';
import { type ClaudeLegacyObservation, observeClaudeLegacy } from './legacy-classifier.js';
import {
  advisoryStateDigest,
  claudeProjectStatePath,
  claudeWatchedSettingsDigest,
  createClaudePluginMode,
  readClaudePluginMode,
  removeClaudeProjectState,
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
  /** Durable destination chosen before a deletion can move any bytes. */
  readonly quarantine_path?: string;
}

interface CleanupTransaction {
  readonly schema_version: 1;
  readonly transaction_id: string;
  readonly disposition: 'complete-forward';
  readonly state: 'active' | 'recoverable';
  readonly owner_pid: number;
  readonly entries: CleanupEntry[];
  readonly plugin_mode: {
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
  /** Deterministic race seam used to prove compare-before-replace behavior. */
  readonly beforeApply?: () => void;
  /** Deterministic test seam immediately before the quarantine rename. */
  readonly beforeQuarantine?: () => void;
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
  return { path: relative, content: contractHistoricalClaudeSettings(original) };
}

function contractHistoricalClaudeSettings(original: string): string | null {
  const parsed = parse(original, [], {
    allowTrailingComma: true,
    disallowComments: false,
  }) as Record<string, unknown>;
  const hooks = (parsed.hooks as Record<string, unknown[]> | undefined) ?? {};
  const recognizedHooks = Object.entries(hooks).flatMap(([event, entries]) =>
    Array.isArray(entries)
      ? entries.flatMap((entry, index) =>
          isAcceptedHistoricalHook(event, entry) ? [{ event, index, entry }] : [],
        )
      : [],
  );
  if (recognizedHooks.length === 0)
    throw new Error('Claude settings transaction has no legacy hooks.');
  return settingsMutationFromContent(original, recognizedHooks);
}

function settingsMutationFromContent(
  original: string,
  recognizedHooks: ClaudeLegacyObservation['recognizedHooks'],
): string | null {
  const parsed = parse(original, [], {
    allowTrailingComma: true,
    disallowComments: false,
  }) as Record<string, unknown>;
  const hooks = (parsed.hooks as Record<string, unknown[]> | undefined) ?? {};
  const allHookValuesAreArrays = Object.values(hooks).every(entries => Array.isArray(entries));
  const hookCount = Object.values(hooks).reduce(
    (count, entries) => count + (Array.isArray(entries) ? entries.length : 0),
    0,
  );
  if (
    Object.keys(parsed).length === 1 &&
    allHookValuesAreArrays &&
    Object.values(hooks).every(entries => entries.length > 0) &&
    hookCount === recognizedHooks.length &&
    !containsJsonComments(original)
  ) {
    return null;
  }
  let content = original;
  const references = recognizedHooks.toSorted((left, right) => {
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
  return content;
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
  return claudeProjectStatePath(cwd, 'transaction');
}

function writeTransaction(cwd: string, transaction: CleanupTransaction): void {
  const path = transactionPath(cwd);
  mkdirSync(nodePath.dirname(path), { recursive: true, mode: 0o700 });
  const content = `${JSON.stringify(transaction, undefined, 2)}\n`;
  if (
    transaction.entries.length > 1024 ||
    Buffer.byteLength(content) > MAX_CLAUDE_TRANSACTION_BYTES
  ) {
    throw new Error('Claude cleanup transaction exceeds its recoverable size limit.');
  }
  writeDurableFileExclusive(path, content, {
    mode: 0o600,
  });
}

function entryFor(cwd: string, mutation: { path: string; content: string | null }): CleanupEntry {
  const path = assertSafeClaudeCleanupTarget(cwd, mutation.path);
  const before = readFileSync(path);
  const after = mutation.content === null ? null : Buffer.from(mutation.content);
  const mode = lstatSync(path).mode & 0o777;
  return {
    path: mutation.path,
    before_sha256: sha256(before),
    before_base64: before.toString('base64'),
    before_mode: mode,
    after_sha256: after === null ? null : sha256(after),
    after_base64: after === null ? null : after.toString('base64'),
    after_mode: after === null ? null : mode,
    ...(after === null && {
      quarantine_path: `.safeword/claude-plugin/quarantine/${randomUUID()}.retired`,
    }),
  };
}

function observedSha(path: string): string | null {
  return existsSync(path) ? sha256(readFileSync(path)) : null;
}

function sameFile(left: Stats, right: Stats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

interface OpenCleanupTarget {
  readonly descriptor: number;
  readonly parentDescriptor: number;
  readonly path: string;
  readonly target: Stats;
  readonly parent: Stats;
}

function isValidOpenCleanupTarget(snapshot: {
  targetBefore: Stats;
  opened: Stats;
  targetAfter: Stats;
  parentBefore: Stats;
  openedParent: Stats;
  parentAfter: Stats;
}): boolean {
  const { targetBefore, opened, targetAfter, parentBefore, openedParent, parentAfter } = snapshot;
  return (
    opened.isFile() &&
    opened.nlink === 1 &&
    sameFile(targetBefore, opened) &&
    sameFile(opened, targetAfter) &&
    sameFile(parentBefore, openedParent) &&
    sameFile(parentBefore, parentAfter)
  );
}

function openCleanupTarget(root: string, relative: string, flags: number): OpenCleanupTarget {
  const path = assertSafeClaudeCleanupTarget(root, relative);
  const parentPath = nodePath.dirname(path);
  const targetBefore = lstatSync(path);
  const parentBefore = lstatSync(parentPath);
  const parentDescriptor = openSync(
    parentPath,
    fsConstants.O_RDONLY | (fsConstants.O_DIRECTORY ?? 0) | (fsConstants.O_NOFOLLOW ?? 0),
  );
  let descriptor: number | undefined;
  try {
    descriptor = openSync(path, flags | (fsConstants.O_NOFOLLOW ?? 0));
    const targetAfter = lstatSync(path);
    const parentAfter = lstatSync(parentPath);
    const opened = fstatSync(descriptor);
    const openedParent = fstatSync(parentDescriptor);
    if (
      !isValidOpenCleanupTarget({
        targetBefore,
        opened,
        targetAfter,
        parentBefore,
        openedParent,
        parentAfter,
      })
    ) {
      throw new Error(`Claude cleanup target changed during validation: ${relative}`);
    }
    return { descriptor, parentDescriptor, path, target: opened, parent: parentAfter };
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    closeSync(parentDescriptor);
    throw error;
  }
}

function quarantineOpenTarget(
  root: string,
  opened: OpenCleanupTarget,
  quarantinePath: string,
  beforeQuarantine: (() => void) | undefined,
): void {
  if (process.platform !== 'darwin' && process.platform !== 'linux') {
    throw new Error('Atomic Claude cleanup quarantine is unavailable on this platform.');
  }
  const safeQuarantinePath = containedClaudeCleanupPath(root, quarantinePath);
  const quarantineDirectory = nodePath.dirname(safeQuarantinePath);
  mkdirSync(quarantineDirectory, { recursive: true, mode: 0o700 });
  beforeQuarantine?.();
  renameSync(opened.path, safeQuarantinePath);
  const quarantined = lstatSync(safeQuarantinePath);
  const descriptor = fstatSync(opened.descriptor);
  if (!sameFile(quarantined, descriptor) || descriptor.size !== opened.target.size) {
    throw new Error('Claude cleanup quarantined a replacement target; retained it for recovery.');
  }
  // Destroy bytes only through the descriptor whose identity was validated.
  // The empty private tombstone remains because POSIX has no conditional
  // unlink-by-inode primitive that could safely remove it under a same-UID race.
  ftruncateSync(opened.descriptor, 0);
  fchmodSync(opened.descriptor, 0o600);
  fsyncSync(opened.descriptor);
}

function revalidateOpenTarget(root: string, relative: string, opened: OpenCleanupTarget): void {
  const path = assertSafeClaudeCleanupTarget(root, relative);
  const target = lstatSync(path);
  const parent = lstatSync(nodePath.dirname(path));
  const descriptor = fstatSync(opened.descriptor);
  if (
    path !== opened.path ||
    !sameFile(opened.target, descriptor) ||
    !sameFile(descriptor, target) ||
    !sameFile(opened.parent, parent) ||
    descriptor.size !== opened.target.size ||
    descriptor.nlink !== 1
  ) {
    throw new Error(`Claude cleanup target changed before mutation: ${relative}`);
  }
}

function descriptorSha256(descriptor: number, size: number): string {
  if (size > MAX_CLAUDE_TRANSACTION_BYTES) throw new Error('Claude cleanup target is too large.');
  const bytes = Buffer.alloc(size);
  let offset = 0;
  while (offset < bytes.length) {
    const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset);
    if (count === 0) break;
    offset += count;
  }
  return sha256(bytes.subarray(0, offset));
}

interface WriteImageOptions {
  readonly mode: number | null;
  readonly quarantinePath?: string;
  readonly beforeQuarantine?: () => void;
}

function writeImage(
  root: string,
  relative: string,
  expectedSha256: string,
  content: string | null,
  options: WriteImageOptions,
): void {
  const opened = openCleanupTarget(root, relative, fsConstants.O_RDWR);
  try {
    revalidateOpenTarget(root, relative, opened);
    if (descriptorSha256(opened.descriptor, opened.target.size) !== expectedSha256) {
      throw new Error(`Claude cleanup target changed before mutation: ${relative}`);
    }
    revalidateOpenTarget(root, relative, opened);
    if (content === null) {
      if (options.quarantinePath === undefined) {
        throw new Error(`Claude cleanup transaction has no quarantine path: ${relative}`);
      }
      quarantineOpenTarget(root, opened, options.quarantinePath, options.beforeQuarantine);
      return;
    }
    const bytes = Buffer.from(content, 'base64');
    ftruncateSync(opened.descriptor, 0);
    let offset = 0;
    while (offset < bytes.length) {
      offset += writeSync(opened.descriptor, bytes, offset, bytes.length - offset, offset);
    }
    fchmodSync(opened.descriptor, options.mode ?? 0o644);
    fsyncSync(opened.descriptor);
  } finally {
    closeSync(opened.descriptor);
    closeSync(opened.parentDescriptor);
  }
}

function applyEntries(
  cwd: string,
  entries: readonly CleanupEntry[],
  shouldDefer: () => boolean = () => false,
  beforeQuarantine?: () => void,
): boolean {
  for (const entry of entries) {
    if (shouldDefer()) return false;
    const path = assertSafeClaudeCleanupTarget(cwd, entry.path);
    if (observedSha(path) !== entry.before_sha256) {
      throw new Error(`Claude cleanup target changed after planning: ${entry.path}`);
    }
    writeImage(cwd, entry.path, entry.before_sha256, entry.after_base64, {
      mode: entry.after_mode,
      quarantinePath: entry.quarantine_path,
      beforeQuarantine,
    });
  }
  return true;
}

function pruneEmptyLegacyDirectories(cwd: string, entries: readonly CleanupEntry[]): void {
  const candidates = new Set<string>();
  for (const entry of entries) {
    if (entry.after_sha256 !== null) continue;
    let directory = nodePath.dirname(entry.path);
    while (directory === '.claude' || directory.startsWith('.claude/')) {
      candidates.add(directory);
      directory = nodePath.dirname(directory);
    }
  }
  const deepestFirst = [...candidates].toSorted(
    (left, right) => right.split('/').length - left.split('/').length,
  );
  for (const directory of deepestFirst) {
    try {
      rmdirSync(containedClaudeCleanupPath(cwd, directory));
    } catch {
      // Directory pruning is cosmetic; completed contraction remains authoritative.
    }
  }
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
  const marker = claudeProjectStatePath(cwd, 'pluginMarkerV2');
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

function cleanupFailure(error: unknown): CliResult {
  return createResult({
    state: 'failed',
    errors: [{ code: 'CLAUDE_CLEANUP_FAILED', message: String(error), retryable: true }],
    nextActions: [{ command: 'safeword claude recover', mutates: true, requiresHuman: true }],
    data: { command: 'claude cleanup', classification: 'recovery-required' },
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
  if (recovered.state !== 'failed') {
    return observedPluginModeResult(projectRoot);
  }
  const detail =
    recovered.errors?.[0]?.message ?? 'the recorded cleanup transaction could not be read safely';
  return {
    state: 'attention',
    advisory: `Safeword preserved the old Claude integration because automatic recovery could not finish: ${detail} Your prompt was not blocked; run \`safeword claude recover\` to repair it.`,
    unresolvedPaths: [],
  };
}

function observedPluginModeResult(projectRoot: string): AutomaticClaudeMigrationResult {
  const marker = readClaudePluginMode(projectRoot);
  return {
    state: 'complete',
    advisory: marker?.advisory,
    unresolvedPaths: marker?.unresolved_paths ?? [],
  };
}

function writeObservedPluginMode(
  projectRoot: string,
  options: AutomaticClaudeMigrationOptions,
  unresolved: readonly string[],
  advisory: string | undefined,
): AutomaticClaudeMigrationResult {
  const existing = readClaudePluginMode(projectRoot);
  writeClaudePluginMode(
    projectRoot,
    createClaudePluginMode({
      plugin_version: options.pluginVersion,
      hook_manifest_sha256: options.hookManifestSha256,
      catalogue_sha256: options.catalogueSha256,
      unresolved_paths: unresolved,
      advisory,
      ...(existing?.transaction_id !== undefined && {
        transaction_id: existing.transaction_id,
      }),
    }),
  );
  return { state: 'complete', advisory, unresolvedPaths: unresolved };
}

const CONCURRENT_MIGRATION_ADVISORY =
  'Another Safeword process is retiring the old Claude integration. Your prompt was not blocked; the next prompt will verify that it finished.';

function deferredConcurrentMigration(paths: readonly string[]): AutomaticClaudeMigrationResult {
  return {
    state: 'deferred',
    advisory: CONCURRENT_MIGRATION_ADVISORY,
    unresolvedPaths: paths,
  };
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
      return observedPluginModeResult(projectRoot);
    }
    return deferredConcurrentMigration(unresolved);
  }
}

/** Defers to whichever process already claimed the cleanup transaction. */
function concurrentMigrationResult(
  projectRoot: string,
  options: AutomaticClaudeMigrationOptions,
  now: () => number,
): AutomaticClaudeMigrationResult {
  try {
    const transaction = parseTransaction(projectRoot);
    if (transactionCanRecover(transaction)) return recoveredAutomaticResult(projectRoot);
  } catch {
    // A concurrent writer may still be completing. The bounded marker wait
    // below distinguishes that case from a recoverable transaction.
  }
  const concurrentDeadline = Math.min(options.deadline, now() + 500);
  if (waitForPluginMode(projectRoot, concurrentDeadline, now)) {
    return observedPluginModeResult(projectRoot);
  }
  if (now() >= options.deadline) {
    return deferredConcurrentMigration([]);
  }
  try {
    const transaction = parseTransaction(projectRoot);
    return transactionCanRecover(transaction)
      ? recoveredAutomaticResult(projectRoot)
      : deferredConcurrentMigration([]);
  } catch {
    return recoveredAutomaticResult(projectRoot);
  }
}

/**
 * Reads the before-images for a planned contraction.
 *
 * Planning happens before the exclusive transaction claim, so a process that
 * loses the race can be part-way through reading files the winner is already
 * deleting. That is an ordinary lost race, not a failure to report: returning
 * undefined routes it to the same deferral path as an already-claimed
 * transaction, instead of surfacing an ENOENT as a repair advisory.
 */
function planCleanupEntries(
  projectRoot: string,
  mutations: readonly { path: string; content: string | null }[],
): CleanupEntry[] | undefined {
  try {
    return mutations.map(mutation => entryFor(projectRoot, mutation));
  } catch (error) {
    if (existsSync(transactionPath(projectRoot))) return undefined;
    throw error;
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
  if (existsSync(transactionPath(projectRoot)))
    return concurrentMigrationResult(projectRoot, options, now);
  const legacy = observeClaudeLegacy(projectRoot);
  const unresolved = unresolvedPaths(legacy);
  const advisory = automaticAdvisory(unresolved);
  const mutations = claudeLegacyMutations(projectRoot);
  if (mutations.length === 0) {
    return writeObservedPluginMode(projectRoot, options, unresolved, advisory);
  }
  const entries = planCleanupEntries(projectRoot, mutations);
  if (entries === undefined) return concurrentMigrationResult(projectRoot, options, now);
  const transaction: CleanupTransaction = {
    schema_version: 1,
    transaction_id: randomUUID(),
    disposition: 'complete-forward',
    state: 'active',
    owner_pid: process.pid,
    entries,
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
  options.beforeApply?.();
  let applied: boolean;
  try {
    applied = applyEntries(
      projectRoot,
      transaction.entries,
      () => now() >= options.deadline,
      options.beforeQuarantine,
    );
  } catch (error) {
    // The exclusive claim is already durable. Any filesystem refusal after
    // that point must leave an explicitly recoverable record rather than an
    // apparently live transaction owned by a process that is about to exit.
    writeDurableFile(
      transactionPath(projectRoot),
      `${JSON.stringify({ ...transaction, state: 'recoverable' }, undefined, 2)}\n`,
      { mode: 0o600 },
    );
    throw error;
  }
  if (!applied) {
    writeDurableFile(
      transactionPath(projectRoot),
      `${JSON.stringify({ ...transaction, state: 'recoverable' }, undefined, 2)}\n`,
      { mode: 0o600 },
    );
    return {
      state: 'deferred',
      advisory: 'Safeword will finish removing its old Claude integration on the next prompt.',
      unresolvedPaths: unresolved,
    };
  }
  writeAutomaticPluginMode(projectRoot, transaction);
  removeClaudeProjectState(projectRoot, 'transaction');
  pruneEmptyLegacyDirectories(projectRoot, transaction.entries);
  return { state: 'complete', advisory, unresolvedPaths: unresolved };
}

const MAX_CLAUDE_TRANSACTION_BYTES = 8 * 1024 * 1024;
const SHA256_PATTERN = /^[\da-f]{64}$/u;
const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/iu;

function isTransactionFile(before: Stats, opened: Stats, after: Stats): boolean {
  return (
    isSafeTransactionMetadata(before) &&
    isSafeTransactionMetadata(opened) &&
    isSafeTransactionMetadata(after) &&
    before.dev === opened.dev &&
    before.ino === opened.ino &&
    opened.dev === after.dev &&
    opened.ino === after.ino
  );
}

function isSafeTransactionMetadata(metadata: Stats): boolean {
  return (
    metadata.isFile() &&
    !metadata.isSymbolicLink() &&
    metadata.nlink === 1 &&
    metadata.size <= MAX_CLAUDE_TRANSACTION_BYTES
  );
}

function readTransactionBytes(path: string): Buffer {
  let descriptor: number | undefined;
  try {
    const before = lstatSync(path);
    descriptor = openSync(
      path,
      fsConstants.O_RDONLY | fsConstants.O_NONBLOCK | (fsConstants.O_NOFOLLOW ?? 0),
    );
    const opened = fstatSync(descriptor);
    const after = lstatSync(path);
    if (!isTransactionFile(before, opened, after)) throw new Error('Unsafe transaction file.');
    const buffer = Buffer.alloc(MAX_CLAUDE_TRANSACTION_BYTES + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const count = readSync(descriptor, buffer, offset, buffer.length - offset, offset);
      if (count === 0) break;
      offset += count;
    }
    const final = fstatSync(descriptor);
    if (
      offset > MAX_CLAUDE_TRANSACTION_BYTES ||
      !isTransactionFile(before, final, lstatSync(path))
    ) {
      throw new Error('Unsafe transaction file.');
    }
    return buffer.subarray(0, offset);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Claude cleanup transaction is malformed.');
  }
  return value as Record<string, unknown>;
}

function canonicalBase64(value: unknown): Buffer {
  if (typeof value !== 'string') throw new Error('Claude cleanup image is malformed.');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw new Error('Claude cleanup image is malformed.');
  return bytes;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).toSorted((left, right) => left.localeCompare(right));
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

const CLEANUP_ENTRY_KEYS = [
  'after_base64',
  'after_mode',
  'after_sha256',
  'before_base64',
  'before_mode',
  'before_sha256',
  'path',
] as const;

function expectedCleanupEntryKeys(entry: Record<string, unknown>): readonly string[] {
  return [
    ...CLEANUP_ENTRY_KEYS,
    ...(entry.quarantine_path === undefined ? [] : ['quarantine_path']),
  ].toSorted((left, right) => left.localeCompare(right));
}

function hasValidBeforeImage(entry: Record<string, unknown>, before: Buffer): boolean {
  return (
    hasExactKeys(entry, expectedCleanupEntryKeys(entry)) &&
    typeof entry.path === 'string' &&
    typeof entry.before_sha256 === 'string' &&
    SHA256_PATTERN.test(entry.before_sha256) &&
    sha256(before) === entry.before_sha256 &&
    Number.isSafeInteger(entry.before_mode) &&
    (entry.before_mode as number) >= 0 &&
    (entry.before_mode as number) <= 0o777
  );
}

function deterministicAfterImage(path: string, before: Buffer): string | null | undefined {
  if (path === '.claude/settings.json')
    return contractHistoricalClaudeSettings(before.toString('utf8'));
  if (cataloguedClaudeLegacyPaths().includes(path) && isAcceptedHistoricalFile(path, before)) {
    return null;
  }
  return undefined;
}

function hasExpectedAfterImage(
  entry: Record<string, unknown>,
  expectedBytes: Buffer | null,
): boolean {
  const expectedHash = expectedBytes === null ? null : sha256(expectedBytes);
  const expectedBase64 = expectedBytes === null ? null : expectedBytes.toString('base64');
  const expectedMode = expectedBytes === null ? null : entry.before_mode;
  return (
    entry.after_sha256 === expectedHash &&
    entry.after_base64 === expectedBase64 &&
    entry.after_mode === expectedMode
  );
}

function hasValidQuarantinePath(entry: Record<string, unknown>, deleting: boolean): boolean {
  if (entry.quarantine_path === undefined) return true;
  if (!deleting || typeof entry.quarantine_path !== 'string') return false;
  return (
    entry.quarantine_path.startsWith('.safeword/claude-plugin/quarantine/') &&
    entry.quarantine_path.endsWith('.retired') &&
    !nodePath.isAbsolute(entry.quarantine_path) &&
    !entry.quarantine_path.split('/').includes('..')
  );
}

function validateCleanupEntry(value: unknown): CleanupEntry {
  const entry = record(value);
  const before = canonicalBase64(entry.before_base64);
  if (!hasValidBeforeImage(entry, before)) {
    throw new Error('Claude cleanup entry is malformed.');
  }
  const expectedAfter = deterministicAfterImage(entry.path as string, before);
  if (expectedAfter === undefined) throw new Error('Claude cleanup entry is not catalogued.');
  const expectedBytes = expectedAfter === null ? null : Buffer.from(expectedAfter);
  if (!hasExpectedAfterImage(entry, expectedBytes)) {
    throw new Error('Claude cleanup after-image is not the deterministic legacy contraction.');
  }
  if (!hasValidQuarantinePath(entry, expectedAfter === null)) {
    throw new Error('Claude cleanup quarantine path is malformed.');
  }
  return entry as unknown as CleanupEntry;
}

function expectedPluginModeKeys(pluginMode: Record<string, unknown>): string[] {
  return [
    ...(pluginMode.advisory === undefined ? [] : ['advisory']),
    'catalogue_sha256',
    'hook_manifest_sha256',
    'plugin_version',
    'unresolved_paths',
  ].toSorted((left, right) => left.localeCompare(right));
}

function hasValidPluginModeDigests(pluginMode: Record<string, unknown>): boolean {
  return (
    typeof pluginMode.hook_manifest_sha256 === 'string' &&
    SHA256_PATTERN.test(pluginMode.hook_manifest_sha256) &&
    typeof pluginMode.catalogue_sha256 === 'string' &&
    SHA256_PATTERN.test(pluginMode.catalogue_sha256)
  );
}

function hasValidPluginModeMetadata(pluginMode: Record<string, unknown>): boolean {
  return (
    typeof pluginMode.plugin_version === 'string' &&
    Array.isArray(pluginMode.unresolved_paths) &&
    pluginMode.unresolved_paths.every(path => typeof path === 'string') &&
    (pluginMode.advisory === undefined || typeof pluginMode.advisory === 'string')
  );
}

function validatePluginMode(value: unknown): CleanupTransaction['plugin_mode'] {
  const pluginMode = record(value);
  const expectedKeys = expectedPluginModeKeys(pluginMode);
  if (
    !hasExactKeys(pluginMode, expectedKeys) ||
    !hasValidPluginModeDigests(pluginMode) ||
    !hasValidPluginModeMetadata(pluginMode)
  ) {
    throw new Error('Claude cleanup plugin mode is malformed.');
  }
  return pluginMode as unknown as CleanupTransaction['plugin_mode'];
}

function hasValidTransactionHeader(value: Record<string, unknown>): boolean {
  return (
    hasExactKeys(value, [
      'disposition',
      'entries',
      'owner_pid',
      'plugin_mode',
      'schema_version',
      'state',
      'transaction_id',
    ]) &&
    value.schema_version === 1 &&
    typeof value.transaction_id === 'string' &&
    UUID_PATTERN.test(value.transaction_id) &&
    value.disposition === 'complete-forward' &&
    (value.state === 'active' || value.state === 'recoverable') &&
    Number.isSafeInteger(value.owner_pid) &&
    (value.owner_pid as number) > 0
  );
}

function hasValidTransactionEntries(value: Record<string, unknown>): boolean {
  return Array.isArray(value.entries) && value.entries.length > 0 && value.entries.length <= 1024;
}

function parseTransaction(cwd: string): CleanupTransaction {
  const bytes = readTransactionBytes(transactionPath(cwd));
  const parsed = JSON.parse(bytes.toString('utf8')) as unknown;
  const value = record(parsed);
  if (!hasValidTransactionHeader(value) || !hasValidTransactionEntries(value)) {
    throw new Error('Claude cleanup transaction is malformed.');
  }
  const entryValues = value.entries as unknown[];
  const entries = entryValues.map(entry => validateCleanupEntry(entry));
  if (new Set(entries.map(entry => entry.path)).size !== entries.length) {
    throw new Error('Claude cleanup transaction repeats a target.');
  }
  return {
    schema_version: 1,
    transaction_id: value.transaction_id as string,
    disposition: 'complete-forward',
    state: value.state as CleanupTransaction['state'],
    owner_pid: value.owner_pid as number,
    entries,
    plugin_mode: validatePluginMode(value.plugin_mode),
  };
}

function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function transactionCanRecover(transaction: CleanupTransaction): boolean {
  return transaction.state === 'recoverable' || !processIsRunning(transaction.owner_pid);
}

function ensureQuarantinePaths(
  projectRoot: string,
  transaction: CleanupTransaction,
): CleanupTransaction {
  if (
    transaction.entries.every(
      entry => entry.after_sha256 !== null || entry.quarantine_path !== undefined,
    )
  ) {
    return transaction;
  }
  const upgraded: CleanupTransaction = {
    ...transaction,
    entries: transaction.entries.map(entry =>
      entry.after_sha256 === null && entry.quarantine_path === undefined
        ? {
            ...entry,
            quarantine_path: `.safeword/claude-plugin/quarantine/${randomUUID()}.retired`,
          }
        : entry,
    ),
  };
  writeDurableFile(transactionPath(projectRoot), `${JSON.stringify(upgraded, undefined, 2)}\n`, {
    mode: 0o600,
  });
  return upgraded;
}

interface PendingRecoveryEntry {
  readonly entry: CleanupEntry;
  readonly expectedSha256: string;
}

function interruptedAfterImage(path: string, entry: CleanupEntry): boolean {
  if (entry.after_base64 === null) return false;
  const current = readFileSync(path);
  const after = Buffer.from(entry.after_base64, 'base64');
  return current.length < after.length && after.subarray(0, current.length).equals(current);
}

function pendingRecoveryEntries(
  projectRoot: string,
  transaction: CleanupTransaction,
): PendingRecoveryEntry[] {
  const pending: PendingRecoveryEntry[] = [];
  for (const entry of transaction.entries) {
    if (entry.quarantine_path !== undefined) {
      const quarantine = assertSafeClaudeCleanupTarget(projectRoot, entry.quarantine_path);
      if (existsSync(quarantine) && lstatSync(quarantine).size > 0) {
        throw new Error(
          `Claude recovery preserved unverified bytes at ${entry.quarantine_path}; inspect and move or remove that file before retrying recovery`,
        );
      }
    }
    const path = assertSafeClaudeCleanupTarget(projectRoot, entry.path);
    const current = observedSha(path);
    const source = entry.before_sha256;
    const destination = entry.after_sha256;
    if (current === destination) continue;
    if (current === source) {
      pending.push({ entry, expectedSha256: source });
      continue;
    }
    if (current !== null && interruptedAfterImage(path, entry)) {
      pending.push({ entry, expectedSha256: current });
      continue;
    }
    throw new Error(`Claude recovery conflict at ${entry.path}`);
  }
  return pending;
}

function applyRecoveryEntries(projectRoot: string, pending: readonly PendingRecoveryEntry[]): void {
  for (const { entry, expectedSha256 } of pending) {
    writeImage(projectRoot, entry.path, expectedSha256, entry.after_base64, {
      mode: entry.after_mode,
      quarantinePath: entry.quarantine_path,
    });
  }
}

function completedRecoveryResult(projectRoot: string, transaction: CleanupTransaction): CliResult {
  writeAutomaticPluginMode(projectRoot, transaction);
  removeClaudeProjectState(projectRoot, 'transaction');
  pruneEmptyLegacyDirectories(projectRoot, transaction.entries);
  return createResult({
    state: 'changed',
    data: {
      command: 'claude recover',
      classification: 'plugin-mode',
    },
  });
}

export function recoverClaudeCleanup(cwd: string): CliResult {
  let projectRoot: string;
  try {
    projectRoot = canonicalClaudeProjectRoot(cwd);
  } catch (error) {
    return cleanupFailure(error);
  }
  if (!existsSync(transactionPath(projectRoot))) {
    return createResult({
      state: 'healthy',
      data: { command: 'claude recover', classification: 'plugin-mode' },
    });
  }
  try {
    let transaction = parseTransaction(projectRoot);
    if (!transactionCanRecover(transaction)) {
      throw new Error(
        `Claude cleanup transaction is still owned by process ${transaction.owner_pid}.`,
      );
    }
    transaction = ensureQuarantinePaths(projectRoot, transaction);
    applyRecoveryEntries(projectRoot, pendingRecoveryEntries(projectRoot, transaction));
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
