import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseRuntimeConfig, startRelayRuntime } from '../src/index.js';

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
    GITHUB_APP_ID: '1',
    GITHUB_APP_PRIVATE_KEY_BASE64: privateKeyBase64,
    GITHUB_INSTALLATION_ID: '1',
    GITHUB_REPOSITORY: 'ArcadeAI/safeword',
  };
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
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      schemaVersion: 1,
      replicaId: 'replica-test',
    });

    await runtime.close();
    expect(existsSync(config.lockPath)).toBe(false);
    const reopened = await startRelayRuntime(config, () => {});
    await reopened.close();
  });
});
