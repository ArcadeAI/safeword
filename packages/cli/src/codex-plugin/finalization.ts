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
  status: 'prepared' | 'finalized';
  entries: BackupEntry[];
}

const BACKUP_PATH = '.safeword/codex-migration-backup';

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

export function applyCodexFinalization(
  cwd: string,
  mutations: CodexFinalizationMutation[],
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

  for (const [index, mutation] of mutations.entries()) {
    const entry = entries[index];
    if (entry === undefined) throw new Error('Codex migration plan changed during execution.');
    applyMutation(cwd, mutation, entry.after);
  }

  manifest.status = 'finalized';
  writeManifest(backupDirectory, manifest);
  return manifest;
}
