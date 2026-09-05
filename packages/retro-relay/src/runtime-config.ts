import { createPrivateKey } from 'node:crypto';
import path from 'node:path';

import type { CredentialInput } from './auth.js';
import type { PayloadKeyring } from './payload.js';
import type { RelayPrincipal } from './types.js';

export interface RuntimeConfig {
  credentialPepper: string;
  credentials: CredentialInput[];
  dataDirectory: string;
  databasePath: string;
  github: {
    appId: string;
    baseUrl: string;
    installationId: number;
    privateKey: string;
    repository: string;
  };
  host: '0.0.0.0';
  lockPath: string;
  mode: 'production' | 'spike';
  payloadKeyring: PayloadKeyring;
  port: number;
  reconciliation: {
    maxPages: number;
    timeoutMs: number;
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

// eslint-disable-next-line complexity -- Strict JSON boundary validates every keyring field without coercion.
function parseKeyringRecord(bytes: Buffer): {
  activeKeyId: string;
  keys: Record<string, unknown>;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8')) as unknown;
  } catch {
    throw new Error('invalid RELAY_PAYLOAD_KEYRING_BASE64');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('invalid RELAY_PAYLOAD_KEYRING_BASE64');
  }
  const record = parsed as Record<string, unknown>;
  const fields = Object.keys(record).toSorted((left, right) => left.localeCompare(right));
  if (
    fields.join('\0') !== ['activeKeyId', 'keys'].join('\0') ||
    typeof record.activeKeyId !== 'string' ||
    !/^[\w.-]{1,64}$/u.test(record.activeKeyId) ||
    typeof record.keys !== 'object' ||
    record.keys === null ||
    Array.isArray(record.keys)
  ) {
    throw new Error('invalid RELAY_PAYLOAD_KEYRING_BASE64');
  }
  return {
    activeKeyId: record.activeKeyId,
    keys: record.keys as Record<string, unknown>,
  };
}

function parsePayloadKeys(values: Record<string, unknown>): Map<string, Buffer> {
  const keys = new Map<string, Buffer>();
  for (const [keyId, value] of Object.entries(values)) {
    if (!/^[\w.-]{1,64}$/u.test(keyId) || typeof value !== 'string') {
      throw new Error('invalid RELAY_PAYLOAD_KEYRING_BASE64');
    }
    const key = strictBase64(value, 'RELAY_PAYLOAD_KEYRING_BASE64');
    if (key.length !== 32) throw new Error('invalid RELAY_PAYLOAD_KEYRING_BASE64');
    keys.set(keyId, key);
  }
  return keys;
}

function parsePayloadKeyring(encodedKeyring: string): PayloadKeyring {
  const record = parseKeyringRecord(strictBase64(encodedKeyring, 'RELAY_PAYLOAD_KEYRING_BASE64'));
  const keys = parsePayloadKeys(record.keys);
  if (!keys.has(record.activeKeyId)) throw new Error('invalid RELAY_PAYLOAD_KEYRING_BASE64');
  return { activeKeyId: record.activeKeyId, keys };
}

function parseStorage(
  environment: NodeJS.ProcessEnv,
): Pick<RuntimeConfig, 'dataDirectory' | 'payloadKeyring'> {
  const dataDirectory = required(environment, 'RELAY_DATA_DIR');
  if (!path.isAbsolute(dataDirectory) || dataDirectory === path.parse(dataDirectory).root) {
    throw new Error('invalid RELAY_DATA_DIR');
  }
  const encodedKeyring = environment.RELAY_PAYLOAD_KEYRING_BASE64?.trim();
  if (encodedKeyring !== undefined && encodedKeyring.length > 0) {
    return { dataDirectory, payloadKeyring: parsePayloadKeyring(encodedKeyring) };
  }
  const payloadKey = strictBase64(required(environment, 'RELAY_PAYLOAD_KEY'), 'RELAY_PAYLOAD_KEY');
  if (payloadKey.length !== 32) throw new Error('invalid RELAY_PAYLOAD_KEY');
  return {
    dataDirectory,
    payloadKeyring: {
      activeKeyId: 'legacy',
      keys: new Map([['legacy', payloadKey]]),
    },
  };
}

function credentialPepper(environment: NodeJS.ProcessEnv): string {
  const pepper = required(environment, 'RELAY_CREDENTIAL_PEPPER');
  if (!/^[\da-f]{64}$/u.test(pepper)) throw new Error('invalid RELAY_CREDENTIAL_PEPPER');
  return pepper;
}

// eslint-disable-next-line complexity -- Strict JSON boundary validates every credential field without coercion.
function credentialShape(value: unknown): value is CredentialInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).toSorted((left, right) => left.localeCompare(right));
  const expected = [
    'credentialId',
    'harness',
    'installationId',
    'repository',
    'roles',
    'secret',
    'subject',
    'tenantId',
  ];
  return (
    keys.join('\0') === expected.join('\0') &&
    typeof record.credentialId === 'string' &&
    typeof record.harness === 'string' &&
    typeof record.installationId === 'number' &&
    typeof record.repository === 'string' &&
    Array.isArray(record.roles) &&
    record.roles.every(role => typeof role === 'string') &&
    typeof record.secret === 'string' &&
    typeof record.subject === 'string' &&
    typeof record.tenantId === 'string'
  );
}

