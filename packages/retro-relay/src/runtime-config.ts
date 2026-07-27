import { createPrivateKey } from 'node:crypto';
import path from 'node:path';

import type { CredentialInput } from './auth.js';
import type { RelayPrincipal } from './types.js';

export interface RuntimeConfig {
  host: '0.0.0.0';
  port: number;
  dataDirectory: string;
  databasePath: string;
  lockPath: string;
  payloadKey: Buffer;
  credentialPepper: string;
  credential: CredentialInput;
  github: {
    appId: string;
    privateKey: string;
    installationId: number;
    repository: string;
    baseUrl: string;
  };
  replicaId: string;
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = Reflect.get(environment, name)?.trim();
  if (value === undefined || value.length === 0) throw new Error(`missing ${name}`);
  return value;
}

function optional(environment: NodeJS.ProcessEnv, name: string, fallback: string): string {
  const value = Reflect.get(environment, name)?.trim();
  return value === undefined || value.length === 0 ? fallback : value;
}

function positiveInteger(value: string, name: string): number {
  if (!/^[1-9]\d*$/u.test(value)) throw new Error(`invalid ${name}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`invalid ${name}`);
  return parsed;
}

function strictBase64(value: string, name: string): Buffer {
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value) throw new Error(`invalid ${name}`);
  return decoded;
}

function parseNetwork(environment: NodeJS.ProcessEnv): Pick<RuntimeConfig, 'host' | 'port'> {
  const host = required(environment, 'HOST');
  if (host !== '0.0.0.0') throw new Error('invalid HOST');
  const port = positiveInteger(required(environment, 'PORT'), 'PORT');
  if (port > 65_535) throw new Error('invalid PORT');
  return { host, port };
}

function parseStorage(
  environment: NodeJS.ProcessEnv,
): Pick<RuntimeConfig, 'dataDirectory' | 'payloadKey'> {
  const dataDirectory = required(environment, 'RELAY_DATA_DIR');
  if (!path.isAbsolute(dataDirectory) || dataDirectory === path.parse(dataDirectory).root) {
    throw new Error('invalid RELAY_DATA_DIR');
  }
  const payloadKey = strictBase64(required(environment, 'RELAY_PAYLOAD_KEY'), 'RELAY_PAYLOAD_KEY');
  if (payloadKey.length !== 32) throw new Error('invalid RELAY_PAYLOAD_KEY');
  return { dataDirectory, payloadKey };
}

function parseCredential(
  environment: NodeJS.ProcessEnv,
  installationId: number,
  repo: string,
): Pick<RuntimeConfig, 'credentialPepper' | 'credential'> {
  const credentialPepper = required(environment, 'RELAY_CREDENTIAL_PEPPER');
  if (!/^[\da-f]{64}$/u.test(credentialPepper)) {
    throw new Error('invalid RELAY_CREDENTIAL_PEPPER');
  }
  const credentialId = required(environment, 'RELAY_CREDENTIAL_ID');
  if (!/^[\da-z-]+$/u.test(credentialId)) throw new Error('invalid RELAY_CREDENTIAL_ID');
  const credentialSecret = required(environment, 'RELAY_CREDENTIAL_SECRET');
  if (!/^[\da-f]{64}$/u.test(credentialSecret)) {
    throw new Error('invalid RELAY_CREDENTIAL_SECRET');
  }

  const harness = required(environment, 'RELAY_HARNESS');
  if (!['claude', 'codex', 'cursor', 'operator'].includes(harness)) {
    throw new Error('invalid RELAY_HARNESS');
  }
  return {
    credentialPepper,
    credential: {
      tenantId: required(environment, 'RELAY_TENANT_ID'),
      credentialId,
      secret: credentialSecret,
      subject: required(environment, 'RELAY_SUBJECT'),
      harness: harness as RelayPrincipal['harness'],
      installationId,
      repository: repo,
      roles: harness === 'operator' ? ['file', 'reconcile'] : ['file'],
    },
  };
}

function parseGitHub(environment: NodeJS.ProcessEnv): RuntimeConfig['github'] {
  const appId = required(environment, 'GITHUB_APP_ID');
  positiveInteger(appId, 'GITHUB_APP_ID');
  const privateKeyBytes = strictBase64(
    required(environment, 'GITHUB_APP_PRIVATE_KEY_BASE64'),
    'GITHUB_APP_PRIVATE_KEY_BASE64',
  );
  const privateKey = privateKeyBytes.toString('utf8');
  try {
    createPrivateKey(privateKey);
  } catch {
    throw new Error('invalid GITHUB_APP_PRIVATE_KEY_BASE64');
  }

  const installationId = positiveInteger(
    required(environment, 'GITHUB_INSTALLATION_ID'),
    'GITHUB_INSTALLATION_ID',
  );
  const repo = required(environment, 'GITHUB_REPOSITORY').toLowerCase();
  if (!/^[\da-z_.-]+\/[\da-z_.-]+$/u.test(repo)) {
    throw new Error('invalid GITHUB_REPOSITORY');
  }
  return {
    appId,
    privateKey,
    installationId,
    repository: repo,
    baseUrl: optional(environment, 'GITHUB_API_BASE_URL', 'https://api.github.com'),
  };
}

export function parseRuntimeConfig(environment: NodeJS.ProcessEnv): RuntimeConfig {
  const { host, port } = parseNetwork(environment);
  const { dataDirectory, payloadKey } = parseStorage(environment);
  const github = parseGitHub(environment);
  const { credentialPepper, credential } = parseCredential(
    environment,
    github.installationId,
    github.repository,
  );
  return {
    host,
    port,
    dataDirectory,
    databasePath: path.join(dataDirectory, 'relay.sqlite'),
    lockPath: path.join(dataDirectory, 'relay.lock'),
    payloadKey,
    credentialPepper,
    credential,
    github,
    replicaId: optional(environment, 'RAILWAY_REPLICA_ID', 'local'),
  };
}
