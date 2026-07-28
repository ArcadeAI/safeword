import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseRuntimeConfig, RelayStore, startRelayRuntime } from '../src/index.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKeyBase64 = Buffer.from(privateKey.export({ format: 'pem', type: 'pkcs8' })).toString(
  'base64',
);

function validEnvironment(dataDirectory: string): NodeJS.ProcessEnv {
  return {
    HOST: '0.0.0.0',
    PORT: '3000',
    RELAY_DATA_DIR: dataDirectory,
    RELAY_PAYLOAD_KEY: randomBytes(32).toString('base64'),
    RELAY_CREDENTIAL_PEPPER: randomBytes(32).toString('hex'),
    RELAY_CREDENTIAL_ID: 'railway-spike',
    RELAY_CREDENTIAL_SECRET: randomBytes(32).toString('hex'),
    RELAY_TENANT_ID: 'safeword-spike',
    RELAY_SUBJECT: 'railway-spike',
    RELAY_HARNESS: 'codex',
    RELAY_MODE: 'spike',
    GITHUB_APP_ID: '1',
    GITHUB_APP_PRIVATE_KEY_BASE64: privateKeyBase64,
    GITHUB_INSTALLATION_ID: '1',
    GITHUB_REPOSITORY: 'ArcadeAI/safeword',
  };
}

function productionEnvironment(dataDirectory: string): NodeJS.ProcessEnv {
  const environment = validEnvironment(dataDirectory);
  environment.RELAY_MODE = 'production';
  const installationId = 1;
  const repo = 'arcadeai/safeword';
  const credential = (
    credentialId: string,
    harness: 'claude' | 'codex' | 'cursor' | 'operator',
    secret: string,
    roles: ('file' | 'reconcile' | 'operate')[],
  ) => ({
    credentialId,
    harness,
    installationId,
    repository: repo,
    roles,
    secret,
    subject: `${harness}-subject`,
    tenantId: 'safeword-production',
  });
  const credentials = [
    credential('claude-prod', 'claude', 'a'.repeat(64), ['file']),
    credential('codex-prod', 'codex', 'b'.repeat(64), ['file']),
    credential('cursor-prod', 'cursor', 'c'.repeat(64), ['file']),
    credential('operator-prod', 'operator', 'd'.repeat(64), ['reconcile', 'operate']),
  ];
  environment.RELAY_CREDENTIALS_BASE64 = Buffer.from(JSON.stringify(credentials)).toString(
    'base64',
  );
  for (const name of [
    'RELAY_CREDENTIAL_ID',
    'RELAY_CREDENTIAL_SECRET',
    'RELAY_TENANT_ID',
    'RELAY_SUBJECT',
    'RELAY_HARNESS',
  ]) {
    Reflect.deleteProperty(environment, name);
  }
  return environment;
}

const runtimeDirectories: string[] = [];

afterEach(() => {
  for (const directory of runtimeDirectories) rmSync(directory, { force: true, recursive: true });
  runtimeDirectories.length = 0;
});

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

