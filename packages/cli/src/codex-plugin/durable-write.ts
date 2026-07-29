import { randomUUID } from 'node:crypto';
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

export function writeDurableFile(
  path: string,
  content: Buffer | string,
  options: {
    readonly mode: number;
    readonly beforeRename?: () => void;
  },
): void {
  const directory = nodePath.dirname(path);
  mkdirSync(directory, { recursive: true });
  const temporaryPath = nodePath.join(
    directory,
    `.${nodePath.basename(path)}-${process.pid}-${randomUUID()}.tmp`,
  );
  try {
    const descriptor = openSync(temporaryPath, 'wx', options.mode);
    try {
      writeFileSync(descriptor, content);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    options.beforeRename?.();
    durableRename(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

/** Publish a rename and persist the containing directory entry when supported. */
export function durableRename(source: string, destination: string): void {
  renameSync(source, destination);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(nodePath.dirname(destination), 'r');
    fsyncSync(descriptor);
  } catch (error: unknown) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';
    if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM', 'EBADF'].includes(code)) throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}
