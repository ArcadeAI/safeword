/* eslint-disable unicorn/no-null -- null is the explicit absent-file mutation */

import { createHash, randomUUID } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { CODEX_MIGRATION_SCHEMA } from './inventory.js';

export interface CodexFinalizationMutation {
  path: string;
  content: string | null;
  mode?: number;
}

interface FileImage {
  kind: 'file';
  mode: number;
  sha256: string;
  payload?: string;
}

interface AbsentImage {
  kind: 'absent';
}

interface BackupEntry {
  path: string;
  before: FileImage | AbsentImage;
  after: FileImage | AbsentImage;
}

interface BackupManifestV1 {
  schema_version: 1;
  status: 'prepared' | 'finalized' | 'recovering';
  transaction_id: string;
  plan_sha256: string;
  entries: BackupEntry[];
}

const BACKUP_PATH = '.safeword/codex-migration-backup';
const PROJECT_MARKER_PATH = '.safeword/codex-plugin.json';
const BOOTSTRAP_PATH = '.agents/skills/safeword-plugin-setup/SKILL.md';
const CODEX_CONFIG_PATH = '.codex/config.toml';

export async function resolveCodexFinalizationConfirmation(_options: {
  assumeYes: boolean;
  confirm?: () => Promise<boolean>;
}): Promise<boolean> {
  if (_options.assumeYes) return true;
  if (_options.confirm === undefined) {
    throw new Error(
      'Finalization requires confirmation. Re-run interactively or pass --finalize --yes.',
    );
  }
  return _options.confirm();
}

export async function promptCodexFinalization(
  plan: string,
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
): Promise<boolean> {
  output.write(plan.endsWith('\n') ? plan : `${plan}\n`);
  const { createInterface } = await import('node:readline/promises');
  const readline = createInterface({ input, output });
  try {
    const answer = await Promise.race([
      readline.question('Finalize shared repository cleanup? [y/N] '),
      new Promise<undefined>(resolve => {
        readline.once('close', () => {
          resolve(undefined);
        });
      }),
    ]);
    return answer !== undefined && /^y(?:es)?$/iu.test(answer.trim());
  } catch {
    return false;
  } finally {
    readline.close();
  }
}

export function codexFinalizationIsComplete(cwd: string): boolean {
  try {
    const marker = JSON.parse(
      readFileSync(assertSafeComponents(cwd, PROJECT_MARKER_PATH), 'utf8'),
    ) as Record<string, unknown>;
    const manifest = JSON.parse(
      readFileSync(assertSafeComponents(cwd, `${BACKUP_PATH}/manifest.json`), 'utf8'),
    ) as Record<string, unknown>;
    if (!isBackupManifest(manifest)) return false;
    validateManifestIntent(manifest);
    return (
      marker.schema_version === 1 &&
      marker.mode === 'plugin' &&
      manifest.status === 'finalized' &&
      marker.transaction_id === manifest.transaction_id &&
      marker.plan_sha256 === manifest.plan_sha256 &&
      manifestPlanDigest(manifest.entries) === manifest.plan_sha256 &&
      backupPayloadsAreValid(cwd, manifest)
    );
  } catch {
    return false;
  }
}

function pathEntryExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

