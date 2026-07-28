import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { ProcessLock } from '../src/process-lock.js';
import { RelayStore } from '../src/store.js';

const temporaryDirectories: string[] = [];

function spawnDocker(arguments_: string[], timeout: number) {
  const options = { encoding: 'utf8' as const, timeout };
  if (existsSync('/usr/bin/docker')) return spawnSync('/usr/bin/docker', arguments_, options);
  return spawnSync('/usr/local/bin/docker', arguments_, options);
}

const dockerAvailable = spawnDocker(['info'], 10_000).status === 0;
const containerQualificationEnabled =
  process.env.CI === 'true' && process.versions.node.startsWith('24.') && dockerAvailable;

afterEach(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
  temporaryDirectories.length = 0;
});

describe('retro relay runtime qualification', () => {
  it.runIf(containerQualificationEnabled)(
    'builds the production image and drops root after repairing the mounted volume',
    () => {
      const packageRoot = fileURLToPath(new URL('..', import.meta.url));
      const repoRoot = path.resolve(packageRoot, '..', '..');
      const dataDirectory = mkdtempSync(path.join(tmpdir(), 'safeword-relay-container-'));
      chmodSync(dataDirectory, 0o777);
      temporaryDirectories.push(dataDirectory);
      const image = `safeword-retro-relay-qualification:${process.pid}`;

      try {
        const build = spawnDocker(
          ['build', '--tag', image, '--file', path.join(packageRoot, 'Dockerfile'), repoRoot],
          5 * 60_000,
        );
        expect(build.error, String(build.error)).toBeUndefined();
        expect(build.status, build.stderr || build.stdout).toBe(0);

        const run = spawnDocker(
          [
            'run',
            '--rm',
            '--volume',
            `${dataDirectory}:/data`,
            image,
            '/bin/sh',
            '-c',
            'test "$(id -u)" = 1000 && test "$(stat -c %u /data)" = 1000',
          ],
          60_000,
        );
        expect(run.error, String(run.error)).toBeUndefined();
        expect(run.status, run.stderr || run.stdout).toBe(0);
      } finally {
        spawnDocker(['image', 'rm', '--force', image], 60_000);
      }
    },
    6 * 60_000,
  );

  it('drops root after repairing Railway volume ownership', () => {
    const packageRoot = fileURLToPath(new URL('..', import.meta.url));
    const dockerfile = readFileSync(path.join(packageRoot, 'Dockerfile'), 'utf8');
    const entrypoint = readFileSync(
      path.join(packageRoot, 'scripts', 'container-entrypoint.sh'),
      'utf8',
    );

    expect(dockerfile).toContain('ENTRYPOINT ["relay-entrypoint"]');
    expect(entrypoint).toContain('chown -R node:node');
    expect(entrypoint).toContain('exec gosu node "$@"');

    const unsafe = spawnSync(
      '/bin/sh',
      [path.join(packageRoot, 'scripts', 'container-entrypoint.sh')],
      {
        encoding: 'utf8',
        env: { ...process.env, RELAY_DATA_DIR: '/' },
      },
    );
    expect(unsafe.status).toBe(1);
    expect(unsafe.stderr).toContain('RELAY_DATA_DIR must be /data');
  });

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
    expect(first.schemaVersion()).toBe(4);
    first.close();

    const reopened = RelayStore.open(databasePath);
    expect(reopened.journalMode()).toBe('wal');
    expect(reopened.schemaVersion()).toBe(4);
    reopened.close();
  });

  it('excludes another process owner and recovers a stale lock', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-lock-'));
    temporaryDirectories.push(directory);
    const lockPath = path.join(directory, 'relay.lock');

    const lock = ProcessLock.acquire(lockPath);
    expect(() => ProcessLock.acquire(lockPath)).toThrow('already locked');
    expect(() => ProcessLock.acquire(`${directory}/./relay.lock`)).toThrow('already locked');
    lock.release();

    writeFileSync(lockPath, '2147483647', 'utf8');
    const recovered = ProcessLock.acquire(lockPath);
    recovered.release();
  });

  it('recovers a lock left by a prior container that reused this process pid', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-lock-reused-pid-'));
    temporaryDirectories.push(directory);
    const lockPath = path.join(directory, 'relay.lock');

    writeFileSync(lockPath, String(process.pid), 'utf8');
    const recovered = ProcessLock.acquire(lockPath);
    expect(() => ProcessLock.acquire(lockPath)).toThrow('already locked');
    recovered.release();
  });
});
