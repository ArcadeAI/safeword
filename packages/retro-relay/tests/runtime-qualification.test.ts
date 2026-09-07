import { spawn, spawnSync } from 'node:child_process';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createServer as createSecureServer } from 'node:https';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import type { CredentialInput } from '../src/auth.js';
import { CredentialRegistry } from '../src/auth.js';
import { ProcessLock } from '../src/process-lock.js';
import { RelayStore } from '../src/store.js';
import type { FileRetroDraftRequest } from '../src/types.js';

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

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('missing test port');
  await new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (error === undefined) resolve();
      else reject(error);
    });
  });
  return address.port;
}

function productionCredentials(): CredentialInput[] {
  const credential = (
    credentialId: string,
    harness: CredentialInput['harness'],
    secret: string,
    roles: CredentialInput['roles'],
  ): CredentialInput => ({
    credentialId,
    harness,
    installationId: 42,
    repository: 'arcadeai/safeword',
    roles,
    secret,
    subject: `${harness}-subject`,
    tenantId: 'safeword-production',
  });
  return [
    credential('claude-prod', 'claude', 'a'.repeat(64), ['file']),
    credential('codex-prod', 'codex', 'b'.repeat(64), ['file']),
    credential('cursor-prod', 'cursor', 'c'.repeat(64), ['file']),
    credential('operator-prod', 'operator', 'd'.repeat(64), ['reconcile', 'operate']),
    credential('collector-worker-prod', 'collector-worker', 'e'.repeat(64), ['ingest']),
  ];
}