function validCredentialMaterial(credential: CredentialInput): boolean {
  return (
    /^[\da-z-]+$/u.test(credential.credentialId) &&
    /^[\da-f]{64}$/u.test(credential.secret) &&
    credential.subject.length > 0 &&
    credential.tenantId.length > 0 &&
    Number.isSafeInteger(credential.installationId) &&
    credential.installationId > 0 &&
    /^[\da-z_.-]+\/[\da-z_.-]+$/u.test(credential.repository.toLowerCase())
  );
}

function expectedRoles(harness: RelayPrincipal['harness']): RelayPrincipal['roles'] {
  if (harness === 'operator') return ['reconcile', 'operate'];
  return harness === 'collector-worker' ? ['ingest'] : ['file'];
}

function requireSharedTenant(credentials: CredentialInput[]): void {
  if (new Set(credentials.map(credential => credential.tenantId)).size !== 1) {
    throw new Error('production relay principals must share one tenant');
  }
}

function parseProductionCredentials(environment: NodeJS.ProcessEnv): CredentialInput[] {
  const bytes = strictBase64(
    required(environment, 'RELAY_CREDENTIALS_BASE64'),
    'RELAY_CREDENTIALS_BASE64',
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8')) as unknown;
  } catch {
    throw new Error('invalid RELAY_CREDENTIALS_BASE64');
  }
  if (!Array.isArray(parsed) || !parsed.every(credentialShape)) {
    throw new Error('invalid RELAY_CREDENTIALS_BASE64');
  }
  const credentials = parsed.map(item => ({
    ...item,
    repository: item.repository.toLowerCase(),
  }));
  const harnesses = ['claude', 'codex', 'cursor', 'operator', 'collector-worker'] as const;
  const ids = new Set<string>();
  for (const harness of harnesses) {
    const matching = credentials.filter(item => item.harness === harness);
    if (matching.length !== 1) throw new Error(`invalid production ${harness} principal`);
    const [credential] = matching;
    if (
      !validCredentialMaterial(credential) ||
      JSON.stringify(credential.roles) !== JSON.stringify(expectedRoles(harness))
    ) {
      throw new Error(`invalid production ${harness} principal`);
    }
    if (ids.has(credential.credentialId)) throw new Error('duplicate relay credential id');
    ids.add(credential.credentialId);
  }
  if (credentials.length !== harnesses.length) {
    throw new Error('invalid production relay principals');
  }
  requireSharedTenant(credentials);
  return credentials;
}

function parseSpikeCredential(
  environment: NodeJS.ProcessEnv,
  installationId: number,
  repo: string,
): CredentialInput {
  const credentialId = required(environment, 'RELAY_CREDENTIAL_ID');
  const secret = required(environment, 'RELAY_CREDENTIAL_SECRET');
  const harness = required(environment, 'RELAY_HARNESS');
  if (!['claude', 'codex', 'cursor'].includes(harness)) throw new Error('invalid RELAY_HARNESS');
  const credential: CredentialInput = {
    credentialId,
    harness: harness as RelayPrincipal['harness'],
    installationId,
    repository: repo,
    roles: ['file'],
    secret,
    subject: required(environment, 'RELAY_SUBJECT'),
    tenantId: required(environment, 'RELAY_TENANT_ID'),
  };
  if (!validCredentialMaterial(credential)) throw new Error('invalid relay credential material');
  return credential;
}

function productionGitHubBaseUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('invalid production GITHUB_API_BASE_URL');
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.pathname !== '/' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    throw new Error('invalid production GITHUB_API_BASE_URL');
  }
  return parsed.origin;
}

function parseGitHub(
  environment: NodeJS.ProcessEnv,
  mode: RuntimeConfig['mode'],
): RuntimeConfig['github'] {
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
  const configuredBaseUrl = optional(environment, 'GITHUB_API_BASE_URL', 'https://api.github.com');
  return {
    appId,
    baseUrl: mode === 'production' ? productionGitHubBaseUrl(configuredBaseUrl) : configuredBaseUrl,
    installationId,
    privateKey,
    repository: repo,
  };
}

export function parseRuntimeConfig(environment: NodeJS.ProcessEnv): RuntimeConfig {
  const mode = required(environment, 'RELAY_MODE');
  if (!['production', 'spike'].includes(mode)) throw new Error('invalid RELAY_MODE');
  const { host, port } = parseNetwork(environment);
  const { dataDirectory, payloadKeyring } = parseStorage(environment);
  const github = parseGitHub(environment, mode as RuntimeConfig['mode']);
  const credentials =
    mode === 'production'
      ? parseProductionCredentials(environment)
      : [parseSpikeCredential(environment, github.installationId, github.repository)];
  if (
    mode === 'production' &&
    credentials.some(
      item =>
        item.installationId !== github.installationId || item.repository !== github.repository,
    )
  ) {
    throw new Error('production credential scope must match the GitHub App installation');
  }
  return {
    credentialPepper: credentialPepper(environment),
    credentials,
    dataDirectory,
    databasePath: path.join(dataDirectory, 'relay.sqlite'),
    github,
    host,
    lockPath: path.join(dataDirectory, 'relay.lock'),
    mode: mode as RuntimeConfig['mode'],
    payloadKeyring,
    port,
    reconciliation: {
      maxPages: positiveInteger(
        optional(environment, 'RELAY_RECONCILIATION_MAX_PAGES', '200'),
        'RELAY_RECONCILIATION_MAX_PAGES',
      ),
      timeoutMs: positiveInteger(
        optional(environment, 'RELAY_RECONCILIATION_TIMEOUT_MS', '30000'),
        'RELAY_RECONCILIATION_TIMEOUT_MS',
      ),
    },
    replicaId: optional(environment, 'RAILWAY_REPLICA_ID', 'local'),
  };
}
