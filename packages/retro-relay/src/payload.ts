import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import type { FileRetroDraftRequest, RequestScope } from './types.js';

export interface PayloadEnvelope {
  nonce: Buffer;
  ciphertext: Buffer;
  tag: Buffer;
  formatVersion: 1 | 2;
  keyId: string;
}

export interface PayloadKeyring {
  activeKeyId: string;
  keys: ReadonlyMap<string, Buffer>;
}

function associatedData(
  scope: RequestScope,
  hash: string,
  formatVersion: PayloadEnvelope['formatVersion'],
  keyId: string,
): Buffer {
  return Buffer.from(
    JSON.stringify(
      formatVersion === 1
        ? [
            'payload-v1',
            scope.tenantId,
            scope.installationId,
            scope.repository,
            scope.requestId,
            hash,
          ]
        : [
            'payload-v2',
            keyId,
            scope.tenantId,
            scope.installationId,
            scope.repository,
            scope.requestId,
            hash,
          ],
    ),
    'utf8',
  );
}

function keyFor(keyring: PayloadKeyring, keyId: string): Buffer {
  const key = keyring.keys.get(keyId);
  if (key === undefined) throw new Error(`payload key ${keyId} is unavailable`);
  if (key.length !== 32) throw new Error(`payload key ${keyId} must be 32 bytes`);
  return key;
}

export function encryptPayload(
  request: FileRetroDraftRequest,
  scope: RequestScope,
  hash: string,
  keyring: PayloadKeyring,
): PayloadEnvelope {
  const keyId = keyring.activeKeyId;
  const key = keyFor(keyring, keyId);
  const formatVersion = 2;
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(associatedData(scope, hash, formatVersion, keyId));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(request), 'utf8'),
    cipher.final(),
  ]);
  return { nonce, ciphertext, tag: cipher.getAuthTag(), formatVersion, keyId };
}

export function decryptPayload(
  envelope: PayloadEnvelope,
  scope: RequestScope,
  hash: string,
  keyring: PayloadKeyring,
): FileRetroDraftRequest {
  const key = keyFor(keyring, envelope.keyId);
  const decipher = createDecipheriv('aes-256-gcm', key, envelope.nonce);
  decipher.setAAD(associatedData(scope, hash, envelope.formatVersion, envelope.keyId));
  decipher.setAuthTag(envelope.tag);
  const plaintext = Buffer.concat([
    decipher.update(envelope.ciphertext),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(plaintext) as FileRetroDraftRequest;
}
