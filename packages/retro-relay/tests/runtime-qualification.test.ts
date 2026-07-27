import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { ProcessLock } from '../src/process-lock.js';
import { RelayStore } from '../src/store.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
  temporaryDirectories.length = 0;
});

describe('retro relay runtime qualification', () => {
  it('loads the built public entrypoint on the active Node runtime', () => {
    const packageRoot = fileURLToPath(new URL('..', import.meta.url));
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', "await import('./dist/index.js')"],
      {
        cwd: packageRoot,
        encoding: 'utf8',
      },
    );

    expect(result.error, String(result.error)).toBeUndefined();
    expect(result.status, result.stderr || '<no stderr>').toBe(0);
  });

  it('loads the built-in driver, enables WAL, migrates, and reopens on the active runtime', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-relay-'));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, 'relay.sqlite');

    const first = RelayStore.open(databasePath);
    expect(first.journalMode()).toBe('wal');
    expect(first.schemaVersion()).toBe(3);
    first.close();

    const reopened = RelayStore.open(databasePath);
    expect(reopened.journalMode()).toBe('wal');
    expect(reopened.schemaVersion()).toBe(3);
    reopened.close();
  });

  it('excludes another process owner and recovers a stale lock', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-lock-'));
    temporaryDirectories.push(directory);
    const lockPath = path.join(directory, 'relay.lock');

    const lock = ProcessLock.acquire(lockPath);
    expect(() => ProcessLock.acquire(lockPath)).toThrow('already locked');
    lock.release();

    writeFileSync(lockPath, '2147483647', 'utf8');
    const recovered = ProcessLock.acquire(lockPath);
    recovered.release();
  });
});