export function codexRecoveryIsRequired(cwd: string): boolean {
  return pathEntryExists(containedPath(cwd, BACKUP_PATH)) && !codexFinalizationIsComplete(cwd);
}

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function containedPath(cwd: string, relativePath: string): string {
  if (
    relativePath === '' ||
    nodePath.isAbsolute(relativePath) ||
    relativePath.split(/[\\/]/u).includes('..')
  ) {
    throw new Error(`Unsafe Codex migration path: ${relativePath}`);
  }
  const root = nodePath.resolve(cwd);
  const resolved = nodePath.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${nodePath.sep}`)) {
    throw new Error(`Unsafe Codex migration path: ${relativePath}`);
  }
  return resolved;
}

function assertSafeComponents(cwd: string, relativePath: string): string {
  const target = containedPath(cwd, relativePath);
  const segments = relativePath.split(/[\\/]/u);
  let cursor = nodePath.resolve(cwd);
  for (const segment of segments) {
    cursor = nodePath.join(cursor, segment);
    let metadata;
    try {
      metadata = lstatSync(cursor);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    if (metadata.isSymbolicLink()) {
      throw new Error(`Unsafe Codex migration path is a symbolic link: ${relativePath}`);
    }
    if (cursor === target ? !metadata.isFile() : !metadata.isDirectory()) {
      throw new Error(`Unsafe Codex migration path is not a regular file: ${relativePath}`);
    }
  }
  return target;
}

export function validateCodexFinalizationPaths(
  cwd: string,
  mutations: CodexFinalizationMutation[],
): void {
  for (const mutation of mutations) assertSafeComponents(cwd, mutation.path);
}

function beforeImage(
  cwd: string,
  backupDirectory: string,
  mutation: CodexFinalizationMutation,
  index: number,
): FileImage | AbsentImage {
  const path = assertSafeComponents(cwd, mutation.path);
  if (!existsSync(path)) return { kind: 'absent' };
  const content = readFileSync(path);
  const payload = `payloads/${index}.bin`;
  writeFileSync(nodePath.join(backupDirectory, payload), content, { mode: 0o600 });
  return {
    kind: 'file',
    mode: lstatSync(path).mode & 0o777,
    sha256: sha256(content),
    payload,
  };
}

function afterImage(
  mutation: CodexFinalizationMutation,
  before: FileImage | AbsentImage,
): FileImage | AbsentImage {
  if (mutation.content === null) return { kind: 'absent' };
  const content = Buffer.from(mutation.content);
  return {
    kind: 'file',
    mode: mutation.mode ?? (before.kind === 'file' ? before.mode : 0o644),
    sha256: sha256(content),
  };
}

function writeDurable(path: string, content: Buffer | string, mode: number): void {
  const directory = nodePath.dirname(path);
  mkdirSync(directory, { recursive: true });
  const temporaryPath = nodePath.join(
    directory,
    `.${nodePath.basename(path)}-${process.pid}-${randomUUID()}.tmp`,
  );
  try {
    const descriptor = openSync(temporaryPath, 'wx', mode);
    try {
      writeFileSync(descriptor, content);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

function writeManifest(backupDirectory: string, manifest: BackupManifestV1): void {
  writeDurable(
    nodePath.join(backupDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    0o600,
  );
}

function applyMutation(
  cwd: string,
  mutation: CodexFinalizationMutation,
  after: FileImage | AbsentImage,
): void {
  const path = assertSafeComponents(cwd, mutation.path);
  if (mutation.content === null) {
    rmSync(path, { force: true });
    return;
  }
  if (after.kind !== 'file') throw new Error('Invalid Codex finalization file image.');
  writeDurable(path, mutation.content, after.mode);
  chmodSync(path, after.mode);
}

function restoreBeforeImage(cwd: string, backupDirectory: string, entry: BackupEntry): void {
  const path = assertSafeComponents(cwd, entry.path);
  if (entry.before.kind === 'absent') {
    rmSync(path, { force: true });
    return;
  }
  if (entry.before.payload === undefined) {
    throw new Error(`Codex migration backup payload is missing for ${entry.path}.`);
  }
  const payload = containedPath(backupDirectory, entry.before.payload);
  const content = readFileSync(payload);
  if (sha256(content) !== entry.before.sha256) {
    throw new Error(`Codex migration backup payload is corrupt for ${entry.path}.`);
  }
  writeDurable(path, content, entry.before.mode);
  chmodSync(path, entry.before.mode);
}

function observedImage(cwd: string, relativePath: string): FileImage | AbsentImage {
  const path = assertSafeComponents(cwd, relativePath);
  if (!existsSync(path)) return { kind: 'absent' };
  const content = readFileSync(path);
  return {
    kind: 'file',
    mode: lstatSync(path).mode & 0o777,
    sha256: sha256(content),
  };
}

function imagesMatch(left: FileImage | AbsentImage, right: FileImage | AbsentImage): boolean {
  if (left.kind !== right.kind) return false;
  return (
    left.kind === 'absent' ||
    (right.kind === 'file' && left.mode === right.mode && left.sha256 === right.sha256)
  );
}

function readBackupManifest(cwd: string): {
  backupDirectory: string;
  manifest: BackupManifestV1;
} {
  const backupDirectory = containedPath(cwd, BACKUP_PATH);
  const manifestPath = assertSafeComponents(cwd, `${BACKUP_PATH}/manifest.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
  if (!isBackupManifest(manifest)) {
    throw new Error('Codex migration backup manifest is malformed.');
  }
  return { backupDirectory, manifest };
}

function isSafeRelativePath(path: string): boolean {
  return path !== '' && !nodePath.isAbsolute(path) && !path.split(/[\\/]/u).includes('..');
}

