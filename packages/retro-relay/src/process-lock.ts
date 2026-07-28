import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const activePaths = new Set<string>();

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

export class ProcessLock {
  static acquire(lockPath: string): ProcessLock {
    const normalizedPath = path.resolve(lockPath);
    if (activePaths.has(normalizedPath)) {
      throw new Error('retro relay database is already locked');
    }
    try {
      return ProcessLock.#create(normalizedPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- The caller supplies the explicit deployment lock path.
      const existing = Number(readFileSync(normalizedPath, 'utf8'));
      if (
        !Number.isSafeInteger(existing) ||
        existing <= 0 ||
        (existing !== process.pid && isAlive(existing))
      ) {
        throw new Error('retro relay database is already locked', { cause: error });
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- This removes only the validated stale lock.
      unlinkSync(normalizedPath);
      return ProcessLock.#create(normalizedPath);
    }
  }

  static #create(lockPath: string): ProcessLock {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- The caller supplies the explicit deployment lock path.
    const descriptor = openSync(lockPath, 'wx', 0o600);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- The descriptor is the exclusive lock just created.
    writeFileSync(descriptor, String(process.pid), 'utf8');
    activePaths.add(lockPath);
    return new ProcessLock(lockPath, descriptor);
  }

  readonly #descriptor: number;
  readonly #lockPath: string;
  #released = false;

  private constructor(lockPath: string, descriptor: number) {
    this.#lockPath = lockPath;
    this.#descriptor = descriptor;
  }

  release(): void {
    if (this.#released) return;
    this.#released = true;
    try {
      closeSync(this.#descriptor);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- This instance owns the lock path and descriptor.
      unlinkSync(this.#lockPath);
    } finally {
      activePaths.delete(this.#lockPath);
    }
  }
}
