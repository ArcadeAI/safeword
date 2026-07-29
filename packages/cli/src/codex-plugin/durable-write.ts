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
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}