function productionDraft(): FileRetroDraftRequest {
  return {
    body: 'The production process must wire the real collaborator chain.',
    canonicalKey: 'canonical:production-main',
    installationId: 42,
    labels: ['retro'],
    legacySignature: 'retro:production-main',
    repository: 'arcadeai/safeword',
    requestId: '00000000-0000-4000-8000-000000001479',
    retryDeadlineAt: '2099-01-01T00:00:00.000Z',
    title: 'Production entrypoint wiring',
  };
}

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
    expect(dockerfile).toContain('ARG NODE_VERSION=24.18.1');
    expect(dockerfile).toContain('sha256sum --check --strict');
    expect(dockerfile).toContain('snapshot.debian.org/archive/debian/');
    expect(dockerfile).toContain('check-valid-until=no');
    expect(dockerfile).toContain('gosu=1.14-1+b10');
    expect(dockerfile).toContain('useradd --uid 1000 --gid node');
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

  it('[ORR-039] runs the built production process through SQLite, HTTP auth, and GitHub', async () => {
    const packageRoot = fileURLToPath(new URL('..', import.meta.url));
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-relay-main-process-'));
    temporaryDirectories.push(directory);
    const certificate = path.join(directory, 'fixture.crt');
    const certificateKey = path.join(directory, 'fixture.key');
    const openssl =
      process.platform === 'darwin'
        ? path.join(path.sep, 'opt', 'homebrew', 'bin', 'openssl')
        : path.join(path.sep, 'usr', 'bin', 'openssl');
    const certificateResult = spawnSync(
      openssl,
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        certificateKey,
        '-out',
        certificate,
        '-subj',
        '/CN=127.0.0.1',
        '-addext',
        'subjectAltName=IP:127.0.0.1',
        '-days',
        '1',
      ],
      { encoding: 'utf8' },
    );
    expect(certificateResult.status, certificateResult.stderr).toBe(0);

    const createdBodies: string[] = [];
    const github = createSecureServer(
      {
        cert: readFileSync(certificate),
        key: readFileSync(certificateKey),
      },
      (request, response) => {
        void (async () => {
          if (request.method === 'POST' && request.url?.endsWith('/access_tokens')) {
            response.setHeader('content-type', 'application/json');
            response.end(
              JSON.stringify({
                expires_at: '2099-01-01T00:00:00.000Z',
                permissions: { issues: 'write' },
                token: 'ghs_fixture_token',
              }),
            );
            return;
          }
          if (request.method === 'POST' && request.url?.endsWith('/issues')) {
            let body = '';
            for await (const chunk of request) body += String(chunk);
            createdBodies.push((JSON.parse(body) as { body: string }).body);
            response.statusCode = 201;
            response.setHeader('content-type', 'application/json');
            response.end(JSON.stringify({ number: 1479 }));
            return;
          }
          response.statusCode = 404;
          response.end();
        })();
      },
    );
    await new Promise<void>((resolve, reject) => {
      github.once('error', reject);
      github.listen(0, '127.0.0.1', resolve);
    });
    const githubAddress = github.address();
    if (githubAddress === null || typeof githubAddress === 'string') {
      throw new Error('missing GitHub fixture address');
    }

    const credentials = productionCredentials();
    const pepper = randomBytes(32).toString('hex');
    const registry = new CredentialRegistry(pepper);
    const primaryCredential = credentials.at(0);
    if (primaryCredential === undefined) throw new Error('missing production credential fixture');
    const authorization = registry.issue(primaryCredential);
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateKeyBase64 = Buffer.from(
      privateKey.export({ format: 'pem', type: 'pkcs8' }),
    ).toString('base64');
    const relayPort = await availablePort();
    const child = spawn(process.execPath, ['dist/main.js'], {
      cwd: packageRoot,
      env: {
        ...process.env,
        GITHUB_API_BASE_URL: `https://127.0.0.1:${githubAddress.port}`,
        GITHUB_APP_ID: '1',
        GITHUB_APP_PRIVATE_KEY_BASE64: privateKeyBase64,
        GITHUB_INSTALLATION_ID: '42',
        GITHUB_REPOSITORY: 'arcadeai/safeword',
        HOST: '0.0.0.0',
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        PORT: String(relayPort),
        RAILWAY_REPLICA_ID: 'production-entrypoint-test',
        RELAY_CREDENTIAL_PEPPER: pepper,
        RELAY_CREDENTIALS_BASE64: Buffer.from(JSON.stringify(credentials)).toString('base64'),
        RELAY_DATA_DIR: directory,
        RELAY_MODE: 'production',
        RELAY_PAYLOAD_KEY: randomBytes(32).toString('base64'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
    });

    try {
      await expect
        .poll(
          () => {
            if (child.exitCode !== null) {
              throw new Error(`production entrypoint exited ${String(child.exitCode)}: ${stderr}`);
            }
            return stdout;
          },
          {
            interval: 10,
            message: `production entrypoint did not become ready: ${stderr}`,
            timeout: 10_000,
          },
        )
        .toContain('"relay_ready"');
      expect(stdout).toContain(`"url":"http://127.0.0.1:${relayPort}"`);

      const response = await fetch(`http://127.0.0.1:${relayPort}/v1/retro-filings`, {
        body: JSON.stringify(productionDraft()),
        headers: {
          authorization: `Bearer ${authorization}`,
          'content-type': 'application/json',
        },
        method: 'POST',
      });
      expect(response.status, await response.text()).toBe(201);
      expect(createdBodies).toHaveLength(1);
      expect(existsSync(path.join(directory, 'relay.sqlite'))).toBe(true);
    } finally {
      child.kill('SIGTERM');
      await new Promise<void>(resolve => {
        if (child.exitCode === null) {
          child.once('exit', () => {
            resolve();
          });
        } else {
          resolve();
        }
      });
      await new Promise<void>(resolve => {
        github.close(() => {
          resolve();
        });
      });
    }
  }, 30_000);

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
    const contender = String.raw`
      import { ProcessLock } from './dist/index.js';
      process.stdout.write('ready\n');
      await new Promise(resolve => process.stdin.once('data', resolve));
      try {
        const lock = ProcessLock.acquire(process.env.LOCK_PATH);
        process.stdout.write('acquired\n');
        await new Promise(resolve => process.stdin.once('data', resolve));
        lock.release();
      } catch {
        process.stdout.write('blocked\n');
      }
    `;
    const contenders = Array.from({ length: 24 }, () => {
      const child = spawn(process.execPath, ['--input-type=module', '--eval', contender], {
        cwd: packageRoot,
        env: { ...process.env, LOCK_PATH: lockPath },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
      const closed = new Promise<void>((resolve, reject) => {
        let stderr = '';
        child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
          stderr += chunk;
        });
        child.once('error', reject);
        child.once('close', code => {
          if (code === 0) resolve();
          else reject(new Error(stderr || `lock contender exited ${String(code)}`));
        });
      });
      return { child, closed, lines };
    });

    const ready = await Promise.all(contenders.map(({ lines }) => lines.next()));
    expect(ready.map(result => result.value)).toEqual(Array.from({ length: 24 }, () => 'ready'));

    for (const { child } of contenders) child.stdin.write('start\n');
    const outcomes = await Promise.all(contenders.map(({ lines }) => lines.next()));
    const results = outcomes.map(result => result.value);

    for (const [index, { child }] of contenders.entries()) {
      child.stdin.end(results.at(index) === 'acquired' ? 'release\n' : undefined);
    }
    await Promise.all(contenders.map(({ closed }) => closed));

    expect(results.filter(result => result === 'acquired')).toHaveLength(1);
    expect(results.filter(result => result === 'blocked')).toHaveLength(23);
  }, 30_000);
});