describe('production runtime configuration', () => {
  it.each([
    'HOST',
    'PORT',
    'RELAY_MODE',
    'RELAY_DATA_DIR',
    'RELAY_PAYLOAD_KEY',
    'RELAY_CREDENTIAL_PEPPER',
    'RELAY_CREDENTIAL_ID',
    'RELAY_CREDENTIAL_SECRET',
    'RELAY_TENANT_ID',
    'RELAY_SUBJECT',
    'RELAY_HARNESS',
    'GITHUB_APP_ID',
    'GITHUB_APP_PRIVATE_KEY_BASE64',
    'GITHUB_INSTALLATION_ID',
    'GITHUB_REPOSITORY',
  ])('rejects missing %s before touching the durable directory', variable => {
    const dataDirectory = path.join(process.cwd(), '.tmp-never-created', variable);
    const environment = validEnvironment(dataDirectory);
    Reflect.deleteProperty(environment, variable);

    expect(() => parseRuntimeConfig(environment)).toThrow(`missing ${variable}`);
    expect(existsSync(dataDirectory)).toBe(false);
  });

  it.each([
    ['HOST', '127.0.0.1'],
    ['HOST', ' '.repeat(3)],
    ['PORT', '0'],
    ['PORT', '65536'],
    ['PORT', 'not-a-port'],
    ['RELAY_DATA_DIR', 'relative/data'],
    ['RELAY_DATA_DIR', path.parse(process.cwd()).root],
    ['RELAY_PAYLOAD_KEY', 'invalid-base64'],
    ['RELAY_PAYLOAD_KEY', randomBytes(16).toString('base64')],
    ['RELAY_CREDENTIAL_SECRET', 'not-64-hex'],
    ['RELAY_HARNESS', 'unknown'],
    ['GITHUB_APP_ID', '0'],
    ['GITHUB_APP_ID', '1.5'],
    ['GITHUB_APP_ID', 'not-an-id'],
    ['GITHUB_APP_PRIVATE_KEY_BASE64', 'invalid-base64'],
    ['GITHUB_APP_PRIVATE_KEY_BASE64', Buffer.from('not a key').toString('base64')],
    ['GITHUB_INSTALLATION_ID', '0'],
    ['GITHUB_INSTALLATION_ID', '1.5'],
    ['GITHUB_INSTALLATION_ID', '-1'],
    ['GITHUB_REPOSITORY', 'missing-owner'],
    ['GITHUB_REPOSITORY', ' '.repeat(3)],
    ['RELAY_SUBJECT', ''],
    ['RELAY_TENANT_ID', ' '.repeat(3)],
  ])('rejects malformed %s=%s before touching the durable directory', (variable, value) => {
    const dataDirectory = path.join(process.cwd(), '.tmp-never-created', 'malformed');
    const environment = validEnvironment(dataDirectory);
    Reflect.set(environment, variable, value);

    expect(() => parseRuntimeConfig(environment)).toThrow();
    expect(existsSync(dataDirectory)).toBe(false);
  });

  it('binds the configured port, reports its replica, and releases its lock on shutdown', async () => {
    const dataDirectory = mkdtempSync(path.join(tmpdir(), 'safeword-runtime-'));
    runtimeDirectories.push(dataDirectory);
    const environment = validEnvironment(dataDirectory);
    environment.PORT = String(await availablePort());
    environment.RAILWAY_REPLICA_ID = 'replica-test';
    const config = parseRuntimeConfig(environment);
    const runtime = await startRelayRuntime(config, () => {});

    const response = await fetch(`${runtime.url}/health`);
    expect(response.status).toBe(200);
    const firstHealth = (await response.json()) as Record<string, unknown>;
    expect(firstHealth).toMatchObject({
      status: 'ok',
      schemaVersion: 4,
      replicaId: 'replica-test',
      bootId: expect.any(String),
    });

    await runtime.close();
    expect(existsSync(config.lockPath)).toBe(false);
    const reopened = await startRelayRuntime(config, () => {});
    const reopenedResponse = await fetch(`${reopened.url}/health`);
    const reopenedHealth = (await reopenedResponse.json()) as Record<string, unknown>;
    expect(reopenedHealth.bootId).not.toBe(firstHealth.bootId);
    await reopened.close();
  });

  it('loads independently rotatable production principals with the exact role matrix', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-runtime-principals-'));
    runtimeDirectories.push(directory);
    const config = parseRuntimeConfig(productionEnvironment(directory));

    expect(config.mode).toBe('production');
    expect(config.credentials.map(item => [item.harness, item.roles])).toEqual([
      ['claude', ['file']],
      ['codex', ['file']],
      ['cursor', ['file']],
      ['operator', ['reconcile', 'operate']],
    ]);
  });

  it.each([
    // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https -- This negative case proves production rejects cleartext credential transport.
    'http://api.github.com',
    'https://token@api.github.com',
    'https://api.github.com/api/v3',
    'https://api.github.com?token=secret',
  ])('rejects unsafe production GitHub API base URL %s', baseUrl => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-runtime-github-url-'));
    runtimeDirectories.push(directory);
    const environment = productionEnvironment(directory);
    environment.GITHUB_API_BASE_URL = baseUrl;

    expect(() => parseRuntimeConfig(environment)).toThrow('invalid production GITHUB_API_BASE_URL');
  });

  it('accepts a credential-free HTTPS GitHub API origin in production', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-runtime-github-origin-'));
    runtimeDirectories.push(directory);
    const environment = productionEnvironment(directory);
    environment.GITHUB_API_BASE_URL = 'https://github.example.com';

    expect(parseRuntimeConfig(environment).github.baseUrl).toBe('https://github.example.com');
  });

  it('rejects production principals split across tenant identity buckets', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-runtime-tenants-'));
    runtimeDirectories.push(directory);
    const environment = productionEnvironment(directory);
    const credentials = JSON.parse(
      Buffer.from(environment.RELAY_CREDENTIALS_BASE64 ?? '', 'base64').toString('utf8'),
    ) as { harness: string; tenantId: string }[];
    const operator = credentials.find(item => item.harness === 'operator');
    if (operator === undefined) throw new Error('missing operator credential');
    operator.tenantId = 'different-tenant';
    environment.RELAY_CREDENTIALS_BASE64 = Buffer.from(JSON.stringify(credentials)).toString(
      'base64',
    );

    expect(() => parseRuntimeConfig(environment)).toThrow(
      'production relay principals must share one tenant',
    );
  });

  it('loads a versioned payload keyring and selects one active encryption key', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-runtime-keyring-'));
    runtimeDirectories.push(directory);
    const environment = validEnvironment(directory);
    Reflect.deleteProperty(environment, 'RELAY_PAYLOAD_KEY');
    environment.RELAY_PAYLOAD_KEYRING_BASE64 = Buffer.from(
      JSON.stringify({
        activeKeyId: '2026-07',
        keys: {
          '2026-06': Buffer.alloc(32, 1).toString('base64'),
          '2026-07': Buffer.alloc(32, 2).toString('base64'),
        },
      }),
    ).toString('base64');

    const keyring = parseRuntimeConfig(environment).payloadKeyring;

    expect(keyring.activeKeyId).toBe('2026-07');
    expect(keyring.keys.get('2026-06')).toEqual(Buffer.alloc(32, 1));
    expect(keyring.keys.get('2026-07')).toEqual(Buffer.alloc(32, 2));
  });

  it('fails startup with the exact durable payload key that is missing', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-runtime-missing-key-'));
    runtimeDirectories.push(directory);
    const environment = validEnvironment(directory);
    const config = parseRuntimeConfig(environment);
    const store = RelayStore.open(config.databasePath);
    store.accept({
      envelope: {
        ciphertext: Buffer.from('ciphertext'),
        formatVersion: 2,
        keyId: 'retired-2026-06',
        nonce: Buffer.alloc(12, 1),
        tag: Buffer.alloc(16, 2),
      },
      payloadHash: 'hash',
      requestMarker: '<!-- marker -->',
      retryDeadlineAt: '2099-01-01T00:00:00.000Z',
      scope: {
        installationId: 1,
        repository: 'arcadeai/safeword',
        requestId: '00000000-0000-4000-8000-000000000147',
        tenantId: 'safeword-spike',
      },
    });
    store.close();

    await expect(startRelayRuntime(config, () => {})).rejects.toThrow(
      'missing relay payload keys: retired-2026-06',
    );
  });

  it('rejects legacy credentials outside explicit spike mode', () => {
    const directory = path.join(process.cwd(), '.tmp-never-created', 'legacy-production');
    const environment = validEnvironment(directory);
    environment.RELAY_MODE = 'production';

    expect(() => parseRuntimeConfig(environment)).toThrow('RELAY_CREDENTIALS_BASE64');
    expect(existsSync(directory)).toBe(false);
  });

  it('exposes health only in spike mode before auth storage or GitHub collaborators', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-runtime-health-only-'));
    runtimeDirectories.push(directory);
    const environment = validEnvironment(directory);
    environment.PORT = String(await availablePort());
    const runtime = await startRelayRuntime(parseRuntimeConfig(environment), () => {});

    const attempts = [
      ['POST', '/v1/retro-filings'],
      ['GET', '/v1/retro-filings/receipt'],
      ['POST', '/v1/retro-filings/receipt/reconcile'],
      ['GET', '/v1/operations/retro-filings'],
    ] as const;
    for (const [method, route] of attempts) {
      const response = await fetch(`${runtime.url}${route}`, {
        method,
        headers: { authorization: runtime.authorization },
        ...(method === 'POST' && {
          body: JSON.stringify({
            body: 'body',
            canonicalKey: 'canonical:key',
            installationId: 1,
            labels: ['retro'],
            legacySignature: 'retro:key',
            repository: 'arcadeai/safeword',
            requestId: '00000000-0000-4000-8000-000000000001',
            retryDeadlineAt: '2099-01-01T00:00:00.000Z',
            title: 'title',
          }),
        }),
      });
      expect(response.status).toBe(503);
    }
    const healthResponse = await fetch(`${runtime.url}/health`);
    expect(healthResponse.status).toBe(200);
    await runtime.close();
  });

  it('denies operator filing and harness reconciliation before GitHub access', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-runtime-role-denials-'));
    runtimeDirectories.push(directory);
    const environment = productionEnvironment(directory);
    environment.PORT = String(await availablePort());
    const runtime = await startRelayRuntime(parseRuntimeConfig(environment), () => {});
    const body = JSON.stringify({
      body: 'body',
      canonicalKey: 'canonical:key',
      installationId: 1,
      labels: ['retro'],
      legacySignature: 'retro:key',
      repository: 'arcadeai/safeword',
      requestId: '00000000-0000-4000-8000-000000000001',
      retryDeadlineAt: '2099-01-01T00:00:00.000Z',
      title: 'title',
    });

    const operatorFile = await fetch(`${runtime.url}/v1/retro-filings`, {
      body,
      headers: { authorization: `Bearer ${runtime.authorizations.operator}` },
      method: 'POST',
    });
    expect(operatorFile.status).toBe(403);
    const harnessReconcile = await fetch(`${runtime.url}/v1/retro-filings/missing/reconcile`, {
      headers: { authorization: `Bearer ${runtime.authorizations.claude}` },
      method: 'POST',
    });
    expect(harnessReconcile.status).toBe(403);
    await runtime.close();
  });

  it('rotates one harness credential without invalidating the other principals', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'safeword-runtime-rotation-'));
    runtimeDirectories.push(directory);
    const environment = productionEnvironment(directory);
    environment.PORT = String(await availablePort());
    const first = await startRelayRuntime(parseRuntimeConfig(environment), () => {});
    const oldClaude = first.authorizations.claude;
    const retained = {
      codex: first.authorizations.codex,
      cursor: first.authorizations.cursor,
      operator: first.authorizations.operator,
    };
    await first.close();

    const credentials = JSON.parse(
      Buffer.from(environment.RELAY_CREDENTIALS_BASE64 ?? '', 'base64').toString('utf8'),
    ) as { credentialId: string; harness: string; secret: string }[];
    const claude = credentials.find(item => item.harness === 'claude');
    if (claude === undefined) throw new Error('missing Claude credential');
    claude.credentialId = 'claude-rotated';
    claude.secret = 'e'.repeat(64);
    environment.RELAY_CREDENTIALS_BASE64 = Buffer.from(JSON.stringify(credentials)).toString(
      'base64',
    );

    const second = await startRelayRuntime(parseRuntimeConfig(environment), () => {});
    const statusFor = async (authorization: string) => {
      const response = await fetch(`${second.url}/v1/operations/retro-filings`, {
        headers: { authorization: `Bearer ${authorization}` },
      });
      return response.status;
    };
    await expect(statusFor(oldClaude)).resolves.toBe(401);
    await expect(statusFor(second.authorizations.claude)).resolves.toBe(403);
    await expect(statusFor(retained.codex)).resolves.toBe(403);
    await expect(statusFor(retained.cursor)).resolves.toBe(403);
    await expect(statusFor(retained.operator)).resolves.toBe(200);
    await second.close();
  });
});
