import {
  closeSync,
  fstatSync,
  linkSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const activePaths = new Set<string>();

function unlinkIfPresent(filePath: string): void {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- The caller supplies an explicit lock or reclaim path.
    unlinkSync(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

function locked(cause: unknown): Error {
  return new Error('retro relay database is already locked', { cause });
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
      return ProcessLock.#reclaim(normalizedPath, error as Error);
    }
  }

  static #reclaim(lockPath: string, originalError: Error): ProcessLock {
    const reclaimPath = `${lockPath}.reclaim`;
    const acquiredDuringElection = ProcessLock.#electReclaimer(lockPath, reclaimPath);
    if (acquiredDuringElection !== undefined) return acquiredDuringElection;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- The reclaim link is owned by this contender.
      const existing = Number(readFileSync(reclaimPath, 'utf8'));
      if (
        !Number.isSafeInteger(existing) ||
        existing <= 0 ||
        (existing !== process.pid && isAlive(existing))
      ) {
        throw locked(originalError);
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Both stats verify the elected inode before removal.
      const currentLock = statSync(lockPath);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Both stats verify the elected inode before removal.
      const electedLock = statSync(reclaimPath);
      if (currentLock.dev !== electedLock.dev || currentLock.ino !== electedLock.ino) {
        throw locked(originalError);
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Only the contender elected over this exact stale inode removes it.
      unlinkSync(lockPath);
      try {
        return ProcessLock.#create(lockPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        throw locked(error);
      }
    } finally {
      unlinkIfPresent(reclaimPath);
    }
  }

  static #electReclaimer(lockPath: string, reclaimPath: string): ProcessLock | undefined {
    try {
      // A fixed hard-link is an atomic election over the existing lock inode.
      // Contenders that did not create this link must never unlink the lock path.
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Both paths are derived from the explicit deployment lock path.
      linkSync(lockPath, reclaimPath);
      return undefined;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw locked(error);
      try {
        return ProcessLock.#create(lockPath);
      } catch (createError) {
        if ((createError as NodeJS.ErrnoException).code !== 'EEXIST') throw createError;
        throw locked(createError);
      }
    }
  }

  static #create(lockPath: string): ProcessLock {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- The caller supplies the explicit deployment lock path.
    const descriptor = openSync(lockPath, 'wx', 0o600);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- The descriptor is the exclusive lock just created.
    writeFileSync(descriptor, String(process.pid), 'utf8');
    const identity = fstatSync(descriptor);
    activePaths.add(lockPath);
    return new ProcessLock(lockPath, descriptor, identity.dev, identity.ino);
  }

  readonly #descriptor: number;
  readonly #device: number;
  readonly #inode: number;
  readonly #lockPath: string;
  #released = false;

  private constructor(lockPath: string, descriptor: number, device: number, inode: number) {
    this.#lockPath = lockPath;
    this.#descriptor = descriptor;
    this.#device = device;
    this.#inode = inode;
  }

  release(): void {
    if (this.#released) return;
    this.#released = true;
    try {
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- Ownership is checked against the open descriptor identity before removal.
        const current = statSync(this.#lockPath);
        if (current.dev === this.#device && current.ino === this.#inode) {
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- This instance owns the matching lock inode.
          unlinkSync(this.#lockPath);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      } finally {
        closeSync(this.#descriptor);
      }
    } finally {
      activePaths.delete(this.#lockPath);
    }
  }
}
