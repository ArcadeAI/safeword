import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseRuntimeConfig } from '../src/runtime-config.js';

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
});
