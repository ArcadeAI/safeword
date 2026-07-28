import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { ProcessLock } from '../src/process-lock.js';
import { RelayStore } from '../src/store.js';

const temporaryDirectories: string[] = [];

function spawnDocker(arguments_: string[], timeout: number) {
  const options = { encoding: 'utf8' as const, timeout };
  const systemDocker = path.join(path.sep, 'usr', 'bin', 'docker');
  const localDocker = path.join(path.sep, 'usr', 'local', 'bin', 'docker');
  return spawnSync(existsSync(systemDocker) ? systemDocker : localDocker, arguments_, options);
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
      const hostUid = process.getuid?.();
      const hostGid = process.getgid?.();
      if (hostUid === undefined || hostGid === undefined) {
        throw new Error('container qualification requires a POSIX host identity');
      }

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
        spawnDocker(
          [
            'run',
            '--rm',
            '--entrypoint',
            '/bin/chown',
            '--volume',
            `${dataDirectory}:/data`,
            image,
            '--recursive',
            `${hostUid}:${hostGid}`,
            '/data',
          ],
          60_000,
        );
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

    expect(dockerfile.match(/^FROM .+@sha256:[\da-f]{64}/gmu)).toHaveLength(2);
    expect(dockerfile).toContain('snapshot.debian.org/archive/debian/');
    expect(dockerfile).toContain('check-valid-until=no');
    expect(dockerfile).toContain('gosu=1.14-1+b10');
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

  it('excludes another process owner and reuses the released lock database', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-lock-'));
    temporaryDirectories.push(directory);
    const lockPath = path.join(directory, 'relay.lock');

    const lock = ProcessLock.acquire(lockPath);
    expect(() => ProcessLock.acquire(lockPath)).toThrow('already locked');
    expect(() => ProcessLock.acquire(`${directory}/./relay.lock`)).toThrow('already locked');
    lock.release();

    const recovered = ProcessLock.acquire(lockPath);
    recovered.release();
  });

  it('keeps an externally owned process lock until its store owner releases it', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-lock-ownership-'));
    temporaryDirectories.push(directory);
    const lockPath = path.join(directory, 'relay.lock');
    const lock = ProcessLock.acquire(lockPath);
    const store = RelayStore.open(path.join(directory, 'relay.sqlite'));
    const { startRelayServer } = await import('../src/http-server.js');
    const { CredentialRegistry } = await import('../src/auth.js');
    const { GitHubRestClient } = await import('../src/github.js');
    const credentials = new CredentialRegistry('pepper');
    credentials.issue({
      credentialId: 'test',
      harness: 'codex',
      installationId: 1,
      repository: 'arcadeai/safeword',
      roles: ['file'],
      secret: 'a'.repeat(64),
      subject: 'test',
      tenantId: 'test',
    });
    const relay = await startRelayServer({
      credentials,
      github: new GitHubRestClient({
        baseUrl: 'https://api.github.com',
        installationToken: () => Promise.resolve('token'),
      }),
      payloadKey: Buffer.alloc(32, 7),
      processLock: lock,
      store,
    });

    await new Promise<void>((resolve, reject) => {
      relay.server.close(error => {
        if (error === undefined) resolve();
        else reject(error);
      });
    });
    expect(() => ProcessLock.acquire(lockPath)).toThrow('already locked');
    store.close();
    lock.release();
    const recovered = ProcessLock.acquire(lockPath);
    recovered.release();
  });

  it('recovers immediately after a prior process exits without releasing', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-lock-crashed-owner-'));
    temporaryDirectories.push(directory);
    const lockPath = path.join(directory, 'relay.lock');
    const packageRoot = fileURLToPath(new URL('..', import.meta.url));
    const crashedOwner = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        "import { ProcessLock } from './dist/index.js'; ProcessLock.acquire(process.env.LOCK_PATH);",
      ],
      {
        cwd: packageRoot,
        env: { ...process.env, LOCK_PATH: lockPath },
        encoding: 'utf8',
      },
    );

    expect(crashedOwner.status, crashedOwner.stderr).toBe(0);
    const recovered = ProcessLock.acquire(lockPath);
    expect(() => ProcessLock.acquire(lockPath)).toThrow('already locked');
    recovered.release();
  });

  it('ignores an obsolete reclaim artifact beside the lock database', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-lock-orphan-'));
    temporaryDirectories.push(directory);
    const lockPath = path.join(directory, 'relay.lock');

    const initial = ProcessLock.acquire(lockPath);
    initial.release();
    writeFileSync(`${lockPath}.reclaim`, 'obsolete', 'utf8');

    const recovered = ProcessLock.acquire(lockPath);
    expect(() => ProcessLock.acquire(lockPath)).toThrow('already locked');
    recovered.release();
  });

  it('allows only one process to acquire the released lock database', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-retro-lock-race-'));
    temporaryDirectories.push(directory);
    const lockPath = path.join(directory, 'relay.lock');
    const initial = ProcessLock.acquire(lockPath);
    initial.release();
    const packageRoot = fileURLToPath(new URL('..', import.meta.url));
    const startAt = Date.now() + 500;
    const contender = `
      import { ProcessLock } from './dist/index.js';
      const delay = Number(process.env.START_AT) - Date.now();
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
      try {
        const lock = ProcessLock.acquire(process.env.LOCK_PATH);
        process.stdout.write('acquired');
        await new Promise(resolve => setTimeout(resolve, 1000));
        lock.release();
      } catch {
        process.stdout.write('blocked');
      }
    `;
    const results = await Promise.all(
      Array.from({ length: 24 }, () => {
        const child = spawn(process.execPath, ['--input-type=module', '--eval', contender], {
          cwd: packageRoot,
          env: { ...process.env, LOCK_PATH: lockPath, START_AT: String(startAt) },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        return new Promise<string>((resolve, reject) => {
          let stdout = '';
          let stderr = '';
          child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
            stdout += chunk;
          });
          child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
            stderr += chunk;
          });
          child.once('error', reject);
          child.once('close', code => {
            if (code === 0) resolve(stdout);
            else reject(new Error(stderr || `lock contender exited ${String(code)}`));
          });
        });
      }),
    );

    expect(results.filter(result => result === 'acquired')).toHaveLength(1);
  });
});
