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
  entries: BackupEntry[];
}

const BACKUP_PATH = '.safeword/codex-migration-backup';
const PROJECT_MARKER_PATH = '.safeword/codex-plugin.json';

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

export function codexFinalizationIsComplete(cwd: string): boolean {
  try {
    const marker = JSON.parse(
      readFileSync(containedPath(cwd, PROJECT_MARKER_PATH), 'utf8'),
    ) as Record<string, unknown>;
    const manifest = JSON.parse(
      readFileSync(containedPath(cwd, `${BACKUP_PATH}/manifest.json`), 'utf8'),
    ) as Record<string, unknown>;
    return (
      marker.schema_version === 1 &&
      marker.mode === 'plugin' &&
      manifest.schema_version === 1 &&
      manifest.status === 'finalized'
    );
  } catch {
    return false;
  }
}

export function codexRecoveryIsRequired(cwd: string): boolean {
  return (
    existsSync(containedPath(cwd, `${BACKUP_PATH}/manifest.json`)) &&
    !codexFinalizationIsComplete(cwd)
  );
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
    if (!existsSync(cursor)) continue;
    const metadata = lstatSync(cursor);
    if (metadata.isSymbolicLink()) {
      throw new Error(`Unsafe Codex migration path is a symbolic link: ${relativePath}`);
    }
    if (cursor === target ? !metadata.isFile() : !metadata.isDirectory()) {
      throw new Error(`Unsafe Codex migration path is not a regular file: ${relativePath}`);
    }
  }
  return target;
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
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as BackupManifestV1;
  if (
    manifest.schema_version !== 1 ||
    !['prepared', 'finalized', 'recovering'].includes(manifest.status) ||
    !Array.isArray(manifest.entries)
  ) {
    throw new Error('Codex migration backup manifest is malformed.');
  }
  return { backupDirectory, manifest };
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
  if (!existsSync(manifestPath)) return false;
  const { backupDirectory, manifest } = readBackupManifest(cwd);
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
    beforeMutation?: (index: number) => void;
    beforeRollback?: () => void;
  } = {},
): BackupManifestV1 {
  const backupDirectory = containedPath(cwd, BACKUP_PATH);
  if (existsSync(backupDirectory)) {
    throw new Error(`Codex migration backup already exists at ${BACKUP_PATH}.`);
  }
  mkdirSync(nodePath.join(backupDirectory, 'payloads'), { recursive: true, mode: 0o700 });

  const entries = mutations.map((mutation, index) => {
    const before = beforeImage(cwd, backupDirectory, mutation, index);
    return { path: mutation.path, before, after: afterImage(mutation, before) };
  });
  const manifest: BackupManifestV1 = {
    schema_version: 1,
    status: 'prepared',
    entries,
  };
  writeManifest(backupDirectory, manifest);

  let appliedCount = 0;
  try {
    for (const [index, mutation] of mutations.entries()) {
      options.beforeMutation?.(index);
      const entry = entries[index];
      if (entry === undefined) throw new Error('Codex migration plan changed during execution.');
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