function isFileMode(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 0o777;
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

function isFileImage(value: unknown, requiresPayload: boolean): value is FileImage {
  if (typeof value !== 'object' || value === null) return false;
  const image = value as Record<string, unknown>;
  const baseFieldsAreValid = [
    image.kind === 'file',
    isFileMode(image.mode),
    isSha256(image.sha256),
  ].every(Boolean);
  if (!baseFieldsAreValid) return false;
  if (!requiresPayload) return image.payload === undefined;
  return typeof image.payload === 'string' && isSafeRelativePath(image.payload);
}

function isAbsentImage(value: unknown): value is AbsentImage {
  return (
    typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'absent'
  );
}

function isBackupEntry(value: unknown): value is BackupEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.path === 'string' &&
    isSafeRelativePath(entry.path) &&
    (isFileImage(entry.before, true) || isAbsentImage(entry.before)) &&
    (isFileImage(entry.after, false) || isAbsentImage(entry.after))
  );
}

function hasValidTransactionBinding(manifest: Record<string, unknown>): boolean {
  return (
    typeof manifest.transaction_id === 'string' &&
    /^[\da-f-]{36}$/iu.test(manifest.transaction_id) &&
    isSha256(manifest.plan_sha256)
  );
}

function hasValidBackupEntries(manifest: Record<string, unknown>): boolean {
  if (!Array.isArray(manifest.entries) || manifest.entries.length === 0) return false;
  if (!manifest.entries.every(isBackupEntry)) return false;
  return new Set(manifest.entries.map(entry => entry.path)).size === manifest.entries.length;
}

function isBackupManifest(value: unknown): value is BackupManifestV1 {
  if (typeof value !== 'object' || value === null) return false;
  const manifest = value as Record<string, unknown>;
  return (
    manifest.schema_version === 1 &&
    ['prepared', 'finalized', 'recovering'].includes(String(manifest.status)) &&
    hasValidTransactionBinding(manifest) &&
    hasValidBackupEntries(manifest)
  );
}

function manifestPlanDigest(entries: BackupEntry[]): string {
  const intent = entries.map(entry => ({
    path: entry.path,
    before: entry.before,
    after:
      entry.path === PROJECT_MARKER_PATH && entry.after.kind === 'file'
        ? { kind: 'file', mode: entry.after.mode }
        : entry.after,
  }));
  return sha256(Buffer.from(JSON.stringify(intent)));
}

function entryPathIsAllowed(path: string): boolean {
  return (
    path === CODEX_CONFIG_PATH ||
    path === PROJECT_MARKER_PATH ||
    path === BOOTSTRAP_PATH ||
    CODEX_MIGRATION_SCHEMA.legacyFiles.includes(path)
  );
}

function validateManifestIntent(manifest: BackupManifestV1): void {
  for (const [index, entry] of manifest.entries.entries()) {
    if (!entryPathIsAllowed(entry.path)) {
      throw new Error(`Recovery path ${entry.path} is not part of the Codex migration inventory.`);
    }
    if (entry.before.kind === 'file' && entry.before.payload !== `payloads/${index}.bin`) {
      throw new Error(`Codex migration backup payload identity is invalid for ${entry.path}.`);
    }
  }
  if (manifestPlanDigest(manifest.entries) !== manifest.plan_sha256) {
    throw new Error('Codex migration backup plan integrity check failed.');
  }
}

function backupPayloadsAreValid(cwd: string, manifest: BackupManifestV1): boolean {
  const backupDirectory = containedPath(cwd, BACKUP_PATH);
  return manifest.entries.every(entry => {
    if (entry.before.kind === 'absent') return true;
    const payload = entry.before.payload;
    if (payload === undefined) return false;
    const content = readFileSync(assertSafeComponents(backupDirectory, payload));
    return sha256(content) === entry.before.sha256;
  });
}

function validateRecoveryEntry(
  cwd: string,
  backupDirectory: string,
  entry: BackupEntry,
  allowBefore: boolean,
): void {
  const current = observedImage(cwd, entry.path);
  if (!imagesMatch(current, entry.after) && !(allowBefore && imagesMatch(current, entry.before))) {
    throw new Error(`Codex recovery conflict at ${entry.path}; no files were restored.`);
  }
  if (entry.before.kind === 'file') {
    if (entry.before.payload === undefined) {
      throw new Error(`Codex migration backup payload is missing for ${entry.path}.`);
    }
    const content = readFileSync(containedPath(backupDirectory, entry.before.payload));
    if (sha256(content) !== entry.before.sha256) {
      throw new Error(`Codex migration backup payload is corrupt for ${entry.path}.`);
    }
  }
}

