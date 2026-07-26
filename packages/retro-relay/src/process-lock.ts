import {
  closeSync,
  openSync,
  type PathLike,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import process from 'node:process';

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

export class ProcessLock {
  static acquire(lockPath: PathLike): ProcessLock {
    try {
      return ProcessLock.#create(lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- The caller supplies the explicit deployment lock path.
      const existing = Number(readFileSync(lockPath, 'utf8'));
      if (!Number.isSafeInteger(existing) || existing <= 0 || isAlive(existing)) {
        throw new Error('retro relay database is already locked', { cause: error });
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- This removes only the validated stale lock.
      unlinkSync(lockPath);
      return ProcessLock.#create(lockPath);
    }
  }

  static #create(lockPath: PathLike): ProcessLock {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- The caller supplies the explicit deployment lock path.
    const descriptor = openSync(lockPath, 'wx', 0o600);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- The descriptor is the exclusive lock just created.
    writeFileSync(descriptor, String(process.pid), 'utf8');
    return new ProcessLock(lockPath, descriptor);
  }

  readonly #descriptor: number;
  readonly #lockPath: PathLike;
  #released = false;

  private constructor(lockPath: PathLike, descriptor: number) {
    this.#lockPath = lockPath;
    this.#descriptor = descriptor;
  }

  release(): void {
    if (this.#released) return;
    this.#released = true;
    closeSync(this.#descriptor);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- This instance owns the lock path and descriptor.
    unlinkSync(this.#lockPath);
  }
}
