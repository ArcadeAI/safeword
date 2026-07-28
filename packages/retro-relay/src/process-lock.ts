import path from 'node:path';

import Database from './sqlite.js';

const activePaths = new Set<string>();

function locked(cause?: unknown): Error {
  return new Error('retro relay database is already locked', { cause });
}

export class ProcessLock {
  static acquire(lockPath: string): ProcessLock {
    const normalizedPath = path.resolve(lockPath);
    if (activePaths.has(normalizedPath)) throw locked();

    const database = new Database(normalizedPath, { timeout: 0 });
    try {
      database.exec('BEGIN EXCLUSIVE;');
      database.exec(
        'CREATE TABLE IF NOT EXISTS process_lock (singleton INTEGER PRIMARY KEY CHECK (singleton = 1));',
      );
    } catch (error) {
      database.close();
      throw locked(error);
    }

    activePaths.add(normalizedPath);
    return new ProcessLock(normalizedPath, database);
  }

  readonly #database: Database;
  readonly #lockPath: string;
  #released = false;

  private constructor(lockPath: string, database: Database) {
    this.#lockPath = lockPath;
    this.#database = database;
  }

  release(): void {
    if (this.#released) return;
    this.#released = true;
    try {
      this.#database.close();
    } finally {
      activePaths.delete(this.#lockPath);
    }
  }
}