export function recoverCodexFinalization(cwd: string): boolean {
  const manifestPath = containedPath(cwd, `${BACKUP_PATH}/manifest.json`);
  if (!pathEntryExists(containedPath(cwd, BACKUP_PATH))) return false;
  if (!existsSync(manifestPath)) {
    throw new Error('Codex migration backup manifest is missing; recovery cannot continue.');
  }
  const { backupDirectory, manifest } = readBackupManifest(cwd);
  validateManifestIntent(manifest);
  const allowBefore = manifest.status !== 'finalized';
  for (const entry of manifest.entries) {
    validateRecoveryEntry(cwd, backupDirectory, entry, allowBefore);
  }

  manifest.status = 'recovering';
  writeManifest(backupDirectory, manifest);
  for (const entry of manifest.entries.toReversed()) {
    restoreBeforeImage(cwd, backupDirectory, entry);
  }
  rmSync(backupDirectory, { recursive: true });
  return true;
}

function rollbackAppliedEntries(input: {
  cwd: string;
  backupDirectory: string;
  entries: BackupEntry[];
  appliedCount: number;
  originalError: unknown;
  beforeRollback?: () => void;
}): void {
  try {
    input.beforeRollback?.();
    for (const entry of input.entries.slice(0, input.appliedCount)) {
      if (!imagesMatch(observedImage(input.cwd, entry.path), entry.after)) {
        throw new Error(
          `Codex rollback conflict at ${entry.path}; recovery evidence was retained.`,
        );
      }
    }
    for (let index = input.appliedCount - 1; index >= 0; index -= 1) {
      const entry = input.entries[index];
      if (entry === undefined) {
        throw new Error('Codex rollback plan is incomplete.', { cause: input.originalError });
      }
      restoreBeforeImage(input.cwd, input.backupDirectory, entry);
    }
    rmSync(input.backupDirectory, { recursive: true });
  } catch (rollbackError) {
    throw new Error(
      `Codex finalization failed (${String(
        input.originalError,
      )}) and rollback could not complete; recovery is required: ${String(rollbackError)}`,
      { cause: rollbackError },
    );
  }
}

export function applyCodexFinalization(
  cwd: string,
  mutations: CodexFinalizationMutation[],
  options: {
    afterPrepared?: () => void;
    beforeMutation?: (index: number) => void;
    beforeRollback?: () => void;
  } = {},
): BackupManifestV1 {
  const backupDirectory = assertSafeComponents(cwd, BACKUP_PATH);
  if (existsSync(backupDirectory)) {
    throw new Error(`Codex migration backup already exists at ${BACKUP_PATH}.`);
  }
  validateCodexFinalizationPaths(cwd, mutations);
  mkdirSync(nodePath.join(backupDirectory, 'payloads'), { recursive: true, mode: 0o700 });

  const transactionId = randomUUID();
  let effectiveMutations = mutations.map(mutation => ({ ...mutation }));
  let entries = effectiveMutations.map((mutation, index) => {
    const before = beforeImage(cwd, backupDirectory, mutation, index);
    return { path: mutation.path, before, after: afterImage(mutation, before) };
  });
  const planSha256 = manifestPlanDigest(entries);
  effectiveMutations = effectiveMutations.map(mutation =>
    mutation.path === PROJECT_MARKER_PATH && mutation.content !== null
      ? {
          ...mutation,
          content: `${JSON.stringify({
            schema_version: 1,
            mode: 'plugin',
            transaction_id: transactionId,
            plan_sha256: planSha256,
          })}\n`,
        }
      : mutation,
  );
  entries = effectiveMutations.map((mutation, index) => {
    const previous = entries[index];
    if (previous === undefined) throw new Error('Codex migration plan changed during preparation.');
    return {
      path: mutation.path,
      before: previous.before,
      after: afterImage(mutation, previous.before),
    };
  });
  const manifest: BackupManifestV1 = {
    schema_version: 1,
    status: 'prepared',
    transaction_id: transactionId,
    plan_sha256: planSha256,
    entries,
  };
  writeManifest(backupDirectory, manifest);
  options.afterPrepared?.();

  let appliedCount = 0;
  try {
    for (const [index, mutation] of effectiveMutations.entries()) {
      options.beforeMutation?.(index);
      const entry = entries[index];
      if (entry === undefined) throw new Error('Codex migration plan changed during execution.');
      if (!imagesMatch(observedImage(cwd, entry.path), entry.before)) {
        throw new Error(
          `Codex migration path ${entry.path} changed after the Codex migration backup was prepared.`,
        );
      }
      applyMutation(cwd, mutation, entry.after);
      appliedCount += 1;
    }
  } catch (error) {
    rollbackAppliedEntries({
      cwd,
      backupDirectory,
      entries,
      appliedCount,
      originalError: error,
      beforeRollback: options.beforeRollback,
    });
    throw error;
  }

  manifest.status = 'finalized';
  writeManifest(backupDirectory, manifest);
  return manifest;
}
