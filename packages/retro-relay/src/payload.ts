import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import type { FileRetroDraftRequest, RequestScope } from './types.js';

export interface PayloadEnvelope {
  nonce: Buffer;
  ciphertext: Buffer;
  tag: Buffer;
}

function associatedData(scope: RequestScope, hash: string): Buffer {
  return Buffer.from(
    JSON.stringify([
      'payload-v1',
      scope.tenantId,
      scope.installationId,
      scope.repository,
      scope.requestId,
      hash,
    ]),
    'utf8',
  );
}

export function encryptPayload(
  request: FileRetroDraftRequest,
  scope: RequestScope,
  hash: string,
  key: Buffer,
): PayloadEnvelope {
  if (key.length !== 32) throw new Error('payload key must be 32 bytes');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(associatedData(scope, hash));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(request), 'utf8'),
    cipher.final(),
  ]);
  return { nonce, ciphertext, tag: cipher.getAuthTag() };
}

export function decryptPayload(
  envelope: PayloadEnvelope,
  scope: RequestScope,
  hash: string,
  key: Buffer,
): FileRetroDraftRequest {
  const decipher = createDecipheriv('aes-256-gcm', key, envelope.nonce);
  decipher.setAAD(associatedData(scope, hash));
  decipher.setAuthTag(envelope.tag);
  const plaintext = Buffer.concat([
    decipher.update(envelope.ciphertext),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(plaintext) as FileRetroDraftRequest;
}
